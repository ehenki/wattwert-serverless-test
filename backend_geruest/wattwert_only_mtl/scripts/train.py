import sys
import os
import yaml
import torch
from torch.utils.data import DataLoader, ConcatDataset
# Add the project root to the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from src.wattwert_mtl.model import MultiTaskDeepLabV3Plus
from src.wattwert_mtl.data_handling import SingleTaskDataset, get_transforms, create_balanced_datasets
from src.wattwert_mtl.trainer import train_model


def main():
    # Load configuration
    with open('configs/config.yaml', 'r') as f:
        config = yaml.safe_load(f)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    # Get data transformations
    train_transform, val_test_transform = get_transforms()

    # Create datasets
    material_dataset = SingleTaskDataset(
        image_dir=config['data']['material_image_dir'],
        json_dir=config['data']['material_json_dir'],
        class_mapping=config['class_mappings']['materials'],
        task_index=1,
        transform=train_transform
    )
    element_dataset = SingleTaskDataset(
        image_dir=config['data']['element_image_dir'],
        json_dir=config['data']['element_json_dir'],
        class_mapping=config['class_mappings']['elements'],
        task_index=0,
        transform=train_transform
    )

    # Use the balanced split logic from data_handling.py
    material_train, material_val, material_test, element_train, element_val, element_test = create_balanced_datasets(
        material_dataset, element_dataset, train_transform, val_test_transform
    )

    # --- Save test indices for consistent evaluation ---
    test_indices_dir = config['output']['test_indices_path']
    os.makedirs(test_indices_dir, exist_ok=True)
    with open(os.path.join(test_indices_dir, 'material_test_indices.json'), 'w') as f:
        json.dump(material_test.indices, f)
    with open(os.path.join(test_indices_dir, 'element_test_indices.json'), 'w') as f:
        json.dump(element_test.indices, f)
    print(f"Test set indices saved to {test_indices_dir}")

    # Combine the respective splits for the DataLoader
    combined_train_dataset = ConcatDataset([element_train, material_train])
    combined_val_dataset = ConcatDataset([element_val, material_val])

    # Create DataLoaders
    train_loader = DataLoader(combined_train_dataset, batch_size=config['training']['batch_size'], shuffle=True, num_workers=config['training']['num_workers'])
    val_loader = DataLoader(combined_val_dataset, batch_size=config['training']['batch_size'], shuffle=False, num_workers=config['training']['num_workers'])

    # Initialize model
    model = MultiTaskDeepLabV3Plus(
        num_classes_elements=config['model']['num_classes_elements'],
        num_classes_materials=config['model']['num_classes_materials']
    )

    # Start training
    trained_model = train_model(model, train_loader, val_loader, config, device)

    # Save the model
    save_path = config['output']['model_save_path']
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    torch.save(trained_model.state_dict(), save_path)
    print(f"Model saved to {save_path}")

if __name__ == "__main__":
    main()