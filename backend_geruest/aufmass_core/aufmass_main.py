import sys
import os
import numpy as np

# Add backend directory to sys.path so 'aufmass_core' can be imported. Only needed for testing purposes.
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Add sam3 module to path so it can be imported as a top-level module
sam3_path = os.path.join(os.path.dirname(__file__), 'models', 'sam3')
if sam3_path not in sys.path:
    sys.path.insert(0, sam3_path)

from aufmass_core.database_download_functions import _get_aufmass_objects, _get_facade_image
from aufmass_core.database_upload_functions import _insert_aufmass_object
from aufmass_core.datastructure.aufmassClasses import *
from dataclasses import fields
from aufmass_core.preprocessing._1_lens_correction import lens_correction
from aufmass_core.preprocessing._2_identify_main_facade_sam3 import identify_main_facade
from aufmass_core.preprocessing._3_crop_image import crop_image
from aufmass_core.preprocessing._4_0_rectify_image_automated import rectify_image
# from aufmass_core.preprocessing._4_1_fallback_manual_rectify_image import rectify_image  # Manuelle Logik (nicht verwendet)
from aufmass_core.preprocessing._5_identify_obscuring_elements import identify_obscuring_elements
from aufmass_core.preprocessing._6_generative_completion import generative_completion
from aufmass_core.mainprocessing._7_main_segmentation import main_segmentation
from aufmass_core.helpers.mask_utils import decode_rle_int
from aufmass_core.postprocessing._7_2_simple_statistics import analyze_segmentation_results
from aufmass_core.postprocessing._7_3_create_segmentation_overlay import create_segmentation_overlay
from aufmass_core.postprocessing._7_1_filter_mask import filter_segmentation_mask

def aufmass_main(ID_LOD2: str, access_token: str, execution_mode: str = "server"):
    """
    Manages the steps ofthe building measurement process (Gebäudeaufmass).
    Only needs ID_LOD2 to clearly identify the building and  the access token for RLS compliance.
    The function retrieves how many facades are referencing the building and starts the measurement process for each facade.
    Calls step by step the pre-, main- and post-processing functions for each facade.
    Does not return anything, but updates the database with the measurement results.
    
    Args:
        ID_LOD2: Building identifier
        access_token: Access token for RLS compliance
        execution_mode: Execution mode - "server" (default) or "local". 
                       If "local", visualization functions will be used, otherwise not.
    """

    # 0. Get all facades for the building from the database and turn them into Facade objects. Start the measurement process for each facade.
    facades_data = _get_aufmass_objects(ID_LOD2, "facade", access_token=access_token)
    
    valid_fields = {f.name for f in fields(Facade)}
    facades: list[Facade] = []
    
    # Filter facades to only include those that have a photo
    for facade_data in facades_data:
        # Check if facade has a photo with the "photo" tag
        photo_image = _get_facade_image(ID_LOD2, facade_data.get('facade_id'), ["photo"], access_token)
        
        if photo_image is not None:
            facade_obj = Facade(**{k: v for k, v in facade_data.items() if k in valid_fields})
            facades.append(facade_obj)
            print(f"Facade {facade_data.get('facade_id')} has a photo. Adding to processing queue.")
        else:
            print(f"Facade {facade_data.get('facade_id')} has no photo. Skipping.")

    print(f"Found {len(facades)} facades with photos for building {ID_LOD2}. Processing each facade...")
    for facade in facades:
        ################# Preprocessing Steps #####################
        # 1. Lens Correction -> saved to db
        lens_correction(ID_LOD2, facade.facade_id, access_token)
        
        # 2. Identify Main Facade
        identify_main_facade(ID_LOD2, facade.facade_id, access_token, execution_mode=execution_mode)
        
        # 3. Crop Image -> saved to db
        crop_image(ID_LOD2, facade.facade_id, access_token)
        
        # 4. Rectify Image
        rectify_image(ID_LOD2, facade.facade_id, access_token)
        
        # 5. Identify Obscuring Elements - not active for now
        # identify_obscuring_elements(ID_LOD2, facade.facade_id, access_token)
        
        # 6. Generative Completion - not active for now
        # generative_completion(ID_LOD2, facade.facade_id, access_token)
        
        ################# Main Processing Steps #####################
        # 7. Main Segmentation (Return raw batch results meaning binary masks for each class, includes class_mappings, no upload)
        elem_pred, config = main_segmentation(ID_LOD2, facade.facade_id, access_token)

        # 7.1 Filter out Artifacts & unwanted Elements (upload to db)
        elem_pred_filtered = filter_segmentation_mask(ID_LOD2, elem_pred, config, facade.facade_id, access_token, execution_mode=execution_mode)
        
        # 7.2 --- Analysis via _7_2_simple_statistics ---
        # Show the segmentation mask in a transparent mode on the pre-processed input image; transparent_segmentation_overlay
        if elem_pred_filtered is not None:
            analyze_segmentation_results(ID_LOD2, elem_pred_filtered, config, facade.facade_id, access_token)
        
        # --- Create Segmentation Overlay Image ---
        # Creates a transparent overlay of the segmentation mask on the rectified image
        if elem_pred_filtered is not None:
            create_segmentation_overlay(ID_LOD2, facade.facade_id, elem_pred_filtered, access_token, alpha=0.3, execution_mode=execution_mode)
        
        ################# Post Processing Steps #####################
        # 8. Get Reference Scale - possibly takes place in the frontend

        # 9. Polygon Element matching
        # --- NEU: Visualisierung des Post-Processings (Schritt 9 Preview) ---
        # print("\n--- Starting Post-Processing Preview ---")
        
        # # 1. Maske laden
        # masks = _get_aufmass_objects(ID_LOD2, "segmentation_mask", ids={"facade_id": facade.facade_id}, access_token=access_token)
        # raw_mask_obj = next((m for m in masks if m.get('tags') and "raw_segmentation" in m['tags']), None)
        
        # if raw_mask_obj:
        #     print("Found raw segmentation mask. Decoding...")
        #     # Zugriff auf das Dictionary (da _get_aufmass_objects dicts liefert)
        #     mask_data = raw_mask_obj.get('mask')
            
        #     # Parse JSON if string
        #     if isinstance(mask_data, str):
        #         import json
        #         mask_data = json.loads(mask_data)
            
        #     if "elements" in mask_data and "rle_int" in mask_data["elements"]:
        #         rle_data = mask_data["elements"]["rle_int"]
        #         mask_array = decode_rle_int(rle_data)
                
        #         # 2. Post-Processor importieren
        #         sys.path.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "wattwert_only_mtl", "scripts"))
        #         from segmentation_postprocessor_simple import SimpleSemanticPostProcessor
                
        #         # 3. Verarbeiten & Anzeigen
        #         processor = SimpleSemanticPostProcessor()
        #         # Wir mappen die Klassen-IDs auf das, was der Processor erwartet (falls nötig)
        #         # Hier gehen wir davon aus, dass 1=Fenster, 2=Fassade passt.
        #         processor.process_mask(mask_array, visualize=True)
                
        #     else:
        #         print("Mask data format not recognized.")
        # else:
        #     print("No raw segmentation mask found for visualization.")
        # -------------------------------------------------------------------
        # 8. Get Reference Scale - possibly takes place in the frontend

        # 9. Polygon Element matching


def aufmass_testmodule(ID_LOD2: str, access_token: str, execution_mode: str = "local"):
    '''
    Test one single module from the aufmass_core package.
    
    Args:
        ID_LOD2: Building identifier
        access_token: Access token for RLS compliance
        execution_mode: Execution mode - "local" (default for testing) or "server". 
                       If "local", visualization functions will be used, otherwise not.
    '''
    facade_id = 5
    
    # Testing step: Load from file if it exists, otherwise run segmentation and save
    save_path = os.path.join(os.path.dirname(__file__), f"elem_pred_{facade_id}.npy")
    config_save_path = os.path.join(os.path.dirname(__file__), f"config_{facade_id}.npy")
    
    if os.path.exists(save_path) and os.path.exists(config_save_path):
        print(f"DEBUG: Loading elem_pred and config from files for testing")
        print(f"  elem_pred: {save_path}")
        print(f"  config: {config_save_path}")
        # Load dictionary properly (need .item() if saved as object)
        elem_pred_raw = np.load(save_path, allow_pickle=True)
        if elem_pred_raw.ndim == 0 and elem_pred_raw.dtype == object:
             elem_pred = elem_pred_raw.item()
        else:
             elem_pred = elem_pred_raw
        
        config = np.load(config_save_path, allow_pickle=True).item()
        print(f"DEBUG: Loaded config class mappings: {config.get('class_mappings', {}).get('elements', {})}")
    else:
        print(f"DEBUG: No test files found. Running main_segmentation and saving results.")
        elem_pred, config = main_segmentation(ID_LOD2, facade_id, access_token)
        if elem_pred is not None:
            np.save(save_path, elem_pred)
            np.save(config_save_path, config)
            print(f"DEBUG: Saved elem_pred to {save_path}")
            print(f"DEBUG: Saved config to {config_save_path}")
    
    if elem_pred is None or config is None:
        print("ERROR: Failed to get segmentation data")
        return
    
    # 7.1 Filter out Artifacts & unwanted Elements
    elem_pred_filtered = filter_segmentation_mask(ID_LOD2, elem_pred, config, facade_id, access_token, execution_mode=execution_mode)
    
    # 7.2 --- Analysis via _7_2_simple_statistics ---
    # Show the segmentation mask in a transparent mode on the pre-processed input image; transparent_segmentation_overlay
    analyze_segmentation_results(ID_LOD2, elem_pred_filtered, config, facade_id, access_token)
    
    # --- Create Segmentation Overlay Image ---
    # Creates a transparent overlay of the segmentation mask on the rectified image
    if elem_pred_filtered is not None:
        create_segmentation_overlay(ID_LOD2, facade_id, elem_pred_filtered, access_token, alpha=0.3, execution_mode=execution_mode)
