"""Lensfun Database Helper Functions.

This module provides helper functions for querying the Lensfun database
and applying lens distortion corrections using Lensfun.

References
----------
Lensfun Database: https://lensfun.github.io/
"""

import cv2
import numpy as np
import logging
from enum import Enum

try:
    import lensfunpy
    LENSFUN_AVAILABLE = True
except ImportError:
    LENSFUN_AVAILABLE = False
    logging.warning("lensfunpy not available - Lensfun database cannot be used")


class CalibrationSource(Enum):
    """Source of calibration parameters."""
    LENSFUN = "Lensfun Database"
    ESTIMATED = "Parameter Estimation"


def is_lensfun_available():
    """Check if Lensfun is available.
    
    Returns
    -------
    bool
        True if lensfunpy is installed, False otherwise
    """
    return LENSFUN_AVAILABLE


def query_lensfun_database(camera_make, camera_model, lens_model, focal_length, image_width, image_height):
    """Query Lensfun database for camera/lens calibration.
    
    Parameters
    ----------
    camera_make : str
        Camera manufacturer (e.g., "Apple")
    camera_model : str
        Camera model (e.g., "iPhone 13 Pro")
    lens_model : str or None
        Lens model string from EXIF
    focal_length : float or None
        Focal length in mm
    image_width : int
        Image width in pixels
    image_height : int
        Image height in pixels
        
    Returns
    -------
    result : dict or None
        Dictionary with camera, lens, modifier, source, focal_length if found, None otherwise
    """
    if not LENSFUN_AVAILABLE:
        logging.warning("Lensfun not available - skipping database query")
        return None
    
    try:
        # Initialize Lensfun database
        db = lensfunpy.Database()
        
        # Search for camera
        cam_list = db.find_cameras(camera_make, camera_model)
        if not cam_list:
            logging.info(f"Camera not found in Lensfun DB: {camera_make} {camera_model}")
            return None
        
        camera = cam_list[0]
        logging.info(f"✓ Found camera in Lensfun: {camera.maker} {camera.model}")
        
        # Search for lens (if available)
        lens = None
        is_fallback = False
        requested_lens = lens_model
        
        if lens_model and lens_model != "Unknown":
            lens_list = db.find_lenses(camera, lens=lens_model, loose_search=True)
            if lens_list:
                lens = lens_list[0]
                logging.info(f"✓ Found lens in Lensfun: {lens.model}")
        
        # If no lens found, try to find any lens for this camera (fallback)
        if not lens:
            logging.warning(f"Lens '{lens_model}' not found in Lensfun database")
            lens_list = db.find_lenses(camera)
            
            if lens_list:
                lens = lens_list[0]
                is_fallback = True
                logging.warning(f"Using fallback lens for correction: {lens.model}")
                logging.warning("⚠️ Correction may be inaccurate (wrong lens model)")
            else:
                logging.error(f"No lenses found for camera {camera.model} in Lensfun DB")
                return None
        
        # Determine focal length
        if focal_length:
            focal_length_mm = focal_length
        else:
            focal_length_mm = 50.0
            logging.warning("Focal length not available - using fallback value: 50.0mm")
        
        # Create modifier with CORRECT API: Modifier(lens, crop_factor, width, height)
        mod = lensfunpy.Modifier(lens, camera.crop_factor, image_width, image_height)
        
        # Initialize modifier for distortion correction (full API-compliant signature)
        mod.initialize(
            focal_length_mm,                          # focal: focal length in mm
            2.8,                                      # aperture: f-number (use lens.min_aperture if available)
            distance=1000.0,                          # distance: focus distance in meters (1000m ≈ infinity for architecture)
            scale=0.0,                                # scale: 0.0 = automatic scaling
            targeom=lensfunpy.LensType.RECTILINEAR,  # targeom: target geometry (keep rectilinear)
            pixel_format=np.uint8,                    # pixel_format: 8-bit unsigned (standard JPEG)
            flags=lensfunpy.ModifyFlags.DISTORTION,   # flags: only distortion correction (not TCA/vignetting)
            reverse=False                             # reverse: False = forward transform (undistort image)
        )
        
        return {
            'camera': camera,
            'lens': lens,
            'modifier': mod,
            'source': CalibrationSource.LENSFUN,
            'focal_length': focal_length_mm,
            'crop_factor': camera.crop_factor,
            'is_fallback': is_fallback,
            'requested_lens': requested_lens
        }
        
    except Exception as e:
        logging.error(f"Error querying Lensfun database: {e}")
        import traceback
        traceback.print_exc()
        return None


def undistort_image_lensfun(image, modifier):
    """Apply lens distortion correction using Lensfun.
    
    Parameters
    ----------
    image : ndarray
        Input image (BGR)
    modifier : lensfunpy.Modifier
        Lensfun modifier object with lens correction data
        
    Returns
    -------
    undistorted : ndarray
        Undistorted image
    """
    # Validate inputs
    if modifier is None:
        raise ValueError("Modifier cannot be None")
    
    if image is None or image.size == 0:
        raise ValueError("Invalid image")
    
    h, w = image.shape[:2]
    
    # Apply geometry distortion correction
    try:
        undist_coords = modifier.apply_geometry_distortion()
    except Exception as e:
        logging.error(f"Failed to apply geometry distortion: {e}")
        raise
    
    # Remap the image
    map_x = undist_coords[:, :, 0].astype(np.float32)
    map_y = undist_coords[:, :, 1].astype(np.float32)
    
    undistorted = cv2.remap(
        image, 
        map_x, 
        map_y, 
        cv2.INTER_LANCZOS4,
        borderMode=cv2.BORDER_CONSTANT
    )
    
    return undistorted


def get_lensfun_correction_metadata(lensfun_data, camera_info):
    """Generate metadata text for Lensfun correction.
    
    Parameters
    ----------
    lensfun_data : dict
        Dictionary returned by query_lensfun_database()
    camera_info : dict
        Camera information from EXIF
        
    Returns
    -------
    metadata : dict
        Dictionary with metadata_text and accuracy_estimate
    """
    is_fallback = lensfun_data.get('is_fallback', False)
    
    if is_fallback:
        accuracy_estimate = "±3-5% (fallback)"
        metadata_text = (f"Lens correction: {CalibrationSource.LENSFUN.value} (fallback lens) | "
                        f"Camera: {camera_info['Make']} {camera_info['Model']} | "
                        f"Requested: {lensfun_data.get('requested_lens', 'Unknown')} | "
                        f"Used: {lensfun_data['lens'].model} | "
                        f"Focal: {lensfun_data['focal_length']:.1f}mm | "
                        f"Accuracy: {accuracy_estimate}")
    else:
        accuracy_estimate = "±1-2%"
        metadata_text = (f"Lens correction: {CalibrationSource.LENSFUN.value} | "
                        f"Camera: {camera_info['Make']} {camera_info['Model']} | "
                        f"Lens: {lensfun_data['lens'].model} | "
                        f"Focal: {lensfun_data['focal_length']:.1f}mm | "
                        f"Accuracy: {accuracy_estimate}")
    
    return {
        'metadata_text': metadata_text,
        'accuracy_estimate': accuracy_estimate,
        'source': CalibrationSource.LENSFUN,
        'is_fallback': is_fallback
    }


def print_lensfun_correction_report(lensfun_data=None):
    """Print correction report for Lensfun-based correction.
    
    Parameters
    ----------
    lensfun_data : dict or None
        Lensfun data if available, None for estimated parameters
    """
    logging.info("="*60)
    logging.info("LENS CORRECTION REPORT")
    logging.info("="*60)
    
    if lensfun_data:
        logging.info(f"Calibration Source: {CalibrationSource.LENSFUN.value}")
        logging.info(f"Expected Accuracy:  ±1-2%")
        logging.info(f"Suitability:        ✓ Suitable for overview measurements")
        logging.info(f"Liability Notice:   Generic profile - for precision work,")
        logging.info(f"                    specific camera calibration recommended")
    else:
        logging.info(f"Calibration Source: {CalibrationSource.ESTIMATED.value}")
        logging.info(f"Expected Accuracy:  ±5-10%")
        logging.info(f"Suitability:        ✗ NOT suitable for metric measurements")
        logging.info(f"Liability Notice:   Estimated parameters - DO NOT use for")
        logging.info(f"                    precise measurements or legal documentation")
    
    logging.info("="*60)
