"""
Generic SAM 3 Image-Inference wrapper.

Usage:

    from aufmass_core.models.sam3.image_inference import Sam3ImageSegmenter

    segmenter = Sam3ImageSegmenter(device="cpu")  # or "cuda"
    result = segmenter.segment("path/to/image.jpg", prompt="your prompt")

    masks  = result["masks"]   # Tensor [N, H, W]
    boxes  = result["boxes"]   # Tensor [N, 4]
    scores = result["scores"]  # Tensor [N]
"""

from pathlib import Path
from typing import Union, Dict, Any, List

import torch
from PIL import Image

from sam3.model_builder import build_sam3_image_model
from sam3.model.sam3_image_processor import Sam3Processor


ImageLike = Union[str, Path, Image.Image]


class Sam3ImageSegmenter:
    """
    Wrapper around the official SAM3 API for images:
    - Initializes model + processor once
    - Provides a .segment() method for inference
    """

    def __init__(self, device: str = "cpu", compile: bool = False) -> None:
        """
        device: "cpu" or "cuda"
        compile: Whether to use torch.compile() for faster inference (default: False)
        """
        self.device = torch.device(device)
        print(f"[SAM3] Initializing image model on {self.device}...")
        
        # Free up memory before loading large model
        import gc
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
        
        # Try with compilation first, fallback to non-compiled if it fails
        if compile:
            try:
                print(f"[SAM3] Attempting to compile model with torch.compile()...")
                self.model = build_sam3_image_model(compile=True)
                print(f"[SAM3] ✓ Model compiled successfully!")
            except Exception as e:
                print(f"[SAM3] ⚠ Compilation failed: {e}")
                print(f"[SAM3] Falling back to non-compiled model...")
                self.model = build_sam3_image_model(compile=False)
        else:
            self.model = build_sam3_image_model(compile=False)
        
        self.model.to(self.device)
        self.model.eval()

        self.processor = Sam3Processor(self.model, device=device)

    @staticmethod
    def _load_image(image: ImageLike) -> Image.Image:
        """
        Helper function: accepts path or PIL.Image and returns PIL.Image.
        """
        if isinstance(image, (str, Path)):
            return Image.open(image).convert("RGB")
        elif isinstance(image, Image.Image):
            return image.convert("RGB")
        else:
            raise TypeError(f"Unsupported image type: {type(image)}")

    def segment(
        self,
        image: ImageLike,
        prompt: str,
        score_threshold: float = 0.0,
    ) -> Dict[str, Any]:
        """
        Performs SAM3 inference on an image.

        Args:
            image: Path (str/Path) or PIL.Image
            prompt: Text prompt for segmentation
            score_threshold: Optional filter for scores

        Returns:
            {
                "masks":  Tensor [N, H, W] (CPU),
                "boxes":  Tensor [N, 4]    (CPU),
                "scores": Tensor [N]       (CPU),
            }
        """
        pil_image = self._load_image(image)

        inference_state = self.processor.set_image(pil_image)
        output = self.processor.set_text_prompt(state=inference_state, prompt=prompt)

        masks = output["masks"]   # [N, H, W]
        boxes = output["boxes"]   # [N, 4]
        scores = output["scores"] # [N]

        if score_threshold > 0.0:
            keep = scores >= score_threshold
            masks = masks[keep]
            boxes = boxes[keep]
            scores = scores[keep]

        return {
            "masks": masks.cpu(),
            "boxes": boxes.cpu(),
            "scores": scores.cpu(),
        }

    def segment_batch(
        self,
        image: ImageLike,
        prompts: List[str],
        score_threshold: float = 0.0,
    ) -> Dict[str, Dict[str, Any]]:
        """
        Performs SAM3 inference on an image with multiple prompts in one pass.
        Much faster than calling segment() multiple times because the backbone
        is only computed once.

        Args:
            image: Path (str/Path) or PIL.Image
            prompts: List of text prompts for segmentation (e.g., ["wall", "window", "door"])
            score_threshold: Optional filter for scores

        Returns:
            Dictionary mapping each prompt to its results:
            {
                "wall": {
                    "masks":  Tensor [N, H, W] (CPU),
                    "boxes":  Tensor [N, 4]    (CPU),
                    "scores": Tensor [N]       (CPU),
                },
                "window": { ... },
                ...
            }
        """
        pil_image = self._load_image(image)
        
        # 1. Set image once (computes backbone features - expensive!)
        inference_state = self.processor.set_image(pil_image)
        
        # 2. Process each prompt (reuses backbone features - fast!)
        results = {}
        for prompt in prompts:
            output = self.processor.set_text_prompt(state=inference_state, prompt=prompt)
            
            masks = output["masks"]   # [N, H, W]
            boxes = output["boxes"]   # [N, 4]
            scores = output["scores"] # [N]
            
            if score_threshold > 0.0:
                keep = scores >= score_threshold
                masks = masks[keep]
                boxes = boxes[keep]
                scores = scores[keep]
            
            results[prompt] = {
                "masks": masks.cpu(),
                "boxes": boxes.cpu(),
                "scores": scores.cpu(),
            }
        
        return results


# Optional: CLI for testing
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="SAM3 Image Inference Test")
    parser.add_argument("image", type=str, help="Path to input image (jpg/png)")
    parser.add_argument("--prompt", type=str, required=True, help="Text prompt")
    parser.add_argument(
        "--score_thresh",
        type=float,
        default=0.5,
        help="Score threshold for filtering",
    )
    parser.add_argument(
        "--device",
        type=str,
        default="cpu",
        help='Device: "cpu" or "cuda"',
    )
    parser.add_argument(
        "--no-compile",
        action="store_true",
        help="Disable torch.compile() optimization",
    )

    args = parser.parse_args()

    segmenter = Sam3ImageSegmenter(device=args.device, compile=not args.no_compile)
    result = segmenter.segment(
        image=args.image,
        prompt=args.prompt,
        score_threshold=args.score_thresh,
    )

    masks = result["masks"]
    boxes = result["boxes"]
    scores = result["scores"]

    print(f"[SAM3] Found instances: {len(masks)}")
    for i, (b, s) in enumerate(zip(boxes, scores)):
        x1, y1, x2, y2 = b.tolist()
        print(f"  #{i}: score={s:.3f}, box=({x1:.0f},{y1:.0f},{x2:.0f},{y2:.0f})")
