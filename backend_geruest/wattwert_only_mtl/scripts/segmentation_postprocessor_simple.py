"""
Simplified semantic segmentation post-processor.
Simple and effective: polygon containment for spatial constraints.
DEPRECATED: Use the more sophisticated postprocessor instead.
"""

import numpy as np
import cv2
from scipy import ndimage
from skimage import measure
import matplotlib.pyplot as plt
from typing import Dict, List, Tuple, Any
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class SimpleSemanticPostProcessor:
    """
    Simplified post-processor for semantic segmentation masks.
    Uses polygon containment for clean, understandable logic.
    """
    
    # Class constants for semantic classes
    BACKGROUND = 0
    WINDOW = 1
    FACADE = 2
    
    def __init__(self, min_window_pixels: int = 50, min_facade_pixels: int = 1000):
        self.min_window_pixels = min_window_pixels
        self.min_facade_pixels = min_facade_pixels
    
    def process_mask(self, mask: np.ndarray, visualize: bool = True) -> Dict[str, Any]:
        """
        Process semantic segmentation mask with simplified logic.
        
        Args:
            mask: Input mask (0=background, 1=window, 2=facade)
            visualize: Show processing steps
            
        Returns:
            Dictionary with results and statistics
        """
        logger.info("🚀 Starting simplified semantic segmentation post-processing")
        original_mask = mask.copy()
        height, width = mask.shape
        
        print("🏗️ Step 1: Extract facade polygons...")
        facade_polygons = self._extract_facade_polygons(mask)
        print(f"   Found {len(facade_polygons)} facade regions")
        
        print("🪟 Step 2: Filter windows by polygon containment...")
        mask = self._filter_windows_by_containment(mask, facade_polygons)
        
        print("🧹 Step 3: Remove small components...")
        mask = self._remove_small_components(mask)
        
        print("🔍 Step 4: Detect patterns and complete missing windows...")
        mask, completed_windows = self._complete_window_patterns(mask)
        
        # Count final windows
        window_count = self._count_windows(mask)
        facade_area = np.sum(mask == self.FACADE)
        window_area = np.sum(mask == self.WINDOW)
        wwr = (window_area / facade_area * 100) if facade_area > 0 else 0
        
        print(f"📊 Final Analysis:")
        print(f"   🪟 Windows detected: {window_count}")
        print(f"   🏢 Facade regions: {len(facade_polygons)}")
        print(f"   🏗️ Windows completed: {completed_windows}")
        print(f"   📈 Window-to-Wall Ratio: {wwr:.1f}%")
        
        if visualize:
            self._visualize_results(original_mask, mask, facade_polygons)
        
        return {
            'processed_mask': mask,
            'window_count': window_count,
            'completed_windows': completed_windows,
            'window_to_wall_ratio': wwr,
            'facade_count': len(facade_polygons),
            'facade_polygons': facade_polygons,  # Return actual polygons for advanced analysis
            'processing_steps': ['polygon_extraction', 'containment_filter', 'small_removal', 'pattern_completion']
        }
    
    def _extract_facade_polygons(self, mask: np.ndarray) -> List[np.ndarray]:
        """Extract facade regions as polygons using simple contour detection."""
        facade_mask = (mask == self.FACADE).astype(np.uint8)
        
        # Find contours
        contours, _ = cv2.findContours(facade_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        polygons = []
        for contour in contours:
            # Only keep large enough facades
            area = cv2.contourArea(contour)
            if area >= self.min_facade_pixels:
                # Simplify polygon
                epsilon = 0.02 * cv2.arcLength(contour, True)
                approx = cv2.approxPolyDP(contour, epsilon, True)
                polygons.append(approx.reshape(-1, 2))
        
        return polygons
    
    def _filter_windows_by_containment(self, mask: np.ndarray, facade_polygons: List[np.ndarray]) -> np.ndarray:
        """Keep windows only if their center is inside any facade polygon."""
        if not facade_polygons:
            # No facades found - remove all windows
            mask[mask == self.WINDOW] = self.BACKGROUND
            print("   ⚠️ No facade polygons found - removing all windows")
            return mask
        
        window_mask = (mask == self.WINDOW).astype(np.uint8)
        labeled_windows = measure.label(window_mask, connectivity=2)
        
        windows_to_remove = []
        windows_preserved = 0
        
        for region in measure.regionprops(labeled_windows):
            # Get window center
            center_y, center_x = region.centroid
            center_point = (int(center_x), int(center_y))
            
            # Check if center is inside any facade polygon
            inside_facade = False
            for polygon in facade_polygons:
                result = cv2.pointPolygonTest(polygon, center_point, False)
                if result >= 0:  # Inside or on boundary
                    inside_facade = True
                    break
            
            if not inside_facade:
                windows_to_remove.append(region.label)
            else:
                windows_preserved += 1
        
        # Remove windows that are outside all facades
        for label in windows_to_remove:
            mask[labeled_windows == label] = self.BACKGROUND
        
        print(f"   🗑️ Removed {len(windows_to_remove)} windows outside facade polygons")
        print(f"   ✅ Preserved {windows_preserved} windows inside facades")
        return mask
    
    def _remove_small_components(self, mask: np.ndarray) -> np.ndarray:
        """Remove small window and facade components."""
        # Remove small windows
        window_mask = (mask == self.WINDOW).astype(np.uint8)
        labeled_windows = measure.label(window_mask, connectivity=2)
        
        small_windows = 0
        for region in measure.regionprops(labeled_windows):
            if region.area < self.min_window_pixels:
                mask[labeled_windows == region.label] = self.BACKGROUND
                small_windows += 1
        
        # Remove small facades
        facade_mask = (mask == self.FACADE).astype(np.uint8)
        labeled_facades = measure.label(facade_mask, connectivity=2)
        
        small_facades = 0
        for region in measure.regionprops(labeled_facades):
            if region.area < self.min_facade_pixels:
                mask[labeled_facades == region.label] = self.BACKGROUND
                small_facades += 1
        
        if small_windows > 0:
            print(f"   🗑️ Removed {small_windows} small window components (< {self.min_window_pixels} pixels)")
        if small_facades > 0:
            print(f"   🗑️ Removed {small_facades} small facade components (< {self.min_facade_pixels} pixels)")
        
        return mask
    
    def _complete_window_patterns(self, mask: np.ndarray) -> Tuple[np.ndarray, int]:
        """
        Complete missing windows in architectural patterns while preserving original positions.
        Only adds windows where there are obvious gaps in regular patterns.
        """
        window_positions = []
        window_sizes = []
        window_mask = (mask == self.WINDOW).astype(np.uint8)
        labeled_windows = measure.label(window_mask, connectivity=2)
        
        # Get all existing window centers and sizes
        for region in measure.regionprops(labeled_windows):
            center_y, center_x = region.centroid
            window_positions.append((int(center_y), int(center_x)))
            # Estimate window size from bounding box
            min_row, min_col, max_row, max_col = region.bbox
            window_sizes.append((max_row - min_row, max_col - min_col))
        
        if len(window_positions) < 3:
            print(f"   ⚠️ Not enough windows for pattern detection ({len(window_positions)} < 3)")
            return mask, 0  # Need at least 3 windows to detect patterns
        
        print(f"   🔍 Analyzing {len(window_positions)} existing windows for patterns")
        
        # Detect horizontal and vertical alignments
        y_coords = [pos[0] for pos in window_positions]
        x_coords = [pos[1] for pos in window_positions]
        
        # Group windows by approximate rows (horizontal alignment) - OPTIMIZED
        rows = []
        tolerance = 15  # Pixel tolerance for row alignment
        
        for i, y in enumerate(y_coords):
            x = x_coords[i]
            # Find if this y belongs to an existing row
            found_row = False
            for row in rows:
                if any(abs(y - existing_y) <= tolerance for existing_y, _ in row):
                    row.append((y, x))
                    found_row = True
                    break
            
            if not found_row:
                rows.append([(y, x)])
        
        # Filter rows to only process those with sufficient windows
        significant_rows = [row for row in rows if len(row) >= 2]
        
        completed = 0
        facade_mask = (mask == self.FACADE)
        
        # For each significant row, check for gaps - OPTIMIZED
        for row in significant_rows:
            # Sort by x coordinate
            row.sort(key=lambda pos: pos[1])
            
            # Calculate average spacing between consecutive windows - OPTIMIZED
            spacings = []
            for i in range(len(row) - 1):
                spacing = row[i + 1][1] - row[i][1]
                if 40 < spacing < 200:  # Reasonable window spacing
                    spacings.append(spacing)
            
            if not spacings:  # Skip if no valid spacings
                continue
                
            avg_spacing = int(np.mean(spacings))
            row_y = int(np.mean([pos[0] for pos in row]))
            
            print(f"   📏 Row at y={row_y}: {len(row)} windows, avg spacing={avg_spacing}px")
            
            # Check for gaps between existing windows
            for i in range(len(row) - 1):
                x1 = row[i][1]
                x2 = row[i + 1][1]
                gap_size = x2 - x1
                
                # If gap is approximately 2x the average spacing, add a window
                if 1.3 * avg_spacing < gap_size < 3.0 * avg_spacing:
                    # Calculate position for missing window
                    missing_x = int((x1 + x2) / 2)
                    
                    print(f"   🔍 Found gap: {gap_size}px between x={x1} and x={x2}, avg_spacing={avg_spacing}px")
                    
                    # Get average window size for this row
                    row_window_indices = [j for j, pos in enumerate(window_positions) 
                                        if abs(pos[0] - row_y) <= tolerance]
                    if row_window_indices:
                        avg_height = int(np.mean([window_sizes[j][0] for j in row_window_indices]))
                        avg_width = int(np.mean([window_sizes[j][1] for j in row_window_indices]))
                        
                        # Place new window
                        y1 = max(0, row_y - avg_height // 2)
                        y2 = min(mask.shape[0], row_y + avg_height // 2)
                        x1_new = max(0, missing_x - avg_width // 2)
                        x2_new = min(mask.shape[1], missing_x + avg_width // 2)
                        
                        # Only add if position is over facade and no overlap
                        if (np.any(facade_mask[y1:y2, x1_new:x2_new]) and 
                            not np.any(mask[y1:y2, x1_new:x2_new] == self.WINDOW)):
                            mask[y1:y2, x1_new:x2_new] = self.WINDOW
                            completed += 1
                            print(f"   🏗️ Added missing window at ({missing_x}, {row_y})")
        
        print(f"   🏗️ Pattern completion: Added {completed} missing windows in gaps")
        return mask, completed
    
    def _count_windows(self, mask: np.ndarray) -> int:
        """Count distinct window components."""
        window_mask = (mask == self.WINDOW).astype(np.uint8)
        labeled_windows = measure.label(window_mask, connectivity=2)
        return len(np.unique(labeled_windows)) - 1  # Subtract background
    
    def _visualize_results(self, original: np.ndarray, processed: np.ndarray, polygons: List[np.ndarray]):
        """Simple before/after visualization."""
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(15, 6))
        
        # Original
        colored_orig = np.zeros((*original.shape, 3), dtype=np.uint8)
        colored_orig[original == 0] = [135, 206, 235]  # Sky blue
        colored_orig[original == 1] = [255, 0, 0]      # Red windows
        colored_orig[original == 2] = [128, 128, 128]  # Gray facade
        
        ax1.imshow(colored_orig)
        ax1.set_title("Original Mask", fontsize=14, fontweight='bold')
        ax1.axis('off')
        
        # Processed
        colored_proc = np.zeros((*processed.shape, 3), dtype=np.uint8)
        colored_proc[processed == 0] = [135, 206, 235]  # Sky blue
        colored_proc[processed == 1] = [255, 0, 0]      # Red windows
        colored_proc[processed == 2] = [128, 128, 128]  # Gray facade
        
        ax2.imshow(colored_proc)
        ax2.set_title("Processed Mask (Simple Logic)", fontsize=14, fontweight='bold')
        ax2.axis('off')
        
        # Draw facade polygons on processed image
        for polygon in polygons:
            if len(polygon) >= 3:
                polygon_path = plt.Polygon(polygon[:, [1, 0]], fill=False, 
                                         edgecolor='yellow', linewidth=2, linestyle='--')
                ax2.add_patch(polygon_path)
        
        plt.tight_layout()
        plt.show()

def test_simple_processor():
    """Test the simplified processor."""
    print("🧪 Testing Simplified Semantic Segmentation Post-Processor\n")
    
    # Create simple test mask
    height, width = 300, 400
    mask = np.zeros((height, width), dtype=np.uint8)
    
    # Facade region
    mask[50:250, 50:350] = 2
    
    # Valid windows (inside facade)
    mask[80:100, 100:120] = 1   # Window 1
    mask[80:100, 200:220] = 1   # Window 2
    mask[150:170, 100:120] = 1  # Window 3
    # Missing: mask[150:170, 200:220] = 1  # Window 4 (will be completed)
    
    # Noise windows (outside facade)
    mask[10:25, 100:115] = 1    # Noise 1
    mask[100:115, 10:25] = 1    # Noise 2
    
    # Process
    processor = SimpleSemanticPostProcessor(min_window_pixels=30, min_facade_pixels=500)
    results = processor.process_mask(mask, visualize=True)
    
    print(f"\n✅ Results:")
    print(f"  Windows found: {results['window_count']}")
    print(f"  Windows completed: {results['completed_windows']}")
    print(f"  WWR: {results['window_to_wall_ratio']:.1f}%")
    print(f"  Steps: {' → '.join(results['processing_steps'])}")

if __name__ == "__main__":
    test_simple_processor()
