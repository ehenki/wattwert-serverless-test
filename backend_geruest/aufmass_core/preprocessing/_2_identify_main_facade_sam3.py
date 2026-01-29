from aufmass_core.models.sam3_model_cache import get_sam3_segmenter
from aufmass_core.database_download_functions import _get_facade_image, _get_aufmass_objects
from aufmass_core.database_upload_functions import _insert_aufmass_object
from aufmass_core.datastructure.aufmassClasses import SegmentationMask
from ..helpers.mask_utils import mask_to_jsonb
from PIL import Image
import torch
import tempfile
import uuid
import os
from io import BytesIO
import time
import cv2
import matplotlib.pyplot as plt
import traceback

import numpy as np

def _safe_delete_file(file_path: str, max_retries: int = 5, retry_delay: float = 0.1) -> bool:
    """
    Safely delete a file, handling Windows file locks with retries.
    
    Args:
        file_path: Path to file to delete
        max_retries: Number of retry attempts
        retry_delay: Delay in seconds between retries
        
    Returns:
        True if file was deleted successfully, False otherwise
    """
    if not os.path.exists(file_path):
        return True
    
    for attempt in range(max_retries):
        try:
            os.unlink(file_path)
            return True
        except PermissionError as e:
            if attempt < max_retries - 1:
                # Wait a bit and retry (file might be locked by another process)
                time.sleep(retry_delay)
            else:
                # Last attempt failed, log warning but don't crash
                print(f"[WARNING] Could not delete temp file after {max_retries} attempts: {file_path}")
                print(f"[WARNING] Error: {e}")
                return False
    
    return False

def segment_fassade(image_path: str):
    from PIL import Image
    
    # Debug: Zeige Bild-Info
    img = Image.open(image_path)
    print(f"[DEBUG] Starting SAM3 segmentation...")
    print(f"[DEBUG] Image path: {image_path}")
    print(f"[DEBUG] Image size: {img.size} ({img.width}x{img.height})")
    print(f"[DEBUG] Image mode: {img.mode}")
    
    segmenter = get_sam3_segmenter()
    result = segmenter.segment(
        image_path, 
        prompt="facade",
        score_threshold=0.3  # Lower threshold to find any facade
    )
    
    print(f"[DEBUG] SAM3 segmentation finished!")
    return result

def _visualize_main_facade(ID_LOD2, facade_id, main_facade_mask, base_image, execution_mode):
    """
    Visualisiert die identifizierte Hauptfassade als Overlay auf dem Original-Bild.
    Ähnlich wie die Segmentation Overlay Funktion, aber nur für die Hauptfassade-Maske.
    
    Args:
        ID_LOD2: Gebäude-ID
        facade_id: Fassaden-ID
        main_facade_mask: Boolean-Maske der Hauptfassade (H x W)
        base_image: Das Original-Bild als numpy array (BGR)
        execution_mode: Execution mode - "server" (default) or "local"
    """
    if execution_mode != "local":
        return
    
    try:
        # 1. Dimensionen überprüfen und Maske anpassen falls nötig
        base_h, base_w = base_image.shape[:2]
        
        # Ensure mask is 2D
        if main_facade_mask.ndim == 3:
            main_facade_mask = main_facade_mask.squeeze(0)
        
        if main_facade_mask.shape != (base_h, base_w):
            print(f"Adjusting facade mask size from {main_facade_mask.shape} to image size {base_w}x{base_h}")
            main_facade_mask = cv2.resize(
                main_facade_mask.astype(np.uint8), 
                (base_w, base_h), 
                interpolation=cv2.INTER_NEAREST
            ).astype(bool)
        
        # 2. Hauptfassade-Maske in Farbbild umwandeln (Rot für Fassade)
        facade_color = [0, 0, 255]  # Rot in BGR
        mask_colored = np.zeros((base_h, base_w, 3), dtype=np.uint8)
        mask_colored[main_facade_mask] = facade_color
        
        # 3. Transparentes Overlay mit abgedunkeltem Background erstellen
        alpha = 0.4  # 40% Opazität für die Fassade-Maske
        
        # 3.1 Weiche Alpha-Maske für smooth Kanten
        facade_mask_binary = main_facade_mask.astype(np.float32)
        smooth_alpha_mask = cv2.GaussianBlur(facade_mask_binary, (5, 5), 0)
        smooth_alpha_3d = np.stack([smooth_alpha_mask] * 3, axis=2)
        
        # 3.2 Background abdunkeln (20% Helligkeit)
        background_darkness = 0.2
        darkened_background = base_image.astype(np.float32) * background_darkness
        
        # 3.3 Overlay: Background abgedunkelt, Fassade-Maske mit Alpha-Blending
        mask_overlay = (base_image.astype(np.float32) * (1 - alpha) + 
                       mask_colored.astype(np.float32) * alpha)
        
        overlay_image = (
            darkened_background * (1 - smooth_alpha_3d) + 
            mask_overlay * smooth_alpha_3d
        ).astype(np.uint8)
        
        # 4. Visualisierung mit matplotlib
        # Konvertiere BGR zu RGB für matplotlib
        base_rgb = cv2.cvtColor(base_image, cv2.COLOR_BGR2RGB)
        mask_rgb = cv2.cvtColor(mask_colored, cv2.COLOR_BGR2RGB)
        overlay_rgb = cv2.cvtColor(overlay_image, cv2.COLOR_BGR2RGB)
        
        # Erstelle Figure mit 3 Subplots
        fig, axes = plt.subplots(1, 3, figsize=(18, 6))
        
        axes[0].imshow(base_rgb)
        axes[0].set_title('Original Image', fontsize=12, fontweight='bold')
        axes[0].axis('off')
        
        axes[1].imshow(mask_rgb)
        axes[1].set_title('Main Facade Mask', fontsize=12, fontweight='bold')
        axes[1].axis('off')
        
        axes[2].imshow(overlay_rgb)
        axes[2].set_title('Main Facade Overlay (40% Transparency)', fontsize=12, fontweight='bold')
        axes[2].axis('off')
        
        # Legende
        from matplotlib.patches import Patch
        legend_elements = [
            Patch(facecolor=[1, 0, 0], label='Main Facade')  # Rot in RGB
        ]
        
        fig.legend(handles=legend_elements, loc='lower center', ncol=1, 
                  frameon=True, fontsize=10, bbox_to_anchor=(0.5, -0.05))
        
        plt.suptitle(f'Main Facade Identification - Facade {facade_id}', fontsize=14, fontweight='bold')
        plt.tight_layout()
        plt.subplots_adjust(bottom=0.15)  # Platz für Legende
        plt.show()
        
        print("Main facade visualization displayed successfully.")
        
    except Exception as e:
        print(f"Warning: Could not visualize main facade: {e}")
        traceback.print_exc()


def identify_main_facade(ID_LOD2: str, facade_id: str, access_token: str, execution_mode: str = "server"):
    '''
    Uses semantic segmentation to identify the dominant facade from an image.
    Uses ID_LOD2 and facade_id to obtain the lens-corrected image from the database (tag: "lens_corrected").
    Uploads the mask with the identified main facade to the segmentation_mask database table (tag: "facade_unprocessed").
    Returns nothing, no updates in the database are made in this function, cropped images are uploaded in _3_crop_image.py
    
    Args:
        execution_mode: Execution mode - "server" (default) or "local". 
                       If "local", visualization functions will be used, otherwise not.
    '''
    # 1. Load lens-corrected image from database
    image_bytes = _get_facade_image(ID_LOD2, facade_id, tags=["lens_corrected"], access_token=access_token)
    if not image_bytes:
        print(f"No lens-corrected image found for {ID_LOD2}/{facade_id}. Using original photo instead.")
        image_bytes = _get_facade_image(ID_LOD2, facade_id, tags=["photo"], access_token=access_token)
    if not image_bytes:
        raise ValueError(f"No image found for {ID_LOD2}/{facade_id} to perform facade segmentation.")
    
    # 1.1 Convert image bytes to numpy array (BGR) for visualization (only in local mode)
    base_image_bgr = None
    if execution_mode == "local":
        nparr = np.frombuffer(image_bytes, np.uint8)
        base_image_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # 2. Convert bytes to PIL Image and save to temp file
    image = Image.open(BytesIO(image_bytes))
    
    # Debug: Zeige geladenes Bild
    print(f"[DEBUG] Loaded image from database:")
    print(f"[DEBUG]   Size: {image.size} ({image.width}x{image.height})")
    print(f"[DEBUG]   Mode: {image.mode}")
    print(f"[DEBUG]   Format: {image.format}")
    
    temp_file = None
    
    try:
        # Create temp file for SAM3 (requires file path)
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp:
            # Convert RGBA to RGB if necessary (JPEG doesn't support transparency)
            if image.mode == 'RGBA':
                rgb_image = Image.new('RGB', image.size, (255, 255, 255))
                rgb_image.paste(image, mask=image.split()[3])  # Use alpha channel as mask
                rgb_image.save(tmp, format='JPEG')
            else:
                image.save(tmp, format='JPEG')
            temp_file = tmp.name
        
        print(f"[DEBUG] Saved to temp file: {temp_file}")
        
        # 3. Perform SAM3 segmentation
        result = segment_fassade(temp_file)
        
        masks = result["masks"]
        boxes = result["boxes"]
        scores = result["scores"]
        
        # Debug output
        print(f"[DEBUG] SAM3 found {len(masks)} masks")
        if len(masks) > 0:
            print(f"[DEBUG] Scores: {scores.tolist()}")
        
        # 4. Validate results
        if len(masks) == 0:
            raise ValueError(f"No central facade found for {ID_LOD2}/{facade_id}. Try different prompt or lower threshold.")
        
        # 5. Select BEST mask based on Center-Weighted Area
        # Even with prompt="facade", SAM might detect neighbor buildings at the edge.
        # We prioritize the mask that is Large AND Central.
        
        best_mask_idx = 0
        max_weighted_score = -1
        
        # Get image dimensions from first mask
        if masks[0].ndim == 3:
            _, img_h, img_w = masks[0].shape
        else:
            img_h, img_w = masks[0].shape
            
        img_center_x = img_w / 2.0
        img_center_y = img_h / 2.0
        
        # Max possible distance (corner to center) for normalization
        max_dist = np.sqrt(img_center_x**2 + img_center_y**2)

        print(f"[DEBUG] Analyzing {len(masks)} masks for best fit (Center-Weighted)...")

        for i, mask in enumerate(masks):
            # Ensure mask is 2D for calculation
            if mask.ndim == 3:
                mask_2d = mask.squeeze(0)
            else:
                mask_2d = mask

            # 1. Calculate Area (number of pixels)
            area = mask_2d.sum().item()
            
            # 2. Calculate Centroid
            # Fast approximation using bounding box center
            rows, cols = np.where(mask_2d)
            if len(rows) == 0: 
                continue
            
            y_min, y_max = rows.min(), rows.max()
            x_min, x_max = cols.min(), cols.max()
            
            mask_center_y = (y_min + y_max) / 2.0
            mask_center_x = (x_min + x_max) / 2.0
            
            # 3. Calculate Distance to Image Center
            dist_x = mask_center_x - img_center_x
            dist_y = mask_center_y - img_center_y
            dist = np.sqrt(dist_x**2 + dist_y**2)
            
            # 4. Calculate Centrality (1.0 = Center, 0.0 = Corner)
            centrality = 1.0 - (dist / max_dist)
            
            # 5. Weighted Score: Area * (Centrality^2)
            # Squaring centrality punishes edges more severely.
            weighted_score = area * (centrality ** 2)
            
            print(f"  Mask {i}: Area={area}")
            print(f"    Center: ({mask_center_x:.1f}, {mask_center_y:.1f}) vs Image Center: ({img_center_x:.1f}, {img_center_y:.1f})")
            print(f"    Dist: {dist:.1f} / Max: {max_dist:.1f} -> Centrality: {centrality:.2f}")
            print(f"    Score: {weighted_score:.0f}")
            
            if weighted_score > max_weighted_score:
                max_weighted_score = weighted_score
                best_mask_idx = i
        
        print(f"[DEBUG] Selected Mask {best_mask_idx} as main facade.")

        main_mask = masks[best_mask_idx]
        main_score = scores[best_mask_idx]
        
        # 5.1 Visualisiere identifizierte Hauptfassade (nur im local mode)
        if execution_mode == "local":
            if base_image_bgr is None:
                # Fallback: Load image for visualization if not already loaded
                nparr = np.frombuffer(image_bytes, np.uint8)
                base_image_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if base_image_bgr is not None:
                # Convert Tensor to numpy array if needed
                if isinstance(main_mask, torch.Tensor):
                    main_mask_np = main_mask.cpu().numpy()
                else:
                    main_mask_np = main_mask
                
                # Ensure mask is 2D boolean
                if main_mask_np.ndim == 3:
                    main_mask_2d = main_mask_np.squeeze(0)
                else:
                    main_mask_2d = main_mask_np
                main_mask_bool = main_mask_2d.astype(bool)
                _visualize_main_facade(ID_LOD2, facade_id, main_mask_bool, base_image_bgr, execution_mode)
        
        # 6. Convert mask to JSONB format
        mask_jsonb = mask_to_jsonb(main_mask)
        
        # 7. Create SegmentationMask object
        
        # Check if mask already exists to update it instead of creating a new one
        # This prevents cluttering the DB with multiple masks for the same facade
        existing_masks = _get_aufmass_objects(ID_LOD2, "segmentation_mask", ids={"facade_id": facade_id}, tags=["facade_unprocessed"], access_token=access_token)
        
        if existing_masks and len(existing_masks) > 0:
            mask_id = existing_masks[0]["mask_id"]
            print(f"[INFO] Updating existing mask {mask_id}")
        else:
            mask_id = str(uuid.uuid4())
            print(f"[INFO] Creating new mask {mask_id}")

        segmentation_mask = SegmentationMask(
            ID_LOD2=ID_LOD2,
            facade_id=facade_id,
            mask_id=mask_id,
            tags=["facade_unprocessed"],
            mask=mask_jsonb
        )
        
        # 8. Save to database
        _insert_aufmass_object(segmentation_mask, access_token)
        
        print(f"[SUCCESS] Central facade identified for {ID_LOD2}/{facade_id}")
        print(f"  Score: {main_score:.3f}")
        print(f"  Mask ID: {mask_id}")
        
    finally:
        # 9. Clean up temp file
        if temp_file and os.path.exists(temp_file):
            _safe_delete_file(temp_file)