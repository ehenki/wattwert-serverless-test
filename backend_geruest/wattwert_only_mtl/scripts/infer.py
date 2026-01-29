import yaml
import torch
import argparse
import sys
import os
import numpy as np
import matplotlib.pyplot as plt
# Add the project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
# Add the backend directory to the Python path for Supabase_database access
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..')))
from src.wattwert_mtl.model import MultiTaskDeepLabV3Plus
from src.wattwert_mtl.data_handling import get_transforms
from src.wattwert_mtl.inference import run_inference
from Supabase_database.functions.image_uploader import upload_image_and_save_to_db

def calculate_window_to_wall_ratio(element_prediction, class_mappings):
    """
    Calculate the Window-to-Wall Ratio from element segmentation prediction.
    
    Args:
        element_prediction (numpy.ndarray): Element segmentation mask
        class_mappings (dict): Class mappings from config
    
    Returns:
        dict: Dictionary containing WWR and detailed pixel counts
    """
    window_class_id = class_mappings['elements']['window']
    building_class_id = class_mappings['elements']['building']
    
    # Count pixels for each class
    window_pixels = np.sum(element_prediction == window_class_id)
    building_pixels = np.sum(element_prediction == building_class_id)
    facade_pixels = window_pixels + building_pixels
    
    # Calculate Window-to-Wall Ratio
    if facade_pixels > 0:
        wwr = window_pixels / facade_pixels
    else:
        wwr = 0.0
    
    return {
        'window_pixels': int(window_pixels),
        'building_pixels': int(building_pixels),
        'facade_pixels': int(facade_pixels),
        'window_to_wall_ratio': float(wwr),
        'window_percentage': float(wwr * 100)
    }

def run_inference_on_image(image_path: str, output_dir: str = None, number: int = None):
    """
    Run inference on a single image and return WWR results.
    
    Args:
        image_path (str): Path to the input image or URL
        output_dir (str, optional): Directory to save outputs
        number (int, optional): Image number for generating prediction images and titles
    
    Returns:
        dict: WWR analysis results, including paths to generated prediction images if number is provided
    """
    import requests
    import tempfile
    
    # Check if image_path is a URL
    if image_path.startswith(('http://', 'https://')):
        try:
            # Download the image to a temporary file
            print(f"Downloading image from database...")
            response = requests.get(image_path, stream=True)
            response.raise_for_status()
            
            # Create a temporary file with the correct extension
            file_extension = '.jpg'  # Default extension
            if 'Content-Type' in response.headers:
                content_type = response.headers['Content-Type']
                if 'png' in content_type:
                    file_extension = '.png'
                elif 'jpeg' in content_type or 'jpg' in content_type:
                    file_extension = '.jpg'
                elif 'webp' in content_type:
                    file_extension = '.webp'
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=file_extension) as temp_file:
                for chunk in response.iter_content(chunk_size=8192):
                    temp_file.write(chunk)
                temp_image_path = temp_file.name
            
            # Use the temporary file path for inference
            actual_image_path = temp_image_path
            cleanup_temp_file = True
            
        except Exception as e:
            print(f"Error downloading image from URL {image_path}: {e}")
            return {
                'window_pixels': 0,
                'building_pixels': 0,
                'facade_pixels': 0,
                'window_to_wall_ratio': 0.0,
                'window_percentage': 0.0,
                'error': f'Failed to download image: {str(e)}'
            }
    else:
        # Local file path
        actual_image_path = image_path
        cleanup_temp_file = False
    try:
        # Build path to config file relative to this script's location
        script_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(script_dir)  # Go up one level from scripts/
        config_path = os.path.join(project_root, 'configs', 'config.yaml')
        
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)

        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        _, val_test_transform = get_transforms()

        # --- Load Model ---
        model = MultiTaskDeepLabV3Plus(
            num_classes_elements=config['model']['num_classes_elements'],
            num_classes_materials=config['model']['num_classes_materials'],
            load_pretrained_encoder=False
        )
        
        # Build absolute path to the model file
        model_path = config['output']['model_save_path']
        if not os.path.isabs(model_path):
            # If it's a relative path, make it relative to the backend directory
            backend_dir = os.path.dirname(project_root)  # Go up one level to backend/
            model_path = os.path.join(backend_dir, model_path)
        
        model.load_state_dict(torch.load(model_path, map_location=device), strict=False)
        print("Image file path: ", actual_image_path)
        model.to(device)

        # --- Run Inference ---
        results = run_inference(model, actual_image_path, val_test_transform, device)
        
        if results:
            elem_pred_raw = results['elem_pred_raw']
            
            # --- Calculate Window-to-Wall Ratio ---
            wwr_results = calculate_window_to_wall_ratio(elem_pred_raw, config['class_mappings'])

            # Save prediction images to database
            if number is not None:
                try:
                    import tempfile
                    
                    original_image = results['original_image']
                    elem_pred_colored = results['elem_pred_colored']
                    mat_pred_colored = results['mat_pred_colored']
                    
                    # Create element prediction image
                    fig_elem, ax_elem = plt.subplots(1, 1, figsize=(10, 10))
                    ax_elem.imshow(elem_pred_colored)
                    ax_elem.set_title("Element Prediction")
                    ax_elem.axis('off')
                    
                    # Save element prediction to temporary file
                    with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as temp_elem_file:
                        elem_temp_path = temp_elem_file.name
                    
                    plt.figure(fig_elem.number)
                    plt.savefig(elem_temp_path, bbox_inches='tight', dpi=150)
                    plt.close(fig_elem)
                    
                    # Create material prediction image
                    fig_mat, ax_mat = plt.subplots(1, 1, figsize=(10, 10))
                    ax_mat.imshow(mat_pred_colored)
                    ax_mat.set_title("Material Prediction")
                    ax_mat.axis('off')
                    
                    # Save material prediction to temporary file
                    with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as temp_mat_file:
                        mat_temp_path = temp_mat_file.name
                    
                    plt.figure(fig_mat.number)
                    plt.savefig(mat_temp_path, bbox_inches='tight', dpi=150)
                    plt.close(fig_mat)
                    
                    # Upload element prediction to database
                    # Note: We need access_token and ID_LOD2 for upload - these should be passed as parameters
                    # For now, we'll add them to the return results for external handling
                    wwr_results['element_prediction_path'] = elem_temp_path
                    wwr_results['material_prediction_path'] = mat_temp_path
                    wwr_results['prediction_number'] = number
                    
                    print(f"Generated prediction images: element={elem_temp_path}, material={mat_temp_path}")
                    
                except Exception as e:
                    print(f"Error generating prediction images: {e}")
                    wwr_results['prediction_error'] = str(e)
            
            
            return wwr_results
        else:
            return {
                'window_pixels': 0,
                'building_pixels': 0,
                'facade_pixels': 0,
                'window_to_wall_ratio': 0.0,
                'window_percentage': 0.0
            }
    
    finally:
        # Clean up temporary file if we created one
        if cleanup_temp_file and 'temp_image_path' in locals():
            try:
                os.unlink(temp_image_path)
                print(f"Cleaned up temporary file: {temp_image_path}")
            except Exception as e:
                print(f"Warning: Could not clean up temporary file {temp_image_path}: {e}")


# Old main function - can still be used for testing from the command line
def main(args):
    print(f"Running inference on: {args.image_path}")
    
    # Build path to config file relative to this script's location
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)  # Go up one level from scripts/
    config_path = os.path.join(project_root, 'configs', 'config.yaml')
    
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    _, val_test_transform = get_transforms()

    # --- Load Model ---
    # Initialize model structure without loading pretrained weights, as we will load our own fine-tuned weights
    model = MultiTaskDeepLabV3Plus(
        num_classes_elements=config['model']['num_classes_elements'],
        num_classes_materials=config['model']['num_classes_materials'],
        load_pretrained_encoder=False
    )
    print("Hello, I am a MultiTaskDeepLabV3Plus model!")
    
    # Build absolute path to the model file
    model_path = config['output']['model_save_path']
    if not os.path.isabs(model_path):
        # If it's a relative path, make it relative to the backend directory
        backend_dir = os.path.dirname(project_root)  # Go up one level to backend/
        model_path = os.path.join(backend_dir, model_path)
    
    model.load_state_dict(torch.load(model_path, map_location=device), strict=False)
    print("Model loaded successfully.")
    model.to(device)

    # --- Run Inference ---
    results = run_inference(model, args.image_path, val_test_transform, device)
    
    if results:
        # Entpacke das Dictionary statt des Tupels
        original_image = results['original_image']
        elem_pred_colored = results['elem_pred_colored']
        mat_pred_colored = results['mat_pred_colored']
        elem_pred_raw = results['elem_pred_raw']
        mat_pred_raw = results['mat_pred_raw']
        
        # --- Calculate Window-to-Wall Ratio ---
        # Verwende die rohen Segmentierungs-IDs für die Berechnung
        wwr_results = calculate_window_to_wall_ratio(elem_pred_raw, config['class_mappings'])
        
        # --- Print WWR Results ---
        print(f"\n=== Window-to-Wall Ratio Analysis ===")
        print(f"Window pixels: {wwr_results['window_pixels']:,}")
        print(f"Building/Wall pixels: {wwr_results['building_pixels']:,}")
        print(f"Total facade pixels: {wwr_results['facade_pixels']:,}")
        print(f"Window-to-Wall Ratio: {wwr_results['window_to_wall_ratio']:.4f}")
        print(f"Window percentage: {wwr_results['window_percentage']:.2f}%")
        
        # --- Save or Display Results ---
        output_dir = args.output_dir
        os.makedirs(output_dir, exist_ok=True)
        base_name = os.path.splitext(os.path.basename(args.image_path))[0]

        fig, axes = plt.subplots(1, 3, figsize=(20, 7))
        axes[0].imshow(original_image); axes[0].set_title("Original Image"); axes[0].axis('off')
        axes[1].imshow(elem_pred_colored); axes[1].set_title("Element Prediction"); axes[1].axis('off')
        axes[2].imshow(mat_pred_colored); axes[2].set_title("Material Prediction"); axes[2].axis('off')
        
        save_path = os.path.join(output_dir, f"{base_name}_inference.png")
        plt.savefig(save_path, bbox_inches='tight')
        print(f"Saved inference result to {save_path}")
        plt.show()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run inference on a single image.")
    parser.add_argument("--image_path", type=str, required=True, help="Path to the input image.")
    parser.add_argument("--output_dir", type=str, default="runs/inference", help="Directory to save the output.")
    args = parser.parse_args()
    main(args)