import numpy as np
import cv2
import traceback
import matplotlib.pyplot as plt
from ..datastructure.aufmassClasses import SegmentationMask
from ..helpers.mask_utils import mask_to_jsonb, merge_layers, get_shape_from_batch_results
from ..database_upload_functions import _insert_aufmass_object
from ..database_download_functions import _get_aufmass_objects
import uuid

# --- DEFAULT CLEANING CONFIGURATION ---
# Can be overridden or adjusted via config in the future
# Kernel sizes are relative to image width (0-1 = percentage, >1 = absolute pixels)
# Morphological closing fills holes and dents naturally without restrictions
DEFAULT_CLEANING_CONFIG = {
    "facade": {
        "close_kernel_size": 0.01,      # ~1% of image width (aggressiver für Regenfallrohre)
        "contour_mode": cv2.RETR_TREE,   # Fill all holes
        "iterations": 2                  # Mehr Iterationen für hartnäckige Löcher
    },
    "window": {
        "close_kernel_size": 0.007,      # ~0.7% of image width
        "contour_mode": cv2.RETR_TREE   # Fill all holes
    },
    "door": {
        "close_kernel_size": 0.005,      # ~0.5% of image width
        "contour_mode": cv2.RETR_TREE   # Fill all holes
    },
    "roof": {
        "close_kernel_size": 0.005,      # ~0.5% of image width
        "contour_mode": cv2.RETR_TREE   # Fill all holes
    }
}

def _identify_main_facade(filtered_pred, wall_id, sky_id):
    """
    Identifies main facade and removes disconnected wall segments.
    """
    wall_mask = (filtered_pred == wall_id).astype(np.uint8)
    num_wall_labels, wall_labels, wall_stats, _ = cv2.connectedComponentsWithStats(wall_mask, connectivity=8)
    
    if num_wall_labels > 1:
        # Find the largest wall component (this is the main facade)
        largest_wall_label = np.argmax(wall_stats[1:, cv2.CC_STAT_AREA]) + 1
        main_facade_mask = (wall_labels == largest_wall_label)
        
        # Remove all disconnected wall segments (keep only the main facade)
        disconnected_walls_mask = wall_mask & (~main_facade_mask)
        num_disconnected = np.sum(disconnected_walls_mask)
        
        if num_disconnected > 0:
            filtered_pred[disconnected_walls_mask] = sky_id
            print(f"  - Removed {num_disconnected} disconnected building/wall pixels")

def _filter_small_elements(filtered_pred, window_id, door_id, wall_id, min_element_area):
    """Removes small elements (windows, doors) and sets them to wall_id."""
    for element_id, element_name in [(window_id, "window"), (door_id, "door")]:
        if element_id is None:
            continue
        element_mask = (filtered_pred == element_id).astype(np.uint8)
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(element_mask, connectivity=8)
        
        if num_labels > 1:
            filtered_count = 0
            for label_idx in range(1, num_labels):
                area = stats[label_idx, cv2.CC_STAT_AREA]
                if area < min_element_area:
                    filtered_pred[labels == label_idx] = wall_id
                    filtered_count += 1
                    print(f"  - Filtered small {element_name} with area {area} px (set to wall).")
            if filtered_count > 0:
                print(f"Total filtered {element_name}s: {filtered_count}")

def _visualize_mask_comparison(mask_before, mask_after, facade_id, class_mappings_dict):
    """
    Temporäre Visualisierung: Zeigt die semantische Maske vor und nach dem Cleaning.
    """
    try:
        # Erstelle Farbpalette für die verschiedenen Klassen
        max_class_id = max([v for v in class_mappings_dict.values() if v is not None] + [0])
        colors = plt.cm.tab20(np.linspace(0, 1, max_class_id + 1))
        
        # Konvertiere Masken zu RGB für Visualisierung
        def mask_to_rgb(mask):
            rgb = np.zeros((mask.shape[0], mask.shape[1], 3))
            for class_id in range(max_class_id + 1):
                mask_class = (mask == class_id)
                rgb[mask_class] = colors[class_id][:3]
            return rgb
        
        rgb_before = mask_to_rgb(mask_before)
        rgb_after = mask_to_rgb(mask_after)
        
        # Erstelle Figure mit zwei Subplots
        fig, axes = plt.subplots(1, 2, figsize=(16, 8))
        
        axes[0].imshow(rgb_before)
        axes[0].set_title(f'Vor Cleaning (Facade {facade_id})', fontsize=12)
        axes[0].axis('off')
        
        axes[1].imshow(rgb_after)
        axes[1].set_title(f'Nach Cleaning (Facade {facade_id})', fontsize=12)
        axes[1].axis('off')
        
        plt.tight_layout()
        plt.show()
        
    except Exception as e:
        print(f"Warning: Konnte Visualisierung nicht erstellen: {e}")
        traceback.print_exc()

def _save_cleaned_mask(cleaned_pred, ID_LOD2, facade_id, access_token):
    """Saves the cleaned mask to database."""
    # Convert mask to JSONB format
    mask_jsonb = mask_to_jsonb(cleaned_pred)
    
    # Check if mask already exists to update it instead of creating a new one
    existing_masks = _get_aufmass_objects(ID_LOD2, "segmentation_mask", ids={"facade_id": facade_id}, tags=["facade_cleaned"], access_token=access_token)
    
    if existing_masks:
        mask_id = existing_masks[0]["mask_id"]
        print(f"[INFO] Updating existing mask {mask_id}")
    else:
        mask_id = str(uuid.uuid4())
        print(f"[INFO] Creating new mask {mask_id}")
    
    cleaned_segmentation_mask = SegmentationMask(
        ID_LOD2=ID_LOD2,
        facade_id=facade_id,
        mask_id=mask_id,
        tags=["facade_cleaned"],
        mask=mask_jsonb
    )
    
    _insert_aufmass_object(cleaned_segmentation_mask, access_token)

def filter_segmentation_mask(ID_LOD2, elem_pred, config, facade_id, access_token, execution_mode: str = "server"):
    """
    Takes the segmentation result, removes illogical elements & artifacts:
    1. Remove facade areas & elements that are not connected to the main facade (e.g. Chimneys, artifacts)
    2. Remove elements (windows, doors etc.) that are below a certain area threshold (relative to image size, default: 0.1% of image area)
    
    Args:
        execution_mode: Execution mode - "server" (default) or "local". 
                       If "local", visualization functions will be used, otherwise not.
    """

    if elem_pred is None or config is None:
        return elem_pred

    try:
        print(f"--- Cleaning Mask for Facade {facade_id} ---")
        
        # Get class IDs from config
        class_mappings_dict = config.get('class_mappings', {}).get('elements', {})
        
        # Determine shape from batch results
        shape = get_shape_from_batch_results(elem_pred)
        if shape is None:
            print("Warning: Could not determine shape from raw results. Assuming empty or invalid.")
            return None
        
        img_h, img_w = shape
        print(f"[Info] Input is raw batch result. Merging to map of size {img_w}x{img_h}...")
        
        # Parameters - relative to image size
        # min_element_area as percentage of total image area (0.001 = 0.1% of image area)
        min_element_area_ratio = 0.0002  # 0.02% of image area
        min_element_area = int(min_element_area_ratio * img_h * img_w)
        
        # Erstelle Maske VOR Cleaning (ohne cleaning_config) für Visualisierung
        mask_before = merge_layers(elem_pred, (img_h, img_w), class_mappings_dict, cleaning_config=None)
        if mask_before is None:
            return None
        
        # Process raw batch result WITH cleaning
        cleaned_pred = merge_layers(elem_pred, (img_h, img_w), class_mappings_dict, cleaning_config=DEFAULT_CLEANING_CONFIG)
        if cleaned_pred is None:
            return None
        
        # Get class IDs
        wall_id = class_mappings_dict.get('building')
        window_id = class_mappings_dict.get('window')
        door_id = class_mappings_dict.get('door')
        roof_id = class_mappings_dict.get('roof')
        sky_id = 0  # Background/Sky (always 0)
        
        print(f"Using class IDs from config: Building={wall_id}, Window={window_id}, Door={door_id}, Roof={roof_id}, Sky={sky_id}")
        
        if wall_id is None:
            print("WARNING: Building/wall class ID not found in config. Skipping facade cleaning.")
            return cleaned_pred
        
        # Entfernt disconnected wall segments (z.B. Schornsteine) aus cleaned_pred, behält nur größte Fassaden-Komponente
        _identify_main_facade(cleaned_pred, wall_id, sky_id)
        
        # Entfernt kleine Fenster/Türen unter Flächen-Schwelle aus cleaned_pred, setzt sie auf "wall"
        _filter_small_elements(cleaned_pred, window_id, door_id, wall_id, min_element_area)
        
        # Visualisiere Vergleich vor/nach Cleaning (nur im local mode)
        if execution_mode == "local":
            _visualize_mask_comparison(mask_before, cleaned_pred, facade_id, class_mappings_dict)

    except Exception as e:
        print(f"Error during mask cleaning: {e}")
        traceback.print_exc()
        return None

    # Save cleaned mask
    _save_cleaned_mask(cleaned_pred, ID_LOD2, facade_id, access_token)

    return cleaned_pred
