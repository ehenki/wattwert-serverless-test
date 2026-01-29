"""
Debug and fix the test mask creation.
"""

import numpy as np
import matplotlib.pyplot as plt

def debug_test_mask():
    """Debug the test mask creation to understand the spatial constraints."""
    print("🔍 Debugging test mask creation...")
    
    height, width = 400, 600
    mask = np.zeros((height, width), dtype=np.uint8)
    
    # Create building facade
    facade_margin = 50
    print(f"Facade region: [{facade_margin}:{height-facade_margin}, {facade_margin}:{width-facade_margin}]")
    mask[facade_margin:height-facade_margin, facade_margin:width-facade_margin] = 2
    
    # SIMPLIFIED TEST: Use polygon containment logic
    # Simple rule: window center inside facade polygon → KEEP, otherwise → REMOVE
    
    print("🔄 Applying SIMPLIFIED post-processing logic...")
    from segmentation_postprocessor_simple import SimpleSemanticPostProcessor
    
    # Create test windows
    window_height = 26
    window_width = 24
    
    # Create realistic windows that are spatially adjacent to facade
    center_y = height // 2
    center_x = width // 2
    
    y_start = center_y - window_height // 2
    y_end = center_y + window_height // 2
    x_start = center_x - window_width // 2
    x_end = center_x + window_width // 2
    
    print(f"Valid window: [{y_start}:{y_end}, {x_start}:{x_end}] - INSIDE facade bounds")
    # Create a window within the facade spatial region
    mask[y_start:y_end, x_start:x_end] = 1  # This replaces facade pixels
    
    # One window outside facade (noise) 
    noise_y = 10  # Outside facade margin
    noise_x = 100
    noise_end_y = noise_y + 15
    noise_end_x = noise_x + 12
    
    print(f"Noise window: [{noise_y}:{noise_end_y}, {noise_x}:{noise_end_x}] - OUTSIDE facade")
    mask[noise_y:noise_end_y, noise_x:noise_end_x] = 1
    
    # NOW PROCESS WITH SIMPLIFIED POST-PROCESSOR
    print("\n🔄 Applying SIMPLIFIED post-processing logic...")
    from segmentation_postprocessor_simple import SimpleSemanticPostProcessor
    
    processor = SimpleSemanticPostProcessor(
        min_window_pixels=20,
        min_facade_pixels=100
    )
    
    results = processor.process_mask(mask.copy(), visualize=False)
    processed_mask = results['processed_mask']  
    # Analyze both masks
    print(f"\nORIGINAL mask analysis:")
    unique, counts = np.unique(mask, return_counts=True)
    for val, count in zip(unique, counts):
        class_name = {0: "Background", 1: "Window", 2: "Facade"}
        print(f"  {class_name.get(val, f'Class {val}')}: {count:,} pixels")
    
    print(f"\nPROCESSED mask analysis:")
    unique, counts = np.unique(processed_mask, return_counts=True)
    for val, count in zip(unique, counts):
        class_name = {0: "Background", 1: "Window", 2: "Facade"}
        print(f"  {class_name.get(val, f'Class {val}')}: {count:,} pixels")
    
    # CREATE SIDE-BY-SIDE COMPARISON
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(16, 8))
    
    # ORIGINAL mask visualization
    colored_original = np.zeros((height, width, 3), dtype=np.uint8)
    colored_original[mask == 0] = [135, 206, 235]  # Blue background
    colored_original[mask == 1] = [255, 0, 0]      # Red windows
    colored_original[mask == 2] = [128, 128, 128]  # Gray facade
    
    ax1.imshow(colored_original)
    ax1.set_title("ORIGINAL Mask", fontsize=14, fontweight='bold')
    ax1.axis('off')
    
    # Add facade boundary lines to original
    ax1.axhline(y=facade_margin, color='yellow', linestyle='--', alpha=0.7)
    ax1.axhline(y=height-facade_margin, color='yellow', linestyle='--', alpha=0.7)
    ax1.axvline(x=facade_margin, color='yellow', linestyle='--', alpha=0.7)
    ax1.axvline(x=width-facade_margin, color='yellow', linestyle='--', alpha=0.7)
    
    # Mark windows in original
    ax1.text(center_x, center_y-40, "VALID\n(inside facade)", 
             ha='center', va='center', color='white', fontweight='bold',
             bbox=dict(boxstyle="round,pad=0.3", facecolor='green', alpha=0.8))
    
    ax1.text(noise_x + 6, noise_y + 7, "NOISE\n(outside facade)", 
             ha='center', va='center', color='white', fontweight='bold',
             bbox=dict(boxstyle="round,pad=0.3", facecolor='red', alpha=0.8))
    
    # PROCESSED mask visualization
    colored_processed = np.zeros((height, width, 3), dtype=np.uint8)
    colored_processed[processed_mask == 0] = [135, 206, 235]  # Blue background
    colored_processed[processed_mask == 1] = [255, 0, 0]      # Red windows
    colored_processed[processed_mask == 2] = [128, 128, 128]  # Gray facade
    
    ax2.imshow(colored_processed)
    ax2.set_title("PROCESSED Mask (Simple Logic)", fontsize=14, fontweight='bold')
    ax2.axis('off')
    
    # Add facade boundary lines to processed
    ax2.axhline(y=facade_margin, color='yellow', linestyle='--', alpha=0.7)
    ax2.axhline(y=height-facade_margin, color='yellow', linestyle='--', alpha=0.7)
    ax2.axvline(x=facade_margin, color='yellow', linestyle='--', alpha=0.7)
    ax2.axvline(x=width-facade_margin, color='yellow', linestyle='--', alpha=0.7)
    
    # Check what happened to each region
    valid_window_preserved = processed_mask[y_start:y_end, x_start:x_end]
    noise_window_removed = processed_mask[noise_y:noise_end_y, noise_x:noise_end_x]
    
    valid_still_window = np.sum(valid_window_preserved == 1) > 0
    noise_was_removed = np.sum(noise_window_removed == 1) == 0
    
    if valid_still_window:
        ax2.text(center_x, center_y-40, "PRESERVED\n(valid window)", 
                 ha='center', va='center', color='white', fontweight='bold',
                 bbox=dict(boxstyle="round,pad=0.3", facecolor='green', alpha=0.8))
    else:
        ax2.text(center_x, center_y-40, "REMOVED\n(ERROR!)", 
                 ha='center', va='center', color='white', fontweight='bold',
                 bbox=dict(boxstyle="round,pad=0.3", facecolor='red', alpha=0.8))
    
    if noise_was_removed:
        ax2.text(noise_x + 6, noise_y + 7, "REMOVED\n(noise cleaned)", 
                 ha='center', va='center', color='white', fontweight='bold',
                 bbox=dict(boxstyle="round,pad=0.3", facecolor='green', alpha=0.8))
    else:
        ax2.text(noise_x + 6, noise_y + 7, "NOT REMOVED\n(noise remains)", 
                 ha='center', va='center', color='white', fontweight='bold',
                 bbox=dict(boxstyle="round,pad=0.3", facecolor='orange', alpha=0.8))
    
    plt.tight_layout()
    plt.show()
    
    # Print detailed analysis
    print(f"\n📊 Post-Processing Analysis:")
    print(f"  Valid window preserved: {'✅ YES' if valid_still_window else '❌ NO - THIS IS A BUG!'}")
    print(f"  Noise window removed: {'✅ YES' if noise_was_removed else '⚠️ NO'}")
    print(f"  Windows detected: {results['window_count']}")
    print(f"  Windows completed: {results.get('completed_windows', 0)}")  # ✅ ADDED
    
    return mask, processed_mask

def create_working_test_mask(height: int = 400, width: int = 600) -> np.ndarray:
    """Create a test mask that demonstrates the optimized post-processing logic."""
    mask = np.zeros((height, width), dtype=np.uint8)
    
    # Create building facade (larger area)
    facade_margin = 50
    mask[facade_margin:height-facade_margin, facade_margin:width-facade_margin] = 2
    
    # Create windows in a regular pattern (all must be inside facade)
    window_height = 25
    window_width = 20
    
    # Calculate safe positions inside facade with buffer
    facade_height = height - 2 * facade_margin
    facade_width = width - 2 * facade_margin
    buffer = 10  # Safety buffer from facade edges
    
    rows = 3
    cols = 4
    
    for row in range(rows):
        for col in range(cols):
            # Skip one window to test pattern completion (row 1, col 1)
            if row == 1 and col == 1:
                continue
            
            # Calculate position with proper spacing
            row_spacing = (facade_height - 2 * buffer) // (rows + 1)
            col_spacing = (facade_width - 2 * buffer) // (cols + 1)
            
            center_y = facade_margin + buffer + (row + 1) * row_spacing
            center_x = facade_margin + buffer + (col + 1) * col_spacing
            
            # Place window ensuring it stays within facade bounds
            y_start = center_y - window_height // 2
            y_end = center_y + window_height // 2
            x_start = center_x - window_width // 2
            x_end = center_x + window_width // 2
            
            # Double check bounds
            y_start = max(facade_margin + buffer, y_start)
            y_end = min(height - facade_margin - buffer, y_end)
            x_start = max(facade_margin + buffer, x_start)
            x_end = min(width - facade_margin - buffer, x_end)
            
            # Verify window is completely inside facade
            if (y_end <= height - facade_margin and y_start >= facade_margin and
                x_end <= width - facade_margin and x_start >= facade_margin):
                mask[y_start:y_end, x_start:x_end] = 1
    
    # Add noise: window pixels OUTSIDE facade (these should be removed)
    print("   Adding noise: window pixels outside facade...")
    noise_count = 0
    for _ in range(8):
        # Random positions outside facade area
        if np.random.random() < 0.5:
            # Top or bottom margin
            y = np.random.randint(0, facade_margin) if np.random.random() < 0.5 else np.random.randint(height-facade_margin, height-5)
            x = np.random.randint(0, width-5)
        else:
            # Left or right margin
            y = np.random.randint(0, height-5)
            x = np.random.randint(0, facade_margin) if np.random.random() < 0.5 else np.random.randint(width-facade_margin, width-5)
        
        # Small noise window
        noise_size = np.random.randint(2, 6)
        y_end = min(height, y + noise_size)
        x_end = min(width, x + noise_size)
        mask[y:y_end, x:x_end] = 1
        noise_count += (y_end - y) * (x_end - x)
    
    print(f"   Added {noise_count} noise pixels outside facade")
    
    return mask

def test_working_mask():
    """Test the simplified mask processing."""
    print("\n🧪 Testing simplified semantic segmentation post-processing...")
    
    from segmentation_postprocessor_simple import SimpleSemanticPostProcessor
    
    # Create test mask with noise
    test_mask = create_working_test_mask(400, 600)
    
    print(f"Original mask statistics:")
    unique, counts = np.unique(test_mask, return_counts=True)
    for val, count in zip(unique, counts):
        class_name = {0: "Background", 1: "Window", 2: "Facade"}
        print(f"  {class_name.get(val, f'Class {val}')}: {count:,} pixels")
    
    # Process with simplified post-processor
    processor = SimpleSemanticPostProcessor(
        min_window_pixels=30,  # Very permissive for testing
        min_facade_pixels=500
    )
    
    results = processor.process_mask(test_mask, visualize=True)
    
    print(f"\n✅ Processing Results:")
    print(f"  Windows detected: {results['window_count']}")
    print(f"  Windows completed: {results.get('completed_windows', 0)}")
    print(f"  Facade regions: {results.get('facade_count', 0)}")          
    print(f"  WWR: {results['window_to_wall_ratio']:.1f}%")
    print(f"  Processing steps: {', '.join(results['processing_steps'])}")
    
    return results

if __name__ == "__main__":
    # First debug the issue
    debug_mask = debug_test_mask()
    
    # Then test with working mask
    test_working_mask()
