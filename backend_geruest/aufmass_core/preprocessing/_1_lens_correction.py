
"""Lens Distortion Correction using Lensfun Database.

This module performs lens distortion correction (undistortion) on images
by extracting camera parameters from EXIF data and using the Lensfun database.

Workflow:
1. Extract EXIF data (camera model, focal length, etc.)
2. Query Lensfun database for calibration parameters
3. If not found: estimate parameters as fallback
4. Apply undistortion using OpenCV
5. Save corrected image with metadata in EXIF

References
----------
1. OpenCV Camera Calibration:
   https://docs.opencv.org/4.x/dc/dbb/tutorial_py_calibration.html
2. Lensfun Database:
   https://lensfun.github.io/
"""

import cv2
import numpy as np
import os
import sys
import json
import logging
from pathlib import Path
from PIL import Image
from PIL.ExifTags import TAGS

from aufmass_core.preprocessing._0_helper_lensfun import (
    CalibrationSource,
    is_lensfun_available,
    query_lensfun_database,
    undistort_image_lensfun,
    get_lensfun_correction_metadata,
    print_lensfun_correction_report
)

# Database imports (only used in lens_correction(), not in CLI)
try:
    from aufmass_core.database_download_functions import _get_facade_image, _get_aufmass_objects
    from aufmass_core.database_upload_functions import _insert_aufmass_object, _upload_facade_image
    from aufmass_core.datastructure.aufmassClasses import *
    from Supabase_database.client import get_user_client
    import requests
    import tempfile
except ImportError:
    # Allow CLI usage without full backend setup
    pass

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)


def lens_correction(ID_LOD2: str, facade_id: str, access_token: str):
    '''
    Lens correction for the facade images.
    Takes the original facade image (tag: "photo") and corrects the lens distortion.
    Uploads the corrected image to the database with tag "lens_corrected".
    Returns nothing, but updates the database.
    '''
    # 1. Get the original facade image bytes
    original_image_bytes = _get_facade_image(ID_LOD2, facade_id, tags=["photo"], access_token=access_token)
    if not original_image_bytes:
        logging.error(f"No original facade image found for facade {facade_id} of building {ID_LOD2}")
        return

    # 2. Extract EXIF data directly from bytes
    try:
        camera_info = get_camera_info(original_image_bytes)
        print_camera_info(camera_info)
    except ValueError as e:
        logging.error(f"Cannot perform lens correction: {e}")
        return
    
    # 3. Load image directly from bytes
    nparr = np.frombuffer(original_image_bytes, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if image is None:
        logging.error(f"Failed to decode image from bytes")
        return
    
    h, w = image.shape[:2]
    logging.info(f"Loaded image: {w}x{h}")
    
    # 4. Try Lensfun database first
    lensfun_data = None
    
    if is_lensfun_available():
        lensfun_data = query_lensfun_database(
            camera_info['Make'],
            camera_info['Model'],
            camera_info['LensModel'],
            camera_info.get('FocalLength'),
            w, h
        )
    
    # 5. Apply lens correction
    if lensfun_data:
        logging.info("Using Lensfun database for correction")
        undistorted = undistort_image_lensfun(image, lensfun_data['modifier'])
        metadata = get_lensfun_correction_metadata(lensfun_data, camera_info)
        metadata_text = metadata['metadata_text']
    else:
        logging.warning("Lensfun database match not found - using parameter estimation")
        logging.warning("⚠️  Estimated parameters may be inaccurate for metric measurements!")
        
        # Estimate parameters as fallback (smartphone-optimized)
        focal_length_35mm = camera_info.get('FocalLength35mm')
        focal_length_mm = camera_info.get('FocalLength')
        camera_matrix, dist_coeffs = estimate_camera_parameters(
            image.shape, focal_length_mm, focal_length_35mm
        )
        
        # Apply undistortion using OpenCV
        logging.info("Applying lens distortion correction...")
        undistorted = undistort_image_opencv(image, camera_matrix, dist_coeffs)
        
        metadata_text = (f"Lens correction: {CalibrationSource.ESTIMATED.value} | "
                        f"Camera: {camera_info['Make']} {camera_info['Model']} | "
                        f"Accuracy: ±5-10% | "
                        f"⚠️ NOT suitable for precise metric measurements")
    
    # Print correction report
    print_lensfun_correction_report(lensfun_data)
    
    # 6. Convert corrected image back to bytes
    encode_param = [int(cv2.IMWRITE_JPEG_QUALITY), 95]
    success, buffer = cv2.imencode('.jpg', undistorted, encode_param)
    
    if not success:
        logging.error("Failed to encode corrected image")
        return
    
    corrected_image_bytes = buffer.tobytes()
    
    # 7. Create a new FacadeImage object with the corrected image
    corrected_image_obj = FacadeImage(
        ID_LOD2=ID_LOD2,
        facade_id=facade_id,
        tags=["lens_corrected"],
        title=f"Lens corrected Image ({metadata_text})"
    )

    # 8. Upload the corrected image
    _upload_facade_image(corrected_image_obj, corrected_image_bytes, access_token, content_type="image/jpeg")
    
    logging.info(f"✓ Lens correction completed successfully for facade {facade_id}")

    return



def extract_exif_data(image_bytes):
    """Extract EXIF data from image bytes.
    
    Parameters
    ----------
    image_bytes : bytes
        Image data as bytes
        
    Returns
    -------
    exif_dict : dict
        Dictionary with EXIF data, empty if none found
    """
    try:
        from io import BytesIO
        img = Image.open(BytesIO(image_bytes))
        exif_data = img._getexif()
        
        if exif_data is None:
            logging.warning("No EXIF data found in image")
            return {}
        
        exif_dict = {}
        for tag_id, value in exif_data.items():
            tag = TAGS.get(tag_id, tag_id)
            exif_dict[tag] = value
        
        return exif_dict
    
    except Exception as e:
        logging.error(f"Error reading EXIF data: {e}")
        return {}


def get_camera_info(image_bytes):
    """Extract camera information from EXIF data.
    
    Parameters
    ----------
    image_bytes : bytes
        Image data as bytes
        
    Returns
    -------
    info : dict
        Dictionary with camera make, model, lens info, etc.
        
    Raises
    ------
    ValueError
        If no EXIF data found in image
    """
    exif = extract_exif_data(image_bytes)
    
    if not exif:
        raise ValueError("No EXIF data found in image. "
                        "EXIF data is required for lens correction.")
    
    info = {
        'Make': str(exif.get('Make', 'Unknown')).strip(),
        'Model': str(exif.get('Model', 'Unknown')).strip(),
        'LensModel': str(exif.get('LensModel', 'Unknown')).strip(),
        'FocalLength': None,
        'FocalLength35mm': exif.get('FocalLengthIn35mmFilm'),
        'FNumber': None,
        'ISO': exif.get('ISOSpeedRatings'),
        'ImageWidth': exif.get('ExifImageWidth'),
        'ImageHeight': exif.get('ExifImageHeight'),
        'DateTime': exif.get('DateTime'),
    }
    
    # Process FocalLength (often stored as tuple)
    focal = exif.get('FocalLength')
    if focal:
        if isinstance(focal, tuple):
            info['FocalLength'] = focal[0] / focal[1] if focal[1] != 0 else None
        else:
            info['FocalLength'] = float(focal)
    
    # Process FNumber
    fnumber = exif.get('FNumber')
    if fnumber:
        if isinstance(fnumber, tuple):
            info['FNumber'] = fnumber[0] / fnumber[1] if fnumber[1] != 0 else None
        else:
            info['FNumber'] = float(fnumber)
    
    return info


def get_camera_model_string(camera_info):
    """Create camera model string from camera info.
    
    Parameters
    ----------
    camera_info : dict
        Camera information dictionary
        
    Returns
    -------
    model_string : str
        Full camera model string (Make + Model)
    """
    make = camera_info.get('Make', '').strip()
    model = camera_info.get('Model', '').strip()
    
    if make and model:
        return f"{make} {model}"
    elif model:
        return model
    else:
        return "Unknown"


def print_camera_info(camera_info):
    """Print camera information in a readable format.
    
    Parameters
    ----------
    camera_info : dict
        Camera information dictionary
    """
    logging.info("=" * 60)
    logging.info("Camera Information (from EXIF):")
    logging.info(f"  Make:         {camera_info['Make']}")
    logging.info(f"  Model:        {camera_info['Model']}")
    logging.info(f"  Lens:         {camera_info['LensModel']}")
    
    if camera_info['FocalLength']:
        logging.info(f"  Focal Length: {camera_info['FocalLength']:.1f}mm")
    if camera_info['FocalLength35mm']:
        logging.info(f"  Focal (35mm): {camera_info['FocalLength35mm']}mm")
    if camera_info['FNumber']:
        logging.info(f"  Aperture:     f/{camera_info['FNumber']:.1f}")
    if camera_info['ISO']:
        logging.info(f"  ISO:          {camera_info['ISO']}")
    if camera_info['ImageWidth'] and camera_info['ImageHeight']:
        logging.info(f"  Image Size:   {camera_info['ImageWidth']}x{camera_info['ImageHeight']}")
    if camera_info['DateTime']:
        logging.info(f"  Date/Time:    {camera_info['DateTime']}")
    logging.info("=" * 60)


def estimate_camera_parameters(image_shape, focal_length_mm=None, focal_length_35mm=None):
    """Estimate camera parameters for smartphones when exact calibration is not available.
    
    IMPROVED STRATEGY:
    Modern smartphones often apply internal lens correction to JPEGs before saving.
    Applying aggressive generic correction on top of that often introduces NEW distortion
    (pincushion) or excessive cropping.
    
    This fallback now uses a "Safe Mode" approach:
    1. Assume the image is mostly rectilinear (standard smartphone JPEG).
    2. Apply only minimal correction unless we are sure about the raw focal length.
    3. Prioritize preserving image content over geometric perfection.
    
    Parameters
    ----------
    image_shape : tuple
        (height, width, channels) or (height, width) of the image
    focal_length_mm : float, optional
        Physical focal length in mm from EXIF
    focal_length_35mm : float, optional
        35mm equivalent focal length from EXIF
        
    Returns
    -------
    camera_matrix : ndarray
        3x3 camera matrix
    dist_coeffs : ndarray
        Distortion coefficients [k1, k2, p1, p2, k3]
    """
    height, width = image_shape[:2]
    
    # Principal point at image center
    cx = width / 2.0
    cy = height / 2.0
    
    # Estimate focal length in pixels
    if focal_length_35mm:
        # Formula: fx = (focal_35mm / 36.0) * width  (Approximation based on width, safer than diagonal)
        # 35mm film width is 36mm.
        fx = fy = (focal_length_35mm / 36.0) * width
        
        logging.info(f"Estimated focal length: {fx:.1f} pixels (from {focal_length_35mm}mm equiv.)")
        
    elif focal_length_mm:
        # Fallback with generic sensor width assumption (approx 6.17mm for 1/2.3" sensor)
        # This is very risky as sensor sizes vary wildly.
        sensor_width_mm = 6.17 
        fx = fy = (focal_length_mm / sensor_width_mm) * width
        logging.info(f"Estimated focal length: {fx:.1f} pixels (physical)")
        
    else:
        # Generic wide angle assumption (approx 28mm equiv)
        # fx approx 0.8 * width
        fx = fy = 0.8 * width
        logging.warning("No focal length found, assuming generic wide angle.")
    
    camera_matrix = np.array([
        [fx,  0, cx],
        [ 0, fy, cy],
        [ 0,  0,  1]
    ], dtype=np.float64)
    
    # IMPROVED DISTORTION COEFFICIENTS
    # Instead of assuming strong barrel distortion (-0.08), we assume
    # the image is likely already processed by the phone or has a high quality lens.
    # We use very mild coefficients to avoid "over-correcting" into pincushion distortion.
    
    dist_coeffs = np.array([
        0.0,   # k1: Assume ZERO distortion by default for unknown cameras (safest bet)
        0.0,   # k2
        0.0,   # p1
        0.0,   # p2
        0.0    # k3
    ], dtype=np.float64)
    
    # Only if we are VERY sure it's a wide angle without internal correction might we add k1.
    # But for a general fallback, 0.0 is much safer than -0.08.
    # If the user specifically wants to force correction, they should add the camera to Lensfun.

    logging.warning("="*60)
    logging.warning("Using FALLBACK parameters (Safe Mode)")
    logging.warning("Assuming image is already rectified or has low distortion.")
    logging.warning("Distortion coefficients set to 0 to prevent artifacts.")
    logging.warning("="*60)
    
    return camera_matrix, dist_coeffs


def undistort_image_opencv(image, camera_matrix, dist_coeffs, optimal_camera_matrix=True):
    """Apply lens distortion correction using OpenCV (for estimated parameters).
    
    Parameters
    ----------
    image : ndarray
        Input image (BGR or RGB)
    camera_matrix : ndarray
        3x3 camera matrix
    dist_coeffs : ndarray
        Distortion coefficients [k1, k2, p1, p2, k3]
    optimal_camera_matrix : bool
        If True, refine camera matrix to maximize useful image area
        
    Returns
    -------
    undistorted : ndarray
        Undistorted image
    """
    h, w = image.shape[:2]
    
    if optimal_camera_matrix:
        # Get optimal new camera matrix
        new_camera_matrix, roi = cv2.getOptimalNewCameraMatrix(
            camera_matrix, dist_coeffs, (w, h), 1, (w, h)
        )
        
        # Undistort
        undistorted = cv2.undistort(
            image, camera_matrix, dist_coeffs, None, new_camera_matrix
        )
        
        # Crop to ROI (region of interest)
        x, y, w_roi, h_roi = roi
        if w_roi > 0 and h_roi > 0:
            undistorted = undistorted[y:y+h_roi, x:x+w_roi]
            logging.info(f"Image cropped to ROI: {w_roi}x{h_roi}")
    else:
        # Simple undistortion without refinement
        undistorted = cv2.undistort(image, camera_matrix, dist_coeffs)
    
    return undistorted








def main():
    """Minimal CLI for testing lens correction with local files."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description='Lens Distortion Correction - Test Tool',
        epilog="Example: python _1_lens_correction.py image.jpg -o corrected.jpg"
    )
    
    parser.add_argument('image', help='Path to input image')
    parser.add_argument('-o', '--output', help='Path to output image (default: <input>_corrected.jpg)')
    
    args = parser.parse_args()
    
    if not is_lensfun_available():
        logging.warning("lensfunpy not installed - only parameter estimation available")
    
    try:
        # 1. Load image file as bytes
        with open(args.image, 'rb') as f:
            image_bytes = f.read()
        
        # 2. Extract EXIF from bytes (optional for CLI)
        try:
            camera_info = get_camera_info(image_bytes)
            print_camera_info(camera_info)
        except ValueError:
            logging.warning("No EXIF data found - using generic camera assumptions")
            camera_info = {
                'Make': 'Generic',
                'Model': 'Unknown Camera',
                'LensModel': 'Unknown',
                'FocalLength': None,
                'FocalLength35mm': 28,  # Assume typical wide-angle lens
                'FNumber': None,
                'ISO': None,
                'ImageWidth': None,
                'ImageHeight': None,
                'DateTime': None
            }
        
        # 3. Decode image from bytes
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if image is None:
            logging.error("Failed to decode image")
            sys.exit(1)
        
        h, w = image.shape[:2]
        logging.info(f"Loaded image: {w}x{h}")
        
        # 4. Try Lensfun database
        lensfun_data = None
        if is_lensfun_available():
            lensfun_data = query_lensfun_database(
                camera_info['Make'],
                camera_info['Model'],
                camera_info['LensModel'],
                camera_info.get('FocalLength'),
                w, h
            )
        
        # 5. Apply correction
        if lensfun_data:
            logging.info("Using Lensfun database")
            undistorted = undistort_image_lensfun(image, lensfun_data['modifier'])
        else:
            logging.warning("Using parameter estimation")
            camera_matrix, dist_coeffs = estimate_camera_parameters(
                image.shape, 
                camera_info.get('FocalLength'), 
                camera_info.get('FocalLength35mm')
            )
            undistorted = undistort_image_opencv(image, camera_matrix, dist_coeffs)
        
        print_lensfun_correction_report(lensfun_data)
        
        # 6. Save output
        if args.output:
            output_path = args.output
        else:
            # Handle both .jpg and .JPG extensions
            base, ext = os.path.splitext(args.image)
            output_path = f"{base}_corrected{ext}"
        
        cv2.imwrite(output_path, undistorted)
        logging.info(f"✓ Saved corrected image: {output_path}")
        
    except ValueError as e:
        logging.error(f"✗ Error: {e}")
        sys.exit(1)
    except Exception as e:
        logging.error(f"✗ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()

