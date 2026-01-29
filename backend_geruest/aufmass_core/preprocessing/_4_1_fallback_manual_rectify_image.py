import cv2
import numpy as np
import tkinter as tk
import os
import logging

# Try relative imports for CLI usage, fallback to absolute for module usage
try:
    from ..database_download_functions import _get_facade_image
    from ..database_upload_functions import _upload_facade_image
    from ..datastructure.aufmassClasses import FacadeImage
except ImportError:
    try:
        from aufmass_core.database_download_functions import _get_facade_image
        from aufmass_core.database_upload_functions import _upload_facade_image
        from aufmass_core.datastructure.aufmassClasses import FacadeImage
    except ImportError:
        # CLI mode - database functions not available
        _get_facade_image = None
        _upload_facade_image = None
        FacadeImage = None
        logging.warning("Database functions not available - running in CLI mode")

# Global variables to store the selected points and image copy
points = []
image_copy = None
image_original_canvas = None  # Store the original canvas without magnifier
resize_factor = 0.3  # Factor to resize the image for point selection (will be adjusted automatically)
magnifier_size = 150  # Size of the magnifier window
magnifier_zoom = 3  # Zoom factor for the magnifier

def select_points(event, x, y, flags, param):
    """
    Mouse callback function to select points on the image.
    """
    global points, image_copy, start_x, start_y, image_original_canvas, magnifier_size, magnifier_zoom
    
    if event == cv2.EVENT_MOUSEMOVE:
        # Check if image_original_canvas is initialized
        if image_original_canvas is None:
            return
            
        # Show magnifier on mouse move
        image_copy = image_original_canvas.copy()
        
        # Draw existing crosshairs
        for i, (px, py) in enumerate(points):
            # Convert back to canvas coordinates
            canvas_x = int(px * resize_factor + start_x)
            canvas_y = int(py * resize_factor + start_y)
            crosshair_size = 15
            cv2.line(image_copy, (canvas_x - crosshair_size, canvas_y), (canvas_x + crosshair_size, canvas_y), (0, 0, 255), 1)
            cv2.line(image_copy, (canvas_x, canvas_y - crosshair_size), (canvas_x, canvas_y + crosshair_size), (0, 0, 255), 1)
            cv2.circle(image_copy, (canvas_x, canvas_y), 2, (0, 0, 255), -1)
            # Add point number
            cv2.putText(image_copy, str(i + 1), (canvas_x + 10, canvas_y - 10), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
        
        # Draw magnifier
        half_mag = magnifier_size // (2 * magnifier_zoom)
        
        # Extract region to magnify from original canvas
        y1 = max(0, y - half_mag)
        y2 = min(image_original_canvas.shape[0], y + half_mag)
        x1 = max(0, x - half_mag)
        x2 = min(image_original_canvas.shape[1], x + half_mag)
        
        roi = image_original_canvas[y1:y2, x1:x2]
        
        if roi.shape[0] > 0 and roi.shape[1] > 0:
            # Resize ROI to magnifier size
            magnified = cv2.resize(roi, (magnifier_size, magnifier_size), interpolation=cv2.INTER_LINEAR)
            
            # Position magnifier relative to cursor (right side)
            offset_x = 20
            mag_x = x + offset_x
            mag_y = y - magnifier_size // 2
            
            # Check bounds and adjust if necessary
            img_h, img_w = image_copy.shape[:2]
            
            # If magnifier goes off the right edge, move it to the left of the cursor
            if mag_x + magnifier_size > img_w:
                mag_x = x - magnifier_size - offset_x
            
            # Keep vertical position within bounds
            mag_y = max(0, min(mag_y, img_h - magnifier_size))
            
            # Draw border and background
            cv2.rectangle(image_copy, (mag_x - 2, mag_y - 2), 
                         (mag_x + magnifier_size + 2, mag_y + magnifier_size + 2), 
                         (0, 0, 0), 2)
            
            # Place magnified image
            image_copy[mag_y:mag_y + magnifier_size, mag_x:mag_x + magnifier_size] = magnified
            
            # Draw crosshair in center of magnifier
            center_x = mag_x + magnifier_size // 2
            center_y = mag_y + magnifier_size // 2
            cv2.line(image_copy, (center_x - 10, center_y), (center_x + 10, center_y), (0, 255, 0), 1)
            cv2.line(image_copy, (center_x, center_y - 10), (center_x, center_y + 10), (0, 255, 0), 1)
        
        cv2.imshow("Select 4 points", image_copy)
    
    elif event == cv2.EVENT_LBUTTONDOWN:
        # Check if image_original_canvas is initialized
        if image_original_canvas is None:
            return
            
        # Adjust the points to account for the offset introduced by the canvas
        adjusted_x = (x - start_x) / resize_factor
        adjusted_y = (y - start_y) / resize_factor
        points.append((adjusted_x, adjusted_y))  # Scale back the points to original size
        
        # Redraw canvas with all crosshairs
        image_copy = image_original_canvas.copy()
        for i, (px, py) in enumerate(points):
            canvas_x = int(px * resize_factor + start_x)
            canvas_y = int(py * resize_factor + start_y)
            crosshair_size = 15
            cv2.line(image_copy, (canvas_x - crosshair_size, canvas_y), (canvas_x + crosshair_size, canvas_y), (0, 0, 255), 1)
            cv2.line(image_copy, (canvas_x, canvas_y - crosshair_size), (canvas_x, canvas_y + crosshair_size), (0, 0, 255), 1)
            cv2.circle(image_copy, (canvas_x, canvas_y), 2, (0, 0, 255), -1)
            cv2.putText(image_copy, str(i + 1), (canvas_x + 10, canvas_y - 10), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255), 1)
        
        cv2.imshow("Select 4 points", image_copy)
        print(f"Point {len(points)} selected: ({adjusted_x:.1f}, {adjusted_y:.1f})")

        # Close the window automatically if 4 points are selected
        if len(points) == 4:
            cv2.destroyAllWindows()

def rectify_image_manual_local(image_path, output_path, crop_to_selection=False):
    """
    Function to rectify an image using manually selected points.
    
    Args:
        image_path: Path to the input image
        output_path: Path where the rectified image will be saved
        crop_to_selection: If True, the output will be cropped to the 4 selected points.
                          If False, the entire image will be warped while maintaining 
                          the perspective transformation.
    
    Note:
        - With crop_to_selection=True: Only the area within the 4 selected points is 
          rectified and saved (standard perspective crop).
        - With crop_to_selection=False: The entire image is warped, applying the 
          perspective transformation to all pixels, resulting in a larger output image.
    """
    global points, image_copy, start_x, start_y, resize_factor, image_original_canvas
    points = []  # Reset the points list for every run
    image_original_canvas = None  # Reset the original canvas

    # Step 1: Load the image
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError("Image not found or cannot be loaded.")
    
    # Get screen dimensions
    root = tk.Tk()
    screen_width = root.winfo_screenwidth()
    screen_height = root.winfo_screenheight()
    root.destroy()
    
    # Calculate resize factor based on screen size (use 70% of screen for safety)
    height, width = image.shape[:2]
    max_display_width = int(screen_width * 0.7)
    max_display_height = int(screen_height * 0.7)
    
    # Calculate resize factor to fit the screen
    width_ratio = max_display_width / width
    height_ratio = max_display_height / height
    resize_factor = min(width_ratio, height_ratio, 1.0)  # Don't upscale if image is small
    
    print(f"Screen size: {screen_width}x{screen_height}")
    print(f"Image size: {width}x{height}")
    print(f"Resize factor: {resize_factor:.2f}")
    
    # Resize the image for display and point selection
    resized_image = cv2.resize(image, (int(width * resize_factor), int(height * resize_factor)))

    # Create a canvas that fits the screen (use 90% of screen dimensions)
    canvas_height = int(screen_height * 0.9)
    canvas_width = int(screen_width * 0.9)
    canvas = np.full((canvas_height, canvas_width, 3), 255, dtype=np.uint8)
    
    # Center the resized image on the canvas
    start_y = (canvas_height - resized_image.shape[0]) // 2
    start_x = (canvas_width - resized_image.shape[1]) // 2
    canvas[start_y:start_y + resized_image.shape[0], start_x:start_x + resized_image.shape[1]] = resized_image
    image_copy = canvas.copy()
    image_original_canvas = canvas.copy()  # Store original canvas for magnifier

    # Step 2: Display the image and let the user select 4 points
    cv2.imshow("Select 4 points", image_copy)
    cv2.setMouseCallback("Select 4 points", select_points)
    cv2.waitKey(0)  # Wait until all points are selected and the window is closed

    if len(points) != 4:
        raise ValueError("Exactly 4 points must be selected. Restart the program to try again.")

    # Step 3: Define the destination points for the perspective transform
    # Sort points in a consistent order: top-left, top-right, bottom-right, bottom-left
    points_np = np.array(points, dtype="float32")
    s = points_np.sum(axis=1)
    diff = np.diff(points_np, axis=1)

    top_left = points_np[np.argmin(s)]
    bottom_right = points_np[np.argmax(s)]
    top_right = points_np[np.argmin(diff)]
    bottom_left = points_np[np.argmax(diff)]

    src_points = np.array([top_left, top_right, bottom_right, bottom_left], dtype="float32")
    print("Source points (ordered):", src_points)

    # Calculate the width and height of the selected points
    width_a = np.linalg.norm(bottom_right - bottom_left)
    width_b = np.linalg.norm(top_right - top_left)
    max_width = max(int(width_a), int(width_b))

    height_a = np.linalg.norm(top_right - bottom_right)
    height_b = np.linalg.norm(top_left - bottom_left)
    max_height = max(int(height_a), int(height_b))

    # Calculate the aspect ratio of the selected points
    aspect_ratio = max_width / max_height

    # Adjust the destination rectangle to maintain the aspect ratio
    if aspect_ratio > 1:
        max_height = int(max_width / aspect_ratio)
    else:
        max_width = int(max_height * aspect_ratio)

    dst_points = np.array([
        [0, 0],
        [max_width - 1, 0],
        [max_width - 1, max_height - 1],
        [0, max_height - 1]
    ], dtype="float32")
    print("Destination points:", dst_points)

    # Step 4: Compute the homography matrix and apply the perspective transform
    homography_matrix = cv2.getPerspectiveTransform(src_points, dst_points)
    
    if crop_to_selection:
        # Crop mode: Only warp the selected area (standard behavior)
        rectified_image = cv2.warpPerspective(image, homography_matrix, (max_width, max_height),
                                              flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0))
    else:
        # Full warp mode: Warp the entire image while applying the perspective transformation
        # Calculate the transformed corners of the entire image to determine output size
        h, w = image.shape[:2]
        corners = np.array([
            [0, 0],
            [w, 0],
            [w, h],
            [0, h]
        ], dtype="float32").reshape(-1, 1, 2)
        
        transformed_corners = cv2.perspectiveTransform(corners, homography_matrix)
        
        # Find the bounding box of the transformed image
        x_coords = transformed_corners[:, 0, 0]
        y_coords = transformed_corners[:, 0, 1]
        
        min_x, max_x = int(np.floor(x_coords.min())), int(np.ceil(x_coords.max()))
        min_y, max_y = int(np.floor(y_coords.min())), int(np.ceil(y_coords.max()))
        
        # Adjust the homography matrix to shift the image into positive coordinates
        translation_matrix = np.array([
            [1, 0, -min_x],
            [0, 1, -min_y],
            [0, 0, 1]
        ], dtype="float32")
        
        adjusted_homography = translation_matrix @ homography_matrix
        
        # Calculate output size
        output_width = max_x - min_x
        output_height = max_y - min_y
        
        print(f"Full warp output size: {output_width}x{output_height}")
        
        rectified_image = cv2.warpPerspective(image, adjusted_homography, (output_width, output_height),
                                              flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=(0, 0, 0))

    # Step 4b: Auto-Crop to remove black borders (Padding)
    # Convert to grayscale to find non-black regions
    gray = cv2.cvtColor(rectified_image, cv2.COLOR_BGR2GRAY)
    # Mask of non-black pixels (threshold > 0)
    _, thresh = cv2.threshold(gray, 1, 255, cv2.THRESH_BINARY)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if contours:
        # Find the bounding box of the largest contour (usually the image content)
        # Or better: bounding box of all non-black pixels
        x, y, w, h = cv2.boundingRect(thresh)
        print(f"Auto-cropping to content: x={x}, y={y}, w={w}, h={h}")
        rectified_image = rectified_image[y:y+h, x:x+w]

    # Step 5: Save and return the rectified image
    cv2.imwrite(output_path, rectified_image)
    print(f"Rectified image saved to: {output_path}")
    return rectified_image


def rectify_image(ID_LOD2: str, facade_id: int, access_token: str):
    """
    Main function to handle the manual rectification process within the pipeline.
    Downloads the cropped image, opens the manual rectification GUI, and uploads the result.
    """
    import tempfile
    from PIL import Image
    
    # 1. Download the cropped image
    # We use the 'cropped' tag as input. Note: tags must be a list.
    image_bytes = _get_facade_image(ID_LOD2, facade_id, ["cropped"], access_token)
    if not image_bytes:
        logging.error(f"No cropped image found for facade {facade_id}")
        return

    # Save to temp file
    with tempfile.NamedTemporaryFile(suffix=".jpg", delete=False) as temp_in:
        temp_in_path = temp_in.name
        # Write bytes directly
        temp_in.write(image_bytes)
        
    # Prepare output path
    temp_out_path = temp_in_path.replace(".jpg", "_rectified.jpg")
    
    try:
        # 2. Run manual rectification
        print(f"Starting manual rectification for facade {facade_id}...")
        print("Please select 4 points on the image window.")
        # We use crop_to_selection=False to keep the full context, similar to automated approach
        rectify_image_manual_local(temp_in_path, temp_out_path, crop_to_selection=False)
        
        # 3. Upload the result
        if os.path.exists(temp_out_path):
            # Create FacadeImage object
            facade_image_obj = FacadeImage(
                ID_LOD2=ID_LOD2,
                facade_id=facade_id,
                tags=["rectified"]
            )
            
            # Upload using the file path
            _upload_facade_image(facade_image_obj, temp_out_path, access_token)
            logging.info(f"✓ Manual rectification completed for facade {facade_id}")
            
            # Clean up output file
            if os.path.exists(temp_out_path):
                os.remove(temp_out_path)
        else:
            logging.warning("Manual rectification cancelled or failed (no output file).")
            
    except Exception as e:
        logging.error(f"Error during manual rectification: {e}")
    finally:
        # Clean up input file
        if os.path.exists(temp_in_path):
            os.remove(temp_in_path)


# Example usage
if __name__ == "__main__":
    image_path = r"C:\Users\lnoll\Downloads\DSC00109.JPG"
    output_path = r"C:\Users\lnoll\Downloads\DSC00109.rectified.jpg"
    try:
        # Default: Warp entire image (crop_to_selection=False)
        rectified_image = rectify_image_manual_local(image_path, output_path)
        
        # Option 2: Crop to selection only (uncomment to use)
        # output_path_cropped = r"C:\Users\lnoll\Downloads\DSC00109.rectified_cropped.jpg"
        # rectified_image = rectify_image_manual_local(image_path, output_path_cropped, crop_to_selection=True)
    except Exception as e:
        print(f"Error: {e}")
