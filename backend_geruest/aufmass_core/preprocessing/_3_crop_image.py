from aufmass_core.database_download_functions import _get_facade_image, _get_aufmass_objects
from aufmass_core.database_upload_functions import _upload_facade_image
from aufmass_core.datastructure.aufmassClasses import FacadeImage
from aufmass_core.helpers.mask_utils import decode_rle_binary, clean_facade_mask_closing_only
from PIL import Image
import numpy as np
from io import BytesIO


def load_mask_from_db(ID_LOD2: str, facade_id: str, tags: list[str], access_token: str) -> np.ndarray:
    """
    Loads a segmentation mask from the database.
    
    Args:
        ID_LOD2: Building ID
        facade_id: Facade ID
        tags: Tags to filter masks (e.g., ["facade_unprocessed"])
        access_token: User access token
        
    Returns:
        np.ndarray: Mask array [H, W] with 0/1 values
        
    Raises:
        ValueError: If no mask is found or mask is invalid
    """
    ids = {"facade_id": facade_id}
    results = _get_aufmass_objects(ID_LOD2, "segmentation_mask", ids=ids, tags=tags, access_token=access_token)
    
    if not results or len(results) == 0:
        raise ValueError(f"No segmentation mask found for {ID_LOD2}/{facade_id} with tags {tags}")
    
    # Take first mask
    mask_record = results[0]
    mask_data = mask_record.get("mask")
    
    if not mask_data:
        raise ValueError(f"No mask data found in database for {ID_LOD2}/{facade_id}")
    
    # Parse mask_data if it's a JSON string
    import json
    if isinstance(mask_data, str):
        mask_data = json.loads(mask_data)
    
    # Handle RLE format (Preferred)
    if "rle" in mask_data:
        mask_array = decode_rle_binary(mask_data["rle"])
        
    # Handle Legacy format (List of lists)
    elif "mask" in mask_data:
        mask_array = np.array(mask_data["mask"], dtype=np.uint8)
    else:
        raise ValueError(f"Invalid mask format in database for {ID_LOD2}/{facade_id}. Expected 'rle' or 'mask' key.")
    
    # Remove batch dimension if present (SAM3 returns [1, H, W])
    if mask_array.ndim == 3 and mask_array.shape[0] == 1:
        mask_array = mask_array.squeeze(0)
    
    return mask_array


def get_bounding_box_from_mask(mask: np.ndarray) -> tuple[int, int, int, int]:
    """
    Calculates the bounding box of a binary mask.
    
    Args:
        mask: Binary mask array [H, W] with 0/1 values
        
    Returns:
        tuple: (x1, y1, x2, y2) bounding box coordinates
        
    Raises:
        ValueError: If mask is empty (all zeros)
    """
    # Ensure mask is 2D
    if mask.ndim == 3:
        if mask.shape[0] == 1:
            mask = mask.squeeze(0)
        else:
            raise ValueError(f"Expected 2D mask, got shape {mask.shape}")
    
    rows, cols = np.where(mask > 0)
    
    if len(rows) == 0:
        raise ValueError("Empty mask - no pixels marked as facade")
    
    y1, y2 = rows.min(), rows.max() + 1
    x1, x2 = cols.min(), cols.max() + 1
    
    return (x1, y1, x2, y2)


def crop_image(ID_LOD2: str, facade_id: str, access_token: str):
    '''
    Crops the lens-corrected image to the size of the main facade (convex hull/rectangle of the facade mask).
    AND masks out the background (sets everything outside the mask to black).
    
    Uses ID_LOD2 and facade_id to obtain the lens-corrected image from the database (tag: "lens_corrected") and the mask with the main facade (tag: "facade_unprocessed").
    Crops the image to the size of the main facade and uploads the cropped image to the database (tag: "cropped").
    Returns nothing, but updates the database.
    '''
    # 1. Load lens-corrected image from database
    image_bytes = _get_facade_image(ID_LOD2, facade_id, tags=["lens_corrected"], access_token=access_token)
    if not image_bytes:
        print(f"No lens-corrected image found for {ID_LOD2}/{facade_id}. Using original photo instead.")
        image_bytes = _get_facade_image(ID_LOD2, facade_id, tags=["photo"], access_token=access_token)
        if not image_bytes:
            raise ValueError(f"No image found for {ID_LOD2}/{facade_id} to perform facade segmentation.")
    
    image = Image.open(BytesIO(image_bytes))
    
    # 2. Load segmentation mask from database
    mask_array = load_mask_from_db(ID_LOD2, facade_id, tags=["facade_unprocessed"], access_token=access_token)
    
    # DEBUG: Check loaded mask area
    loaded_area = np.sum(mask_array > 0)
    print(f"[DEBUG] Loaded mask from DB. Area: {loaded_area} pixels")
    
    # --- CLEANUP: Fill holes and connect isolated areas (e.g., rain gutters) ---
    # Morphological closing: fills holes and connects nearby isolated regions
    # HINWEIS: 3% Kernel kann Ränder verändern - akzeptabel für Preprocessing
    mask_array = clean_facade_mask_closing_only(
        mask_array,
        close_kernel_size=0.03  # 3% der Bildbreite - verbindet auch weiter entfernte Bereiche wie Regenrinnen
    )
    
    # 3. Apply Mask (Background Removal)
    image_np = np.array(image)
    
    # Ensure mask matches image dimensions
    if mask_array.shape != image_np.shape[:2]:
        print(f"WARNING: Mask shape {mask_array.shape} does not match image shape {image_np.shape[:2]}. Resizing mask.")
        # Simple resize of mask to match image (nearest neighbor to keep 0/1)
        from PIL import Image as PILImage
        mask_pil = PILImage.fromarray(mask_array)
        mask_pil = mask_pil.resize((image_np.shape[1], image_np.shape[0]), resample=PILImage.NEAREST)
        mask_array = np.array(mask_pil)

    # Create 3-channel mask for RGB image
    if image_np.ndim == 3 and mask_array.ndim == 2:
        mask_3d = np.stack([mask_array] * image_np.shape[2], axis=-1)
    else:
        mask_3d = mask_array
        
    # Apply mask: Keep pixels where mask is 1, set others to 0 (Black)
    # mask_array is 0/1.
    masked_image_np = np.where(mask_3d > 0, image_np, 0).astype(np.uint8)

    # 4. Calculate bounding box from mask
    bbox = get_bounding_box_from_mask(mask_array)
    x1, y1, x2, y2 = bbox
    
    # 5. Crop image (no scaling or distortion)
    # Slice numpy array: [y1:y2, x1:x2]
    cropped_image_np = masked_image_np[y1:y2, x1:x2]
    cropped_image = Image.fromarray(cropped_image_np)
    
    # 6. Convert cropped image to bytes
    output_buffer = BytesIO()
    # Convert RGBA to RGB if necessary (JPEG doesn't support transparency)
    if cropped_image.mode == 'RGBA':
        rgb_image = Image.new('RGB', cropped_image.size, (255, 255, 255))
        rgb_image.paste(cropped_image, mask=cropped_image.split()[3])
        rgb_image.save(output_buffer, format='JPEG', quality=95)
    else:
        cropped_image.save(output_buffer, format='JPEG', quality=95)
    cropped_bytes = output_buffer.getvalue()
    
    # 7. Create FacadeImage object
    facade_image = FacadeImage(
        ID_LOD2=ID_LOD2,
        facade_id=facade_id,
        tags=["cropped"],
        width=cropped_image.width,
        height=cropped_image.height,
        size_bytes=len(cropped_bytes)
    )
    
    # 7. Upload to database
    _upload_facade_image(facade_image, cropped_bytes, access_token=access_token, content_type="image/jpeg")
    
    print(f"[SUCCESS] Image cropped for {ID_LOD2}/{facade_id}")
    print(f"  Original size: {image.width}x{image.height}")
    print(f"  Cropped size: {cropped_image.width}x{cropped_image.height}")
    print(f"  Bounding box: {bbox}")