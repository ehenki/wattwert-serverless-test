import os
import torch
import tempfile
import numpy as np
import uuid
import cv2
import time

# SAM3 Import - Zentraler Cache
from aufmass_core.models.sam3_model_cache import get_sam3_segmenter

# Importe für Datenbank
from aufmass_core.database_download_functions import _get_facade_image
from aufmass_core.database_upload_functions import _insert_aufmass_object
from aufmass_core.database_download_functions import _get_aufmass_objects
from aufmass_core.datastructure.aufmassClasses import SegmentationMask
from aufmass_core.helpers.mask_utils import mask_to_jsonb, merge_layers, get_shape_from_batch_results

def _get_config():
    """
    Erstellt eine Config-Struktur analog zu MTL für Postprocessing-Kompatibilität.
    """
    return {
        "class_mappings": {
            "elements": {
                "background": 0,
                "building": 1,  # Facade/Wall
                "window": 2,
                "door": 3,
                "roof": 4
            }
        }
    }

def _save_raw_segmentation_mask(raw_pred, ID_LOD2, facade_id, access_token):
    """Saves the raw (merged) segmentation mask to database before filtering."""
    # Convert mask to JSONB format
    mask_jsonb = mask_to_jsonb(raw_pred)
    
    # Check if mask already exists to update it instead of creating a new one
    existing_masks = _get_aufmass_objects(ID_LOD2, "segmentation_mask", ids={"facade_id": facade_id}, tags=["raw_segmentation"], access_token=access_token)
    
    if existing_masks:
        mask_id = existing_masks[0]["mask_id"]
        print(f"[INFO] Updating existing raw_segmentation mask {mask_id}")
    else:
        mask_id = str(uuid.uuid4())
        print(f"[INFO] Creating new raw_segmentation mask {mask_id}")
    
    raw_segmentation_mask = SegmentationMask(
        ID_LOD2=ID_LOD2,
        facade_id=facade_id,
        mask_id=mask_id,
        tags=["raw_segmentation"],
        mask=mask_jsonb
    )
    
    _insert_aufmass_object(raw_segmentation_mask, access_token)


def main_segmentation(ID_LOD2: str, facade_id: str, access_token: str):
    '''
    The main segmentation process that identifies all facade elements using SAM3 after all preprocessing steps.
    Uses ID_LOD2 and facade_id to obtain the rectified image.
    Returns the raw batch results from SAM3 and config. 
    The merging and cleaning is now handled in postprocessing.
    '''
    print(f"Starting SAM3 main segmentation for {ID_LOD2}, facade {facade_id}")
    
    # Gesamt-Zeit-Tracking
    total_start = time.time()

    # 1. Bild laden (unobscured oder rectified)
    image_content = _get_facade_image(ID_LOD2, facade_id, ["unobscured"], access_token)
    
    if not image_content:
        print("No unobscured image found. Trying fallback to 'rectified'...")
        image_content = _get_facade_image(ID_LOD2, facade_id, ["rectified"], access_token)
        
    if not image_content:
        print("No suitable image (unobscured or rectified) found.")
        return None, None

    # Temporär speichern für SAM3 Inferenz
    with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as temp_file:
        temp_file.write(image_content)
        temp_image_path = temp_file.name

    try:
        # 2. SAM3 Segmenter holen (Cached)
        segmenter = get_sam3_segmenter()
        config = _get_config()
        
        # 3. Bild-Dimensionen ermitteln
        nparr = np.frombuffer(image_content, np.uint8)
        img_cv = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img_cv is None:
            print("Error: Could not decode image.")
            return None, None
            
        img_h, img_w = img_cv.shape[:2]
        print(f"Image dimensions: {img_w}x{img_h}")

        # 4. SAM3 Inferenz für alle Klassen
        print("[SAM3] Segmenting all classes in batch (facade, window, door, roof)...")
        prompts = ["facade", "window", "door", "roof"]
        
        # Zeit-Tracking starten
        start_time = time.time()
        
        batch_results = segmenter.segment_batch(
            temp_image_path,
            prompts=prompts,
            score_threshold=0.3
        )
        
        # Zeit-Tracking beenden
        inference_time = time.time() - start_time
        
        print(f"[SAM3] Batch segmentation completed in {inference_time:.2f} seconds!")
        
        # 5. Merge raw results to semantic map (without cleaning) and save as raw_segmentation
        class_mappings_dict = config.get('class_mappings', {}).get('elements', {})
        
        # Determine shape from batch results (fallback if img_h/img_w not available)
        shape = get_shape_from_batch_results(batch_results)
        if shape is None:
            shape = (img_h, img_w)  # Use dimensions from image if batch results don't provide shape
        else:
            img_h, img_w = shape  # Update to match batch results shape
        
        raw_pred = merge_layers(batch_results, shape, class_mappings_dict, cleaning_config=None)
        
        if raw_pred is not None:
            _save_raw_segmentation_mask(raw_pred, ID_LOD2, facade_id, access_token)
        else:
            print("Warning: Could not create raw_segmentation mask from batch results.")
        
        # Gesamt-Zeit ausgeben
        total_time = time.time() - total_start
        print(f"\n=== TIMING SUMMARY ===")
        print(f"SAM3 Inference (batch):  {inference_time:.2f}s ({inference_time/total_time*100:.1f}%)")
        print(f"Total Processing Time:   {total_time:.2f}s")
        print(f"======================\n")
        
        # Return raw batch results
        return batch_results, config
            
    except Exception as e:
        print(f"Error during segmentation: {e}")
        import traceback
        traceback.print_exc()
        return None, None
            
    finally:
        if os.path.exists(temp_image_path):
            os.remove(temp_image_path)
