import os
import json
import random
from collections import defaultdict

import numpy as np
import cv2
import torch
from torch.utils.data import Dataset, Subset
import albumentations as A
from albumentations.pytorch import ToTensorV2
from tqdm import tqdm

class SingleTaskDataset(Dataset):
    def __init__(self, image_dir, json_dir, class_mapping, task_index, transform=None):
        self.image_dir = image_dir
        self.json_dir = json_dir
        self.class_mapping = class_mapping
        self.task_index = task_index
        self.transform = transform
        self.json_files = [os.path.join(json_dir, f) for f in os.listdir(json_dir) if f.endswith('.json')]
        self.material_priority = {"stucco": 10, "brick": 20, "stone": 30, "concrete": 40, "timber": 50, "other": 60, "glass": 70}

    def _create_mask(self, json_path, image_shape):
        mask = np.zeros(image_shape[:2], dtype=np.uint8)
        with open(json_path, 'r') as f:
            data = json.load(f)
        shapes = data.get("shapes", [])
        if self.task_index == 1:
            shapes = sorted(shapes, key=lambda x: self.material_priority.get(x["label"], 0))
        for shape in shapes:
            label = shape["label"]
            class_id = self.class_mapping.get(label, None)
            if class_id is not None:
                points = np.array(shape["points"], dtype=np.int32)
                cv2.fillPoly(mask, [points], class_id)
        return mask

    def __len__(self):
        return len(self.json_files)

    def __getitem__(self, idx):
        json_path = self.json_files[idx]
        with open(json_path, 'r') as f:
            data = json.load(f)
        image_path = os.path.join(self.image_dir, data["imagePath"])
        image = cv2.imread(image_path)
        if image is None:
            raise FileNotFoundError(f"Image not found: {image_path}")
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        mask = self._create_mask(json_path, image.shape)
        if self.transform:
            transformed = self.transform(image=image, mask=mask)
            image, mask = transformed["image"], transformed["mask"]
        if not isinstance(image, torch.Tensor):
            image = torch.from_numpy(image).permute(2, 0, 1).float() / 255.0
        if not isinstance(mask, torch.Tensor):
            mask = torch.from_numpy(mask).long()
        return image, mask, self.task_index

def get_transforms():
    train_transform = A.Compose([
        A.Resize(768, 768),
        A.HorizontalFlip(p=0.5),
        A.Rotate(limit=15, p=0.5),
        A.RandomBrightnessContrast(p=0.2),
        A.RandomCrop(height=720, width=720, p=0.5),
        A.Resize(768, 768),
        A.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225)),
        ToTensorV2()
    ])
    val_test_transform = A.Compose([
        A.Resize(768, 768),
        A.Normalize(mean=(0.485, 0.456, 0.406), std=(0.229, 0.224, 0.225)),
        ToTensorV2()
    ])
    return train_transform, val_test_transform

# Greedy Pixel class balancing (see. Meth. Chap.)

def calculate_class_distribution(dataset):
    """
    Calculate pixel-level class distribution for each image in the dataset.
    
    Args:
        dataset (torch.utils.data.Dataset): The dataset containing images and their corresponding masks.
    
    Returns:
        dict: A dictionary where keys are image indices and values are the normalized pixel distribution for each class.
        defaultdict: A dictionary counting how many images contain each class.
        defaultdict: A dictionary summing the total pixel counts for each class across all images.
        dict: A dictionary where keys are image indices and values are the total pixel count in the image.
    """
    distributions = {}
    class_image_counts = defaultdict(int)
    total_pixels_per_class = defaultdict(int)
    image_sizes = {}
    
    print("Calculating class distributions...")
    for idx in tqdm.tqdm(range(len(dataset)), desc="Processing images"):
        _, mask, _ = dataset[idx]  # Unpack task index correctly
        mask_np = mask.numpy()
        total_pixels = mask_np.size
        image_sizes[idx] = total_pixels
        
        # Count the number of pixels for each class and normalize
        unique, counts = np.unique(mask_np, return_counts=True)
        normalized_dist = {class_id: count / total_pixels for class_id, count in zip(unique, counts)}
        distributions[idx] = normalized_dist
        
        # Track overall class presence and pixel counts
        for class_id in unique:
            class_image_counts[class_id] += 1
            total_pixels_per_class[class_id] += counts[np.where(unique == class_id)[0][0]]
    
    return distributions, class_image_counts, total_pixels_per_class, image_sizes

def optimized_pixel_distribution_split(dataset, distributions, target_dist, image_sizes, train_ratio=0.7, val_ratio=0.15, test_ratio=0.15):
    """
    Greedy assignment of images to train, val, and test splits based on pixel-level class balance.
    
    Args:
        dataset (torch.utils.data.Dataset): The dataset containing images and their corresponding masks.
        distributions (dict): Pixel-level class distributions for each image in the dataset.
        target_dist (dict): The target pixel-level distribution of classes across all splits.
        image_sizes (dict): The total pixel count for each image.
        train_ratio (float): The ratio of samples to assign to the training set.
        val_ratio (float): The ratio of samples to assign to the validation set.
        test_ratio (float): The ratio of samples to assign to the test set.
    
    Returns:
        tuple: Indices for the train, validation, and test splits, as lists.
    """
    n_samples = len(dataset)
    target_counts = {
        'train': int(n_samples * train_ratio),
        'val': int(n_samples * val_ratio),
        'test': n_samples - int(n_samples * train_ratio) - int(n_samples * val_ratio)
    }
    
    splits = {'train': [], 'val': [], 'test': []}
    split_pixel_counts = {split: defaultdict(float) for split in splits}
    split_total_pixels = {split: 0 for split in splits}
    
    pixel_counts_per_image = {
        idx: {class_id: count * image_sizes[idx] for class_id, count in dist.items()}
        for idx, dist in distributions.items()
    }
    
    remaining_indices = set(range(len(dataset)))
    
    with tqdm.tqdm(total=n_samples, desc="Assigning images to splits") as pbar:
        while remaining_indices:
            best_cost = float('inf')
            best_assignment = None
            
            # Determine splits that still need more images
            available_splits = [split for split in splits if len(splits[split]) < target_counts[split]]
            if not available_splits:
                available_splits = ['train']
            
            indices_to_check = list(remaining_indices)
            if len(indices_to_check) > 100:
                random.shuffle(indices_to_check)
                indices_to_check = indices_to_check[:100]
            
            for idx in indices_to_check:
                pixel_counts = pixel_counts_per_image[idx]
                
                for split in available_splits:
                    new_total = split_total_pixels[split] + image_sizes[idx]
                    if new_total == 0:
                        continue
                    
                    # Compute new class distribution
                    new_dist = {
                        class_id: (split_pixel_counts[split][class_id] + pixel_counts.get(class_id, 0)) / new_total
                        for class_id in set(split_pixel_counts[split].keys()).union(pixel_counts.keys())
                    }
                    
                    # Compute cost based on deviation from target distribution
                    cost = sum(abs(target_dist.get(class_id, 0) - new_dist.get(class_id, 0)) for class_id in target_dist)
                    
                    if cost < best_cost:
                        best_cost = cost
                        best_assignment = (idx, split)
            
            if best_assignment:
                idx, split = best_assignment
                splits[split].append(idx)
                for class_id, count in pixel_counts_per_image[idx].items():
                    split_pixel_counts[split][class_id] += count
                split_total_pixels[split] += image_sizes[idx]
                remaining_indices.remove(idx)
                pbar.update(1)
            else:
                # Assign remaining images arbitrarily to balance the count
                for idx in list(remaining_indices):
                    for split in available_splits:
                        if len(splits[split]) < target_counts[split]:
                            splits[split].append(idx)
                            for class_id, count in pixel_counts_per_image[idx].items():
                                split_pixel_counts[split][class_id] += count
                            split_total_pixels[split] += image_sizes[idx]
                            remaining_indices.remove(idx)
                            pbar.update(1)
                            break
    
    # Print final class distribution for verification
    print("\nFinal pixel-level distribution in splits:")
    for split_name in ['train', 'val', 'test']:
        total_pixels = split_total_pixels[split_name]
        if total_pixels > 0:
            split_dist = {
                class_id: (count / total_pixels) * 100 for class_id, count in split_pixel_counts[split_name].items()
            }
            print(f"{split_name.capitalize()} set pixel-level distribution:")
            for class_id in sorted(split_dist.keys()):
                print(f"  - Class {class_id}: {split_dist[class_id]:.2f}% of total pixels")
    
    return splits['train'], splits['val'], splits['test']

def create_balanced_split(dataset, train_ratio=0.7, val_ratio=0.15, test_ratio=0.15, random_state=42):
    """
    Create balanced train/val/test splits while optimizing pixel-level distribution.
    
    Args:
        dataset (torch.utils.data.Dataset): The dataset containing images and their corresponding masks.
        train_ratio (float): The ratio of samples to assign to the training set.
        val_ratio (float): The ratio of samples to assign to the validation set.
        test_ratio (float): The ratio of samples to assign to the test set.
        random_state (int): Seed for random operations.
    
    Returns:
        tuple: Subsets of the dataset corresponding to the balanced train, validation, and test splits.
    """
    distributions, class_image_counts, total_pixels_per_class, image_sizes = calculate_class_distribution(dataset)
    total_pixels = sum(total_pixels_per_class.values())
    target_dist = {class_id: count / total_pixels for class_id, count in total_pixels_per_class.items()}
    
    train_indices, val_indices, test_indices = optimized_pixel_distribution_split(
        dataset, distributions, target_dist, image_sizes, train_ratio, val_ratio, test_ratio
    )
    
    return Subset(dataset, train_indices), Subset(dataset, val_indices), Subset(dataset, test_indices)

def create_balanced_datasets(material_dataset, element_dataset, train_transform, val_test_transform):
    """
    Create balanced dataset splits (train, val, test) for material and element datasets.
    
    Args:
        material_dataset (torch.utils.data.Dataset): The material dataset.
        element_dataset (torch.utils.data.Dataset): The element dataset.
        train_transform: Albumentations transform for training data.
        val_test_transform: Albumentations transform for validation and test data.
    
    Returns:
        tuple: Balanced splits for both material and element datasets (train, val, test).
    """
    print("Creating balanced splits for material dataset...")
    material_train, material_val, material_test = create_balanced_split(material_dataset)
    
    print("Creating balanced splits for element dataset...")
    element_train, element_val, element_test = create_balanced_split(element_dataset)
    
    # Apply transforms to the underlying datasets within the Subsets
    material_train.dataset.transform = train_transform
    material_val.dataset.transform = val_test_transform
    material_test.dataset.transform = val_test_transform

    element_train.dataset.transform = train_transform
    element_val.dataset.transform = val_test_transform
    element_test.dataset.transform = val_test_transform

    return material_train, material_val, material_test, element_train, element_val, element_test