# Aufmass-Rechenkern (Measurement Core)

## 🎯 Ziel
Automatisierte Verarbeitung von Fassadenbildern zur Bestimmung der Fassadenelemente mittels Preprocessing, Semantic Segmentation und geometrischem Matching für präzise Gebäudeaufmaße.

## 🏗️ Architektur-Übersicht

Das System ist modular aufgebaut und verarbeitet Fassadenbilder in drei Hauptphasen:

### **Hauptsteuerung**: `aufmass_main.py`
Die zentrale Orchestrierung aller Verarbeitungsschritte:
- Lädt alle Fassaden eines Gebäudes anhand der `ID_LOD2`
- Führt sequentiell alle Pre-, Main- und Post-Processing-Schritte aus
- Kommuniziert ausschließlich über IDs und die Datenbank (keine direkten Datenübergaben)
- **Bytes-basierte Architektur**: Keine temporären Dateien, alles läuft über BytesIO

### **Datenfluss-Prinzip**
- Funktionen erhalten nur **IDs** (`ID_LOD2`, `facade_id`, `access_token`)
- Datenübertragung erfolgt **ausschließlich über die Datenbank**
- Bilder werden als **Bytes** direkt aus/in die Datenbank geladen/gespeichert
- Keine temporären Dateien auf dem Dateisystem

---

## 📋 Verarbeitungs-Pipeline

### **Preprocessing** (`preprocessing/`)

#### 1. **Lens Correction** (`_1_lens_correction.py`)
**Zweck**: Korrektur optischer Verzerrungen (Barrel Distortion, Pincushion Distortion)

**Lensfun-Verhalten**:
- **Priorität 1**: Lensfun-Datenbank-Abfrage
  - Extrahiert EXIF-Daten (Make, Model, LensModel, FocalLength) aus Bild-Bytes
  - Sucht in der **Lensfun-Datenbank** nach Kamera/Objektiv-Profil
  - Enthält 30.000+ Kamera-Objektiv-Kombinationen (iPhones, Samsung, Canon, Nikon, etc.)
  - **Bei Treffer**: Präzise Korrektur mit Lensfun-Profil (Genauigkeit: ±1-2%)
  - **Fallback-Lens**: Falls exaktes Objektiv nicht gefunden, nutzt erstes verfügbares Objektiv der Kamera (Genauigkeit: ±3-5%, Warnung in Metadaten)
- **Priorität 2**: Parameter-Schätzung (nur wenn Kamera nicht in Lensfun)
  - Schätzt generische OpenCV-Parameter
  - **Warnung**: Nur ±5-10% Genauigkeit - NICHT für metrische Aufmaße geeignet
- **Output**: Tag `lens_corrected` in Datenbank mit Metadaten im `FacadeImage.title`

**Lensfun-Implementierung**:
```python
# Internes Verhalten (aus _0_helper_lensfun.py):
1. Download Bild-Bytes aus Datenbank (Tag: "photo")
2. EXIF-Extraktion direkt aus Bytes (BytesIO)
3. Lensfun-DB initialisieren: db = lensfunpy.Database()
4. Kamera suchen: db.find_cameras(make, model)
5. Objektiv suchen: db.find_lenses(camera, lens_model)
   → Fallback auf erstes Objektiv falls nicht gefunden
6. Modifier erstellen mit Distortion-Korrektur
7. cv2.remap() für geometrische Korrektur
8. Bytes → PIL → numpy → korrigiert → PIL → JPEG Bytes (95%)
9. Upload in Datenbank (Tag: "lens_corrected")
10. Metadaten in FacadeImage.title speichern
```

**Metadata-Beispiele**:
```
✓ Lensfun Match:
"Lens correction: Lensfun Database | Camera: Apple iPhone 14 Pro | 
 Lens: iPhone 14 Pro back triple camera 6.86mm f/1.78 | Accuracy: ±1-2%"

⚠️ Fallback Lens:
"Lens correction: Lensfun Database (fallback lens) | Camera: Samsung Galaxy S21 | 
 Requested: Unknown | Used: Samsung Galaxy S21 back camera 5.4mm f/1.8 | Accuracy: ±3-5%"

❌ Parameter-Schätzung:
"Lens correction: Parameter Estimation | Camera: Unknown Camera | 
 Lens: Generic | Accuracy: ±5-10%"
```

**Wichtig für Nutzer**:
- **EXIF-Daten erforderlich**: Ohne EXIF → Fehler
- Beste Ergebnisse mit aktuellen Smartphones (gut in Lensfun dokumentiert)
- Für Präzisionsmessungen: Eigene Kamera-Kalibrierung empfohlen

#### 2. **Identify Main Facade** (`_2_identify_main_facade_sam3.py`)
SAM3-basierte Segmentierung zur Identifikation der Hauptfassade im Bild.

#### 3. **Crop Image** (`_3_crop_image.py`)
Zuschneiden des Bildes auf die relevante Fassadenregion.

#### 4. **Rectify Image** (`_4_0_rectify_image_automated.py`)
Automatische Perspektivkorrektur (Entzerrung) der Fassade.
- Alternativ: `_4_1_fallback_manual_rectify_image.py` (manueller Fallback, aktuell nicht genutzt)

#### 5. **Identify Obscuring Elements** (`_5_identify_obscuring_elements.py`)
Erkennung verdeckender Elemente (Bäume, Autos, etc.) - **derzeit nicht aktiv**

#### 6. **Generative Completion** (`_6_generative_completion.py`)
KI-basiertes Auffüllen verdeckter Bereiche - **derzeit nicht aktiv**

---

### **Main Processing** (`mainprocessing/`)

#### 7. **Main Segmentation** (`_7_main_segmentation.py`)
Semantische Segmentierung der Fassadenelemente:
- Fenster, Türen, Wandflächen, etc.
- Nutzt State-of-the-Art ML-Modelle (SAM3)
- Output: Segmentierungsmasken als RLE-komprimierte Daten

---

### **Post Processing** (`postprocessing/`)

#### 7.1 **Simple Statistics** (`_7_1_simple_statistics.py`)
Statistische Analyse der Segmentierungsergebnisse (Flächen, Anzahlen, etc.)

#### 7.2 **Create Segmentation Overlay** (`_7_2_create_segmentation_overlay.py`)
Erstellt transparente Overlay-Visualisierung (alpha=0.3) der Segmentierungsmasken auf dem korrigierten Bild.

#### 8. **Get Reference Scale** (`_8_get_reference_scale.py`)
Bestimmung des Maßstabs (Meter/Pixel) - **teilweise im Frontend**

#### 9. **Polygon Matching** (`_9_polygon_matching.py`)
Geometrisches Matching der segmentierten Elemente zu präzisen Polygonen.

---

## 🗄️ Datenstruktur (`datastructure/`)

Alle Klassen korrespondieren direkt mit Datenbank-Tabellen:

### **Kern-Klassen** (`aufmassClasses.py`):
- `Gebaeude`: Gebäudeinformationen (ID_LOD2, Standort, Baujahr, Volumen, etc.)
- `Facade`: Fassaden-Aufmaßdaten (scale_factor, surface_2d, surface_3d, materials)
- `Opening`: Fenster, Türen, Garagentore (Polygone, Laibungstiefen)
- `OpeningAccessory`: Rollladen, Fensterbänke, etc.
- `WallSection`: Wandabschnitte mit Material-IDs
- `RoofOverhang`: Dachüberstände
- `FacadeAttachment`: Anbauten (Balkone, etc.)

**Referenzierungs-Prinzip**:
- "Higher-Tier"-Objekte (Gebaeude, Facade) referenzieren NICHT ihre Kinder direkt
- "Lower-Tier"-Objekte (Opening, WallSection, etc.) referenzieren ihre Eltern via `ID_LOD2` + `facade_id`
- Eindeutige Identifikation durch Kombination aller `*_id` Felder

---

## 🔌 Datenbank-Kommunikation

### **4 zentrale Funktionen** (in `database_upload_functions.py` und `database_download_functions.py`):

#### **Objekttransfer**:
```python
_get_aufmass_objects(ID_LOD2, object_type, access_token, ids={})
    """Download von Aufmaß-Objekten (Facade, Opening, etc.)"""

_insert_aufmass_object(obj, access_token)
    """Upload/Update von Aufmaß-Objekten
       - Matching via ID_LOD2 + *_id Felder
       - Existierende Einträge werden aktualisiert
       - Neue Einträge werden eingefügt
    """
```

#### **Bildtransfer** (Bytes-basiert):
```python
_get_facade_image(ID_LOD2, facade_id, access_token, tag="photo")
    """Download Bild als Bytes (kein Dateisystem-Zugriff)"""

_upload_facade_image(ID_LOD2, facade_id, image_bytes, access_token, tag="lens_corrected", title="...")
    """Upload Bild-Bytes direkt in Datenbank"""
```

### **Vorteile des Bytes-basierten Ansatzes**:
- ✅ Keine temporären Dateien
- ✅ Schnellerer I/O
- ✅ Direkter Datenbank-Upload/-Download
- ✅ Metadaten in Datenbank-Feldern statt EXIF
- ✅ Reduzierter Code (~200 Zeilen weniger als Datei-basiert)

---

## 📦 Dependencies

### **Kernbibliotheken**:
- `opencv-contrib-python` - Bildverarbeitung
- `lensfunpy` - **Lensfun-Datenbank-Integration** (LGPL v3)
- `pillow` - EXIF-Extraktion, Bild-I/O
- `numpy` - Numerische Operationen
- `supabase` - Datenbank-Client

### **Machine Learning**:
- SAM3 (Segment Anything Model 3) für Segmentierung
- Custom-trainierte Modelle im `models/` Verzeichnis

---

## 🚀 Verwendung

### **Hauptfunktion**:
```python
from aufmass_core.aufmass_main import aufmass_main

aufmass_main(
    ID_LOD2="DEBY_LOD2_4784574",  # Eindeutige Gebäude-ID
    access_token="..."             # Supabase Service Role Token
)
```

### **Workflow intern**:
1. Lädt alle Fassaden für `ID_LOD2`
2. Für jede Fassade:
   - Preprocessing (Lens Correction → Crop → Rectify)
   - Main Processing (Segmentation)
   - Post Processing (Statistics → Overlay → Polygon Matching)
3. Alle Zwischenergebnisse in Datenbank (mit Tags wie `lens_corrected`, `cropped`, `rectified`)

---

## 🐛 Troubleshooting

### **"lensfunpy not available"**
**Problem**: Lensfun nicht installiert

**Lösung**:
```bash
pip install lensfunpy
```
Bei Windows: ggf. Visual Studio Build Tools erforderlich

### **"No EXIF data found"**
**Problem**: Bild hat keine EXIF-Metadaten

**Lösung**:
- Originalbild verwenden (nicht bearbeitet)
- EXIF-Daten prüfen: `exiftool image.jpg`
- Bei Bildern ohne EXIF: Parameter-Schätzung wird genutzt (⚠️ ungenau)

### **Kamera nicht in Lensfun gefunden**
**Was passiert**:
- Automatischer Fallback auf Parameter-Schätzung
- Warnung in Metadaten gespeichert
- Genauigkeit reduziert auf ±5-10%

**Lösung**:
- EXIF-Daten validieren
- Lensfun-Datenbank aktualisieren (bei neuen Kameras)
- Für kritische Anwendungen: Eigene Kalibrierung

---

## 📁 Projektstruktur

```
aufmass_core/
├── aufmass_main.py                      # Hauptsteuerung (Orchestrator)
├── database_download_functions.py       # DB-Download
├── database_upload_functions.py         # DB-Upload
├── datastructure/
│   ├── aufmassClasses.py               # Datenklassen (Facade, Opening, etc.)
│   ├── aufmass_diagram.mermaid         # Architektur-Diagramm
│   └── datastructure_aufmass.png       # Visualisierung
├── preprocessing/
│   ├── _0_helper_lensfun.py           # Lensfun-Helper-Funktionen
│   ├── _1_lens_correction.py          # Lens Correction (Lensfun)
│   ├── _2_identify_main_facade_sam3.py
│   ├── _3_crop_image.py
│   ├── _4_0_rectify_image_automated.py
│   ├── _4_1_fallback_manual_rectify_image.py
│   ├── _5_identify_obscuring_elements.py
│   ├── _6_generative_completion.py
│   └── README.md                       # Detaillierte Preprocessing-Doku
├── mainprocessing/
│   └── _7_main_segmentation.py        # SAM3 Segmentierung
├── postprocessing/
│   ├── _7_1_simple_statistics.py
│   ├── _7_2_create_segmentation_overlay.py
│   ├── _8_get_reference_scale.py
│   └── _9_polygon_matching.py
├── helpers/
│   └── mask_utils.py                   # RLE-Encoding/Decoding
└── models/                             # ML-Modelle (SAM3, etc.)
```

---

## 📚 Weiterführende Dokumentation

- **Preprocessing Details**: `preprocessing/README.md` - 370 Zeilen detaillierte Doku zu Lens Correction
- **Lensfun-Datenbank**: https://lensfun.github.io/
- **OpenCV Calibration**: https://docs.opencv.org/4.x/dc/dbb/tutorial_py_calibration.html
- **lensfunpy**: https://github.com/letmaik/lensfunpy

---

## ⚖️ Haftungshinweis

**Genauigkeit bei Lensfun-Korrektur**:
- ✅ **Geeignet für**: Übersichtsaufmaße, Visualisierungen, Flächenschätzungen
- ⚠️ **Einschränkung**: Generische Profile (nicht kamera-spezifisch kalibriert)
- 📏 **Für verbindliche Vermessungen**: Eigene Kamera-Kalibrierung mit Schachbrettmuster empfohlen

**Genauigkeit bei Parameter-Schätzung**:
- ❌ **NICHT geeignet für**: Metrische Aufmaße, rechtsverbindliche Dokumentation

---

## 📄 Lizenz

Siehe Hauptprojekt. **Lensfun ist LGPL v3 lizenziert**.

---

**Version**: 3.0 (Bytes-basierte Architektur)  
**Datum**: Januar 2025  
**Projekt**: WattWert - Fassadenaufmaß Backend