import numpy as np
import cv2
import tempfile
import os
import matplotlib.pyplot as plt
from aufmass_core.database_download_functions import _get_facade_image
from aufmass_core.database_upload_functions import _upload_facade_image
from aufmass_core.datastructure.aufmassClasses import FacadeImage

# Farbpalette für SAM3 Main Segmentation
# BGR-Format für OpenCV: [Blue, Green, Red]
ELEMENT_PALETTE = {
    0: [0, 0, 0],           # 0: Background - Schwarz
    1: [0, 0, 255],         # 1: Wall/Facade - Rot
    2: [139, 0, 0],         # 2: Window - Dunkelblau
    3: [19, 69, 139],       # 3: Door - Rostbraun
    4: [128, 128, 128]      # 4: Roof - Grau
}


def _visualize_overlay(base_image: np.ndarray, mask_colored: np.ndarray, overlay_image: np.ndarray, facade_id: str):
    """
    Zeigt das Original-Bild, die farbcodierte Maske und das Overlay-Ergebnis an.
    
    Args:
        base_image: Das Original rectified Bild (BGR)
        mask_colored: Die farbcodierte Segmentierungsmaske (BGR)
        overlay_image: Das finale Overlay-Bild (BGR)
        facade_id: Fassaden-ID für den Titel
    """
    try:
        # Konvertiere BGR zu RGB für matplotlib
        base_rgb = cv2.cvtColor(base_image, cv2.COLOR_BGR2RGB)
        mask_rgb = cv2.cvtColor(mask_colored, cv2.COLOR_BGR2RGB)
        overlay_rgb = cv2.cvtColor(overlay_image, cv2.COLOR_BGR2RGB)
        
        # Erstelle Figure mit 3 Subplots
        fig, axes = plt.subplots(1, 3, figsize=(18, 6))
        
        axes[0].imshow(base_rgb)
        axes[0].set_title('Original Rectified Image', fontsize=12, fontweight='bold')
        axes[0].axis('off')
        
        axes[1].imshow(mask_rgb)
        axes[1].set_title('Segmentation Mask (Color-coded)', fontsize=12, fontweight='bold')
        axes[1].axis('off')
        
        axes[2].imshow(overlay_rgb)
        axes[2].set_title('Overlay (30% Transparency)', fontsize=12, fontweight='bold')
        axes[2].axis('off')
        
        # Legende für die Farben (SAM3 Main Segmentation)
        class_names = {
            0: 'Background',
            1: 'Wall/Facade',
            2: 'Window',
            3: 'Door',
            4: 'Roof'
        }
        
        # Erstelle Custom Legend Patches
        from matplotlib.patches import Patch
        legend_elements = []
        for class_id, color_bgr in ELEMENT_PALETTE.items():
            if class_id == 0:  # Skip background
                continue
            # Konvertiere BGR zu RGB und normalisiere auf [0, 1]
            color_rgb = [color_bgr[2]/255, color_bgr[1]/255, color_bgr[0]/255]
            legend_elements.append(Patch(facecolor=color_rgb, label=class_names.get(class_id, f'Class {class_id}')))
        
        # Füge Legende unterhalb der Figure hinzu
        fig.legend(handles=legend_elements, loc='lower center', ncol=4, 
                  frameon=True, fontsize=10, bbox_to_anchor=(0.5, -0.05))
        
        plt.suptitle(f'Segmentation Overlay - Facade {facade_id}', fontsize=14, fontweight='bold')
        plt.tight_layout()
        plt.subplots_adjust(bottom=0.15)  # Platz für Legende
        plt.show()
        
        print("Visualization displayed successfully.")
        
    except Exception as e:
        print(f"Warning: Could not display visualization: {e}")
        # Fehler bei der Visualisierung sollen den Hauptprozess nicht blockieren


def create_segmentation_overlay(ID_LOD2: str, facade_id: str, elem_pred: np.ndarray, access_token: str, alpha: float = 0.5, execution_mode: str = "server"):
    """
    Erstellt ein Overlay-Bild, bei dem die Segmentierungsmaske transparent über das rectified Bild gelegt wird.
    
    Args:
        ID_LOD2: Gebäude-ID
        facade_id: Fassaden-ID
        elem_pred: Element-Predictions als numpy array (H x W) mit Klassen-IDs
        access_token: Zugriffs-Token für die Datenbank
        alpha: Transparenz der Maske (0.0 = vollständig transparent, 1.0 = vollständig opak)
               Default 0.3 bedeutet 30% Opazität der Maske
        execution_mode: Execution mode - "server" (default) or "local". 
                       If "local", visualization functions will be used, otherwise not.
    
    Returns:
        None - Speichert das Overlay-Bild direkt in der Datenbank
    """
    print(f"\n--- Creating Segmentation Overlay for Facade {facade_id} ---")
    
    try:
        # 1. Rectified Image aus der Datenbank laden
        image_content = _get_facade_image(ID_LOD2, facade_id, ["rectified"], access_token)
        
        if not image_content:
            print("Error: No rectified image found. Cannot create overlay.")
            return
        
        # 2. Bild aus Bytes dekodieren
        nparr = np.frombuffer(image_content, np.uint8)
        base_image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if base_image is None:
            print("Error: Could not decode rectified image.")
            return
        
        # 3. Dimensionen überprüfen und anpassen falls nötig
        img_h, img_w = base_image.shape[:2]
        pred_h, pred_w = elem_pred.shape
        
        if (pred_h != img_h) or (pred_w != img_w):
            print(f"Adjusting prediction size from {pred_w}x{pred_h} to image size {img_w}x{img_h}")
            elem_pred = cv2.resize(elem_pred.astype(np.int32), (img_w, img_h), interpolation=cv2.INTER_NEAREST)
        
        # 4. Maske in Farbbild umwandeln (mit ELEMENT_PALETTE)
        mask_colored = np.zeros((img_h, img_w, 3), dtype=np.uint8)
        for class_id, color in ELEMENT_PALETTE.items():
            mask_colored[elem_pred == class_id] = color
        
        # 5. Transparentes Overlay mit abgedunkeltem Background und glatten Kanten erstellen
        # 5.1 Weiche Alpha-Maske für smooth Kanten
        non_background_mask_binary = (elem_pred != 0).astype(np.float32)
        smooth_alpha_mask = cv2.GaussianBlur(non_background_mask_binary, (5, 5), 0)
        smooth_alpha_3d = np.stack([smooth_alpha_mask] * 3, axis=2)
        
        # 5.2 Background abdunkeln (15% Helligkeit)
        background_darkness = 0.15
        darkened_background = base_image.astype(np.float32) * background_darkness
        
        # 5.3 Overlay: Background abgedunkelt, Masken mit Alpha-Blending und weichen Kanten
        mask_overlay = (base_image.astype(np.float32) * (1 - alpha) + 
                       mask_colored.astype(np.float32) * alpha)
        
        overlay_image = (
            darkened_background * (1 - smooth_alpha_3d) + 
            mask_overlay * smooth_alpha_3d
        ).astype(np.uint8)
        
        print(f"Overlay created with {alpha*100:.0f}% mask opacity, {background_darkness*100:.0f}% background brightness, smooth edges")
        
        # 5.1 Visualisierung für Terminal-Version - nur im local mode
        if execution_mode == "local":
            _visualize_overlay(base_image, mask_colored, overlay_image, facade_id)
        
        # 6. Bild als temporäre Datei speichern
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as temp_file:
            # Als JPEG mit hoher Qualität speichern
            cv2.imwrite(temp_file.name, overlay_image, [cv2.IMWRITE_JPEG_QUALITY, 95])
            temp_image_path = temp_file.name
        print(f"Temporary overlay saved as {temp_image_path}")
        
        try:
            # 7. Bild in Datenbank hochladen
            with open(temp_image_path, 'rb') as f:
                image_bytes = f.read()
            
            facade_image = FacadeImage(
                ID_LOD2=ID_LOD2,
                facade_id=facade_id,
                tags=["segmentation_overlay"],
                title=f"Segmentation Overlay - {facade_id}"
            )
            
            # storage_path und content_type werden automatisch von _upload_facade_image gesetzt
            _upload_facade_image(
                obj=facade_image,
                file_path_or_bytes=image_bytes,
                access_token=access_token
            )
            
            print(f"Successfully uploaded segmentation overlay image with tag 'segmentation_overlay'")
            
        finally:
            # 8. Temporäre Datei löschen
            if os.path.exists(temp_image_path):
                os.remove(temp_image_path)
    
    except Exception as e:
        print(f"Error creating segmentation overlay: {e}")
        import traceback
        traceback.print_exc()
