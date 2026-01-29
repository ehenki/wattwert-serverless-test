import numpy as np
import cv2
import traceback
from ..database_upload_functions import _insert_aufmass_object
from ..database_download_functions import _get_aufmass_objects
from ..datastructure.aufmassClasses import Facade

def analyze_segmentation_results(ID_LOD2, elem_pred, config, facade_id, access_token):
    """
    Analyzes the raw segmentation result (pixel definitions) to calculate:
    1. Window-to-Wall Ratio (WWR)
    2. Average Window Size (in pixels)
    """

    if elem_pred is None or config is None:
        print("Segmentation failed or returned no data, skipping analysis.")
        return

    try:
        print(f"--- Analysis for Facade {facade_id} ---")
        
        # Retrieve class IDs from config
        # Access path: config['class_mappings']['elements']['window']
        window_id = config.get('class_mappings', {}).get('elements', {}).get('window')
        wall_id = config.get('class_mappings', {}).get('elements', {}).get('building')
        
        if window_id is not None and wall_id is not None:
            # 1. Window-to-Wall Ratio (WWR)
            # Definition: Window Area / Gross Wall Area (Window Area + Opaque Wall Area)
            window_pixels = np.sum(elem_pred == window_id)
            wall_pixels = np.sum(elem_pred == wall_id)
            gross_wall_area_pixels = window_pixels + wall_pixels
            
            wwr = 0.0
            if gross_wall_area_pixels > 0:
                wwr = window_pixels / gross_wall_area_pixels
            
            print(f"WWR Analysis:")
            print(f"  Window Pixels: {window_pixels:,}")
            print(f"  Opaque Wall Pixels: {wall_pixels:,}")
            print(f"  Gross Wall Area: {gross_wall_area_pixels:,}")
            print(f"  Window-to-Wall Ratio (WWR): {wwr:.2%}")
            
            # 2. Average Window Size using Connected Components
            # Create binary mask for windows (Window=1, Background=0)
            window_mask = (elem_pred == window_id).astype(np.uint8)
            
            # connectedComponentsWithStats expects a binary image
            # Returns: number of labels, label matrix, stats matrix, centroids
            num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(window_mask, connectivity=8)
            
            # Note: Label 0 is the background (everything that is NOT a window), so we skip it.
            if num_labels > 1:
                # stats structure: [left, top, width, height, area]
                # We take the area (index 4) for all labels starting from 1
                all_areas = stats[1:, cv2.CC_STAT_AREA]
                
                if len(all_areas) > 0:

                    avg_size_px = np.mean(all_areas)
                    min_size_px = np.min(all_areas)
                    max_size_px = np.max(all_areas)
                    
                    print(f"Window Size Analysis:")
                    print(f"  Count: {len(all_areas)} windows detected")
                    print(f"  Average Size: {avg_size_px:.1f} px")
                    print(f"  Min Size: {min_size_px} px")
                    print(f"  Max Size: {max_size_px} px")
                else:
                    print("Window Size Analysis: Only noise detected (all components < 10px).")
            else:
                print("Window Size Analysis: No windows detected.")
        else:
            print("WARNING: Could not analyze: 'window' or 'building' class ID missing in config.")

        # Initialize window count
        window_count = 0
        if 'all_areas' in locals() and all_areas is not None:
            window_count = len(all_areas)

        # Insert WWR & window count into database
        results = _get_aufmass_objects(ID_LOD2, "facade", ids={"facade_id": str(facade_id)}, access_token=access_token)
        
        if results:
            # Convert dictionary result to Facade dataclass instance
            facade_data = results[0]
            # Filter out fields that are not in the Facade dataclass (like 'user_id' or database-specific 'id')
            facade_obj = Facade(**{k: v for k, v in facade_data.items() if k in Facade.__dataclass_fields__})
        else:
            # Fallback: create a new Facade object if not found
            facade_obj = Facade(ID_LOD2=ID_LOD2, facade_id=str(facade_id))

        facade_obj.wwr = wwr
        facade_obj.window_count = window_count
        _insert_aufmass_object(facade_obj, access_token)
        print(f"Updated database with WWR and window count for Facade {facade_id}: WWR={wwr:.2%}, Window Count={window_count}")
        
    except Exception as e:
        print(f"Error during analysis: {e}")
        traceback.print_exc()
