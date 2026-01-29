import numpy as np
import torch
import cv2
import traceback

def _to_absolute_kernel_size(size, reference_dim):
    """Converts relative (0-1) or absolute (>1) size to absolute pixels."""
    if isinstance(size, float) and 0 < size < 1:
        # Relative size: convert to absolute
        abs_size = int(reference_dim * size)
    else:
        # Already absolute
        abs_size = int(size)
    
    # Ensure odd number >= 3 for OpenCV kernels
    abs_size = max(3, abs_size)
    if abs_size % 2 == 0:
        abs_size += 1
    
    return abs_size

def mask_to_jsonb(mask) -> dict:
    """
    Converts a PyTorch mask tensor or NumPy array to a JSONB-compatible dictionary using RLE compression.
    
    Args:
        mask: Tensor [H, W] or NumPy array [H, W] with bool or 0/1 values
        
    Returns:
        dict: {"rle": {"counts": [...], "size": [H, W]}}
    """
    # Handle both torch tensors and numpy arrays
    if isinstance(mask, torch.Tensor):
        mask_np = mask.cpu().numpy().astype(bool)
    elif isinstance(mask, np.ndarray):
        mask_np = mask.astype(bool)
    else:
        raise TypeError(f"Expected torch.Tensor or np.ndarray, got {type(mask)}")
    
    # Remove channel dimension if present (e.g. [1, H, W] -> [H, W])
    if mask_np.ndim == 3:
        mask_np = mask_np.squeeze(0)
        
    h, w = mask_np.shape
    
    # Flatten (Row-major)
    flat_mask = mask_np.flatten()
    
    padded = np.concatenate(([False], flat_mask, [False]))
    changes = np.where(padded[1:] != padded[:-1])[0]
    counts = np.diff(np.concatenate(([0], changes)))
    
    return {
        "rle": {
            "counts": counts.tolist(),
            "size": [h, w]
        }
    }

def encode_rle_int(mask_array: np.ndarray) -> list:
    """
    Encodes an integer array into RLE format [val1, count1, val2, count2, ...].
    """
    flat_pred = mask_array.flatten()
    changes = flat_pred[:-1] != flat_pred[1:]
    indices = np.append(np.where(changes), flat_pred.size - 1)
    run_lengths = np.diff(np.append(-1, indices))
    values = flat_pred[indices]
    
    rle_encoded = []
    for val, length in zip(values, run_lengths):
        rle_encoded.extend([int(val), int(length)])
    return rle_encoded

def decode_rle_int(rle_data: dict) -> np.ndarray:
    """
    Decodes integer RLE format [val1, count1, val2, count2, ...] back to numpy array.
    Expects rle_data to be a dict with "counts" (list) and "size" ([h, w]).
    """
    counts = rle_data["counts"]
    h, w = rle_data["size"]
    mask = np.zeros(h * w, dtype=np.int32)
    current_idx = 0
    for i in range(0, len(counts), 2):
        val = counts[i]
        length = counts[i+1]
        mask[current_idx:current_idx+length] = val
        current_idx += length
    return mask.reshape((h, w))

def decode_rle_binary(rle_data: dict) -> np.ndarray:
    """
    Decodes binary RLE format [count_0, count_1, count_0, ...] back to numpy array.
    Expects rle_data to be a dict with "counts" (list) and "size" ([h, w]).
    """
    counts = rle_data["counts"]
    h, w = rle_data["size"]
    
    total_pixels = h * w
    mask_flat = np.zeros(total_pixels, dtype=np.uint8)
    
    start_idx = 0
    current_val = 0 # RLE assumes starting with 0 (background)
    
    for count in counts:
        if current_val == 1:
            # Ensure we don't go out of bounds (robustness)
            end_idx = min(start_idx + count, total_pixels)
            mask_flat[start_idx:end_idx] = 1
        
        start_idx += count
        current_val = 1 - current_val
        
    return mask_flat.reshape((h, w))

def encode_rle_binary(binary_mask: np.ndarray) -> dict:
    """
    Encodes a binary mask (0/1) into RLE format compatible with decode_rle_binary.
    Row-major order. Starts with count of 0s.
    Returns a dictionary with 'counts' and 'size'.
    """
    flat_mask = binary_mask.flatten()
    h, w = binary_mask.shape
    
    # Find indices where value changes
    changes = np.diff(flat_mask.astype(np.int8))
    idx = np.where(changes != 0)[0] + 1
    
    if len(idx) == 0:
        # All pixels are the same
        counts = [len(flat_mask)]
    else:
        # Calculate run lengths
        counts = [idx[0]] + (idx[1:] - idx[:-1]).tolist() + [len(flat_mask) - idx[-1]]
        
    # Ensure we start with a count for 0s
    if flat_mask[0] == 1:
        counts.insert(0, 0)
        
    # Convert numpy types to standard python types for JSON serialization
    counts = [int(c) for c in counts]
    
    return {
        "counts": counts,
        "size": [int(h), int(w)]
    }



def get_shape_from_batch_results(raw_results):
    """
    Determines the image shape (height, width) from SAM3 batch results.
    
    Args:
        raw_results (dict): Dictionary with keys 'facade', 'window', 'door', 'roof', each containing 'masks' list.
    
    Returns:
        tuple: (height, width) if shape could be determined, None otherwise
    """
    # Determine shape from one of the masks
    for key in ["facade", "window", "door", "roof"]:
        masks = raw_results.get(key, {}).get("masks", [])

        # Support both list-of-masks and torch.Tensor stacks
        if isinstance(masks, torch.Tensor):
            if masks.numel() == 0:
                continue
            first_mask = masks[0]
        else:
            if len(masks) == 0:
                continue
            first_mask = masks[0]

        if hasattr(first_mask, "shape"):
            shape = first_mask.shape
            if len(shape) >= 2:
                img_h, img_w = shape[-2], shape[-1]
                return (img_h, img_w)
    
    return None

def merge_layers(raw_results, shape, class_mappings, cleaning_config=None):
    """
    Takes raw SAM3 batch results and merges them into a single semantic map.
    Optionally applies cleaning to each mask before merging.
    
    Prioritizes classes based on layering logic (Window comes last, on top of everything).
    
    Args:
        raw_results (dict): Dictionary with keys 'facade', 'window', 'door', 'roof', each containing 'masks' list.
        shape (tuple): Target shape (height, width).
        class_mappings (dict): Mapping from name to integer ID (e.g. {'building': 1, 'window': 2}).
        cleaning_config (dict, optional): Configuration for cleaning. If None, no cleaning is applied.
            Format: {"facade": {"close_kernel_size": 0.012, "contour_mode": cv2.RETR_TREE, "iterations": 3}, ...}
        
    Returns:
        np.ndarray: Combined semantic map (int32).
    """
    img_h, img_w = shape
    semantic_map = np.zeros((img_h, img_w), dtype=np.int32)
    
    # Define processing order and class IDs
    # Order matters: Later classes overwrite earlier ones
    # 1. Facade (Base)
    # 2. Door (on top of Facade)
    # 3. Roof (on top of Door/Facade)
    # 4. Window (on top of everything - comes last)
    
    layers = [
        {"key": "facade", "class_id": class_mappings.get("building", 1), "config_key": "facade"},
        {"key": "door", "class_id": class_mappings.get("door", 3), "config_key": "door"},
        {"key": "roof", "class_id": class_mappings.get("roof", 4), "config_key": "roof"},
        {"key": "window", "class_id": class_mappings.get("window", 2), "config_key": "window"}
    ]
    
    if cleaning_config is None:
        print("[PostProcessing] Merging raw masks (without cleaning)...")
    else:
        print("[PostProcessing] Merging and cleaning raw masks...")
    
    for layer in layers:
        key = layer["key"]
        class_id = layer["class_id"]
        config_key = layer["config_key"]
        
        if key not in raw_results:
            continue
            
        result_data = raw_results[key]
        masks = result_data.get("masks", [])
        
        if len(masks) == 0:
            continue
        
        # Get cleaning config if provided
        layer_config = None
        if cleaning_config is not None:
            layer_config = cleaning_config.get(config_key, {})
            print(f"  - Processing {key} ({len(masks)} masks) with config: {layer_config}")
        else:
            print(f"  - Processing {key} ({len(masks)} masks)")
        
        # Get cleaning parameters if config provided
        close_size = None
        contour_mode = None
        iterations = None
        if layer_config:
            close_size = layer_config.get("close_kernel_size")
            contour_mode = layer_config.get("contour_mode")
            iterations = layer_config.get("iterations")
        
        # Combine all masks for this class first (Union)
        class_union_mask = np.zeros((img_h, img_w), dtype=np.uint8)
        
        for mask in masks:
            # Convert torch tensor to numpy if needed
            if hasattr(mask, "cpu"):
                mask_np = mask.cpu().numpy()
            else:
                mask_np = np.asarray(mask)
            
            # Handle dimensions: Squeeze batch/channel dims if present
            mask_np = np.squeeze(mask_np)

            # Resize if needed
            if mask_np.shape != (img_h, img_w):
                mask_np = cv2.resize(mask_np.astype(np.uint8), (img_w, img_h), interpolation=cv2.INTER_NEAREST)
            
            # Binarize
            mask_np = (mask_np > 0).astype(np.uint8)
            
            # Apply cleaning if config provided
            if layer_config and close_size is not None:
                mask_np = clean_facade_mask_closing_only(mask_np, close_size, contour_mode, iterations)
            
            # Add to class union
            class_union_mask = cv2.bitwise_or(class_union_mask, mask_np)
            
        # Write to semantic map (overwrite existing pixels)
        semantic_map[class_union_mask > 0] = class_id
    
    return semantic_map

def clean_facade_mask_closing_only(mask, close_kernel_size=0.005, contour_mode=cv2.RETR_TREE, iterations=2):
    """
    Cleans facade masks using morphological closing and contour filling.
    1. Morphological closing to fill small holes (iterative)
    2. Contour filling for larger internal holes
    
    Funktionsweise:
    - Morphological closing (Dilation + Erosion) füllt kleine Löcher und Dellen
    - Iteratives Anwenden für hartnäckige Löcher
    - Contour filling füllt größere interne Löcher
    - Die Maske kann minimal expandieren (typisch <1% der Kernel-Größe)
    - Dellen und Lücken werden zuverlässig gefüllt
    
    Verwendung:
    - Preprocessing: Hauptfassaden-Identifikation (große Kernel möglich)
    - Postprocessing: Semantische Segmentierung (kleine Kernel für Präzision)
    
    Args:
        mask (np.ndarray): Binary mask (uint8 or bool)
        close_kernel_size (float or int): 
            - If float between 0 and 1: Relative size as fraction of image width (default: 0.005 = 0.5%)
            - If int > 1: Absolute pixel size
            - Größere Werte (z.B. 0.03 in crop_image) verbinden weiter entfernte Bereiche
            - Kleinere Werte (z.B. 0.005-0.007 in postprocessing) für präzise Bereinigung
        contour_mode: OpenCV contour retrieval mode 
            - cv2.RETR_TREE: Alle Konturen inkl. verschachtelter Löcher (Standard)
            - cv2.RETR_EXTERNAL: Nur äußere Konturen
        iterations (int): Anzahl der Iterationen für morphological closing (default: 2)
    
    Returns:
        np.ndarray: Cleaned binary mask (uint8)
    """
    if mask is None:
        return None
    
    # Ensure mask is uint8 and binary (0/1)
    mask_array = (mask > 0).astype(np.uint8)
    img_height, img_width = mask_array.shape
    
    try:
        # Convert kernel size to absolute value
        close_kernel_abs = _to_absolute_kernel_size(close_kernel_size, img_width)
        
        # Step 1: Iterative morphological closing to fill small holes
        # HINWEIS: Closing (Dilation + Erosion) kann Rand-Pixel verändern
        if close_kernel_abs > 0:
            kernel = np.ones((close_kernel_abs, close_kernel_abs), np.uint8)
            mask_array = cv2.morphologyEx(mask_array, cv2.MORPH_CLOSE, kernel, iterations=iterations)
            print(f"[DEBUG] Applied closing ({close_kernel_abs}x{close_kernel_abs} px, {close_kernel_abs/img_width*100:.2f}% of width, {iterations} iterations) to fill small holes")
        
        # Step 2: Fill larger internal holes using contours
        # HINWEIS: Contour filling überschreibt die Maske und kann Ränder verändern
        contours, _ = cv2.findContours(mask_array, contour_mode, cv2.CHAIN_APPROX_SIMPLE)
        filled_mask = np.zeros_like(mask_array)
        cv2.drawContours(filled_mask, contours, -1, 1, thickness=cv2.FILLED)
        
        print(f"[DEBUG] Applied mask cleanup (closing: {close_kernel_abs}px x{iterations}, hole filling) - borders may be affected")
        
        return filled_mask
        
    except Exception as e:
        print(f"Error in clean_facade_mask_closing_only: {e}")
        traceback.print_exc()
        return mask.astype(np.uint8) # Return original on error
