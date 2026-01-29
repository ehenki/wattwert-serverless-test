import torch
import numpy as np
import cv2
import matplotlib.pyplot as plt
import evaluate
from tqdm import tqdm
from torch.cuda.amp import autocast

# Define color palettes (entspricht config.yaml class_mappings)
# RGB-Format für matplotlib (wird in visualize_comparison und infer.py verwendet)
# Elements: 0=bg, 1=window, 2=building, 3=door, 4=sky, 5=pavement, 6=vegetation, 7=car, 8=road, 9=roof
ELEMENT_PALETTE = {0: [0, 0, 0], 1: [0, 0, 139], 2: [255, 0, 0], 3: [139, 69, 19], 4: [135, 206, 235],
                   5: [128, 128, 128], 6: [34, 139, 34], 7: [255, 165, 0], 8: [64, 64, 64], 9: [139, 0, 0]}
# Materials: 0=bg, 1=stucco, 2=brick, 3=stone, 4=concrete, 5=glass, 6=timber, 7=other
MATERIAL_PALETTE = {0: [0, 0, 0], 1: [200, 170, 120], 2: [178, 34, 34], 3: [128, 128, 128], 4: [192, 192, 192],
                    5: [173, 216, 230], 6: [139, 69, 19], 7: [255, 255, 255]}

def apply_color_palette(prediction, palette):
    h, w = prediction.shape
    color_mapped = np.zeros((h, w, 3), dtype=np.uint8)
    for class_id, color in palette.items():
        color_mapped[prediction == class_id] = color
    return color_mapped

def visualize_comparison(image, ground_truth, prediction, palette, task_name):
    gt_colored = apply_color_palette(ground_truth, palette)
    pred_colored = apply_color_palette(prediction, palette)

    image = image.permute(1, 2, 0).cpu().numpy()
    image = (image * np.array([0.229, 0.224, 0.225])) + np.array([0.485, 0.456, 0.406])
    image = (image * 255).astype(np.uint8)

    plt.figure(figsize=(15, 5))
    plt.subplot(1, 3, 1); plt.title("Input Image"); plt.imshow(image); plt.axis("off")
    plt.subplot(1, 3, 2); plt.title("Ground Truth"); plt.imshow(gt_colored); plt.axis("off")
    plt.subplot(1, 3, 3); plt.title(f"{task_name} Prediction"); plt.imshow(pred_colored); plt.axis("off")
    plt.show()

def run_evaluation(model, test_loader, device, task_name, palette, num_classes):
    model.eval()
    metric = evaluate.load("mean_iou")
    all_predictions = []
    all_masks = []

    print(f"\nEvaluating {task_name} segmentation...")
    task_index = 1 if task_name == "Material" else 0

    with torch.no_grad():
        for images, masks, _ in tqdm(test_loader, desc=f"Evaluating {task_name}"):
            images = images.to(device)
            task_indices = torch.full((images.shape[0],), task_index, dtype=torch.long, device=device)

            with autocast():
                if task_index == 0: # Element
                    task_output, _, _, _ = model(images, task_indices)
                else: # Material
                    _, task_output, _, _ = model(images, task_indices)
            
            predictions = torch.argmax(task_output, dim=1).cpu().numpy()
            all_predictions.extend(predictions)
            all_masks.extend(masks.cpu().numpy())

    print(f"\nComputing final metrics for {task_name}...")
    results = metric.compute(
        predictions=all_predictions, 
        references=all_masks, 
        num_labels=num_classes, 
        ignore_index=255
    )
    print(f"Mean IoU: {results['mean_iou']:.4f}")
    print("Per Category IoU:")
    for i, iou in enumerate(results["per_category_iou"]):
        print(f"   - Class {i}: {iou:.4f}")

def run_inference(model, image_path, transform, device):
    model.eval()
    image_bgr = cv2.imread(image_path)
    if image_bgr is None:
        print(f"Could not read image at {image_path}")
        return None
    
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    
    # Apply transformations
    transformed = transform(image=image_rgb)
    image_tensor = transformed["image"].unsqueeze(0).to(device)

    with torch.no_grad(), autocast():
        # A single forward pass now yields both outputs when task_indices is None
        elem_output, mat_output, _, _ = model(image_tensor, task_indices=None)

    # Raw predictions (class IDs)
    elem_pred_raw = torch.argmax(elem_output, dim=1).squeeze().cpu().numpy()
    mat_pred_raw = torch.argmax(mat_output, dim=1).squeeze().cpu().numpy()
    
    # Colored predictions for visualization
    elem_colored = apply_color_palette(elem_pred_raw, ELEMENT_PALETTE)
    mat_colored = apply_color_palette(mat_pred_raw, MATERIAL_PALETTE)

    # Return both raw and colored versions
    return {
        'original_image': cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB),
        'elem_pred_colored': elem_colored,
        'mat_pred_colored': mat_colored,
        'elem_pred_raw': elem_pred_raw,
        'mat_pred_raw': mat_pred_raw
    }