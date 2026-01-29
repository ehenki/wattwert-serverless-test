"""
Zentraler Cache für das SAM3-Modell.
Stellt sicher, dass das große Modell nur einmal in den Speicher geladen wird.
"""

import os
from aufmass_core.models.sam3.image_inference import Sam3ImageSegmenter

# Globale Variable für Singleton-Pattern
_SAM3_SEGMENTER = None


def get_sam3_segmenter():
    """
    Lädt das SAM3-Modell nur einmal (Singleton-Pattern / Lazy Loading).
    Diese Funktion wird von allen Modulen verwendet, die SAM3 benötigen.
    
    Returns:
        Sam3ImageSegmenter: Die gecachte SAM3-Modell-Instanz
        
    Raises:
        Exception: Wenn das Modell nicht geladen werden kann
    """
    global _SAM3_SEGMENTER
    
    if _SAM3_SEGMENTER is None:
        try:
            import gc
            import torch
            
            # Clean up memory before loading large model
            print("[SAM3] Cleaning up memory before model initialization...")
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            
            print("[SAM3] Initializing image model on cpu...")
            print("[SAM3] This may take a few minutes on first run (downloading model from HuggingFace)...")
            print("[SAM3] Model size is ~2-4GB, please ensure sufficient RAM is available...")
            
            # Use environment variable to enable compilation (default: False for local dev)
            use_compile = os.getenv("SAM3_COMPILE", "false").lower() == "true"
            if use_compile:
                print("[SAM3] torch.compile() enabled via SAM3_COMPILE environment variable")
            
            _SAM3_SEGMENTER = Sam3ImageSegmenter(device="cpu", compile=use_compile)
            
            print("[SAM3] ✓ Model successfully loaded and cached!")
            
        except Exception as e:
            print(f"[ERROR] Failed to initialize SAM3 model: {e}")
            print("[ERROR] Possible causes:")
            print("  - Insufficient RAM (model requires ~4-8GB)")
            print("  - Network error during model download")
            print("  - Missing dependencies")
            import traceback
            traceback.print_exc()
            raise
            
    return _SAM3_SEGMENTER


def clear_sam3_cache():
    """
    Löscht den SAM3-Model-Cache und gibt den Speicher frei.
    Nützlich zum Debuggen oder bei Speicherproblemen.
    """
    global _SAM3_SEGMENTER
    
    if _SAM3_SEGMENTER is not None:
        print("[SAM3] Clearing model cache...")
        del _SAM3_SEGMENTER
        _SAM3_SEGMENTER = None
        
        # Garbage Collection erzwingen
        import gc
        gc.collect()
        
        print("[SAM3] ✓ Cache cleared")
