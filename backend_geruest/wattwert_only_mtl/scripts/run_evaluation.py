import sys
import os
import yaml
import torch
from torch.utils.data import DataLoader
# Add the project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.wattwert_mtl.model import MultiTaskDeepLabV3Plus
from src.wattwert_mtl.data_handling import SingleTaskDataset, get_transforms
from src.wattwert_mtl.inference import run_evaluation, ELEMENT_PALETTE, MATERIAL_PALETTE

def main():
    print("Starting evaluation against ground truth...")
    with open('configs/config.yaml', 'r') as f:
        config = yaml.safe_load(f)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    _, val_test_transform = get_transforms()

    # --- Create Test Datasets ---
    material_test_dataset = SingleTaskDataset(
        image_dir=config['data']['material_image_dir'],
        json_dir=config['data']['material_json_dir'],
        class_mapping=config['class_mappings']['materials'],
        task_index=1,
        transform=val_test_transform
    )
    element_test_dataset = SingleTaskDataset(
        image_dir=config['data']['element_image_dir'],
        json_dir=config['data']['element_json_dir'],
        class_mapping=config['class_mappings']['elements'],
        task_index=0,
        transform=val_test_transform
    )

    # --- Create DataLoaders ---
    material_test_loader = DataLoader(material_test_dataset, batch_size=config['training']['batch_size'], shuffle=False, num_workers=config['training']['num_workers'])
    element_test_loader = DataLoader(element_test_dataset, batch_size=config['training']['batch_size'], shuffle=False, num_workers=config['training']['num_workers'])

    # --- Load Model ---
    model = MultiTaskDeepLabV3Plus(
        num_classes_elements=config['model']['num_classes_elements'],
        num_classes_materials=config['model']['num_classes_materials']
    )
    model.load_state_dict(torch.load(config['output']['save_path'], map_location=device))
    model.to(device)
    
    # --- Run Evaluation ---
    run_evaluation(model, element_test_loader, device, "Element", ELEMENT_PALETTE, config['model']['num_classes_elements'])
    run_evaluation(model, material_test_loader, device, "Material", MATERIAL_PALETTE, config['model']['num_classes_materials'])

    print("\nEvaluation complete.")

if __name__ == "__main__":
    main()