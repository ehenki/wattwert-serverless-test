# Lens Correction - Linsenverzerrung korrigieren

Dieses Tool korrigiert optische Verzerrungen (Lens Distortion) in Fotos durch Nutzung der **Lensfun-Datenbank** oder Parameter-Schätzung als Fallback.

## 🎯 Verwendungszweck

Digitalkameras und Smartphones erzeugen oft Linsenverzerrungen (z.B. gebogene Linien, "Barrel Distortion"). Für präzise Bildverarbeitung - insbesondere **metrische Aufmaße** - müssen diese Verzerrungen korrigiert werden.

## 🏗️ Architektur

**Bytes-basierte Verarbeitung** - keine temporären Dateien!

- Alle Kernfunktionen arbeiten mit Bytes (BytesIO)
- Direkter Upload/Download zur Datenbank
- Metadata-Speicherung in Datenbank-Feldern statt EXIF
- Minimaler CLI-Wrapper für lokale Tests

## 📋 Voraussetzungen

### Installation

```bash
pip install -r requirements.txt
```

**Wichtige Abhängigkeiten:**
- `opencv-contrib-python` - Bildverarbeitung
- `lensfunpy` - Lensfun-Datenbank-Integration
- `pillow` - EXIF-Datenverarbeitung
- `numpy` - Numerische Operationen

### EXIF-Daten erforderlich

Das Tool **benötigt EXIF-Daten** im Bild! Ohne EXIF-Informationen wird ein Fehler ausgegeben.

Erforderliche EXIF-Felder:
- `Make` (Kamerahersteller)
- `Model` (Kameramodell)
- Optional: `LensModel`, `FocalLength`

## 🚀 Verwendung

### Hauptfunktion (Database Workflow)

```python
from _1_lens_correction import lens_correction

# Verarbeitet Bild direkt aus/in Datenbank
lens_correction(ID_LOD2="12345", facade_id="abc-def", access_token="...")
```

**Workflow:**
1. Download image bytes (tag: "photo")
2. Extract EXIF from bytes
3. Apply correction to image array
4. Encode to JPEG bytes (95% quality)
5. Upload to database (tag: "lens_corrected")
6. Store metadata in `FacadeImage.title` field

### CLI Testing (lokal)

```bash
python _1_lens_correction.py image.jpg
python _1_lens_correction.py image.jpg -o output.jpg
```

**Hinweis:** CLI dient nur zu Testzwecken. Produktiv-Code nutzt die `lens_correction()` Funktion.

## 🔄 Workflow

```
1. Download Bild-Bytes aus Datenbank
   └─ Tag: "photo"

2. EXIF-Daten aus Bytes extrahieren
   ├─ extract_exif_data(image_bytes)
   ├─ Kamera: Make + Model
   ├─ Objektiv: LensModel
   └─ Brennweite: FocalLength

3. Lensfun-Datenbank abfragen
   ├─ ✓ Treffer gefunden → Lensfun-Profil nutzen
   └─ ✗ Kein Treffer → Parameter-Schätzung (Fallback)

4. Verzerrung korrigieren
   ├─ Bild bytes → PIL Image → numpy array
   ├─ Lensfun: Präzise Korrektur mit Datenbank-Profil
   └─ Schätzung: Generische OpenCV-Korrektur
   └─ Array → PIL Image → JPEG bytes (95% quality)

5. Metadaten speichern
   └─ In FacadeImage.title Feld schreiben

6. Upload korrigiertes Bild
   └─ Tag: "lens_corrected"
```

## 📊 Genauigkeit & Kalibrierungsquellen

### Lensfun-Datenbank (Priorität 1)

**Genauigkeit:** ±1-2%

✅ **Vorteile:**
- Große Community-Datenbank mit 30.000+ Kamera-Objektiv-Kombinationen
- Regelmäßig aktualisiert
- Gute Smartphone-Abdeckung (iPhone, Samsung, Google Pixel, etc.)
- Präzise Profile für DSLR/Mirrorless-Kameras

⚠️ **Einschränkungen:**
- Generisches Profil (nicht kamera-spezifisch)
- Für **Übersichtsaufmaße** geeignet
- Für **Präzisionsmessungen** eigene Kalibrierung empfohlen

**Metadata-Beispiel (in FacadeImage.title):**
```
Lens corrected Image (Lens correction: Lensfun Database | Camera: Apple iPhone 14 Pro | Lens: iPhone 14 Pro back triple camera 6.86mm f/1.78 | Accuracy: ±1-2%)
```

### Parameter-Schätzung (Fallback)

**Genauigkeit:** ±5-10%

⚠️ **Warnung:**
- Nur grobe Näherung
- **NICHT für metrische Aufmaße geeignet**
- Nur für optische Korrekturen verwenden

❌ **Nicht verwenden für:**
- Vermessungen
- Rechtsverbindliche Dokumentation
- Präzise Flächenberechnungen

**Metadata-Beispiel (in FacadeImage.title):**
```
Lens corrected Image (Lens correction: Parameter Estimation | Camera: Unknown Camera | Lens: Generic | Accuracy: ±5-10%)
```

## 📸 Unterstützte Kameras

### Lensfun-Datenbank Beispiele:

**Smartphones:**
- Apple iPhone (alle Modelle)
- Samsung Galaxy S/Note/A-Serie
- Google Pixel
- OnePlus
- Huawei P/Mate-Serie

**DSLR/Mirrorless:**
- Canon (EOS, EOS R)
- Nikon (D-Serie, Z-Serie)
- Sony (Alpha)
- Fujifilm (X-Serie)
- Panasonic (Lumix)

**Objektive:**
- Standardzooms (18-55mm, 24-70mm, etc.)
- Festbrennweiten
- Weitwinkel
- Tele-Objektive

Die Lensfun-Datenbank wird automatisch vom System genutzt (system-weite Installation).

## 🔬 Für metrische Aufmaße

### Empfohlener Workflow:

1. **Lensfun-Korrektur anwenden** (dieses Tool)
   - Genauigkeit: ±1-2%
   - Für Übersichtsaufmaße ausreichend

2. **Referenzobjekt platzieren**
   - Zollstock/Maßstab im Bild
   - Bekannte Abmessungen für Validierung

3. **Perspektivkorrektur** (nächster Schritt)
   - Mit `rectification_zihan.py` oder `rectify_facades.py`
   - Entfernt perspektivische Verzerrung

4. **Validierung**
   - Vergleich mit bekannten Maßen
   - Bei kritischen Anwendungen: Mehrfach-Messung

### Bei höchster Präzision erforderlich:

**Eigene Kamera-Kalibrierung mit Schachbrettmuster:**
- Genauigkeit: ±0.5-1%
- Erfordert 15-20 Kalibrierungsfotos
- Professionelle Photogrammetrie-Software empfohlen
- Nicht Teil dieses Tools

## ⚖️ Haftungshinweis

**Wichtig für rechtliche/kommerzielle Nutzung:**

### Lensfun-Korrektur:
✅ Geeignet für:
- Übersichtsaufmaße
- Visualisierungen
- Flächenschätzungen
- Dokumentation (mit Vorbehalt)

⚠️ **Mit Einschränkungen:**
- Generisches Profil (nicht kamera-spezifisch kalibriert)
- Für verbindliche Vermessungen: Eigene Kalibrierung empfohlen
- Genauigkeit kann je nach Kamera variieren

### Parameter-Schätzung:
❌ **NICHT geeignet für:**
- Metrische Aufmaße
- Rechtsverbindliche Dokumentation
- Präzisionsmessungen
- Qualitätskritische Anwendungen

**Dokumentation der Unsicherheit:**
Das Tool gibt bei jeder Korrektur einen Genauigkeitsbericht aus. Diese Information sollte bei kritischen Anwendungen dokumentiert werden.

## 🔧 Technische Details

### Kernfunktionen

```python
# Bytes-basierte Verarbeitung
extract_exif_data(image_bytes: bytes) -> dict
    """Extrahiert EXIF-Daten direkt aus Bytes mit BytesIO"""

get_camera_info(image_bytes: bytes) -> tuple
    """Liefert (make, model, lens_model, focal_length) aus Bytes"""

lens_correction(ID_LOD2: str, facade_id: str, access_token: str) -> None
    """Hauptfunktion: Download → Korrektur → Upload (reine Bytes-Pipeline)"""

main() -> None
    """CLI-Wrapper für lokale Tests mit Dateien"""
```

### Lensfun-Integration

```python
# Ablauf intern:
1. Bild-Bytes aus Datenbank laden
2. Bytes → PIL Image → numpy array
3. Lensfun-Datenbank initialisieren
4. Kamera suchen (Make + Model)
5. Objektiv suchen (LensModel oder Default)
6. Modifier erstellen (für Verzerrungskorrektur)
7. Geometrie-Korrektur anwenden
8. Bild neu mappen mit cv2.remap()
9. Array → PIL Image → JPEG bytes (95%)
10. Bytes in Datenbank hochladen
```

### OpenCV-Schätzung (Fallback)

```python
# Parameter-Schätzung:
- Hauptpunkt (cx, cy) = Bildmitte
- Brennweite (fx, fy) = geschätzt aus EXIF oder Bildbreite
- Radiale Verzerrung: k1=-0.05, k2=0.02 (typische Werte)
- Tangentiale Verzerrung: p1=p2=0
```

### Metadaten-Speicherung

**Metadata im `FacadeImage.title` Feld (Datenbank):**

Format:
```
Lens corrected Image (Lens correction: {source} | Camera: {make} {model} | Lens: {lens} | Accuracy: {accuracy})
```

Beispiele:
- `Lensfun Database` / `Parameter Estimation`
- `Apple iPhone 14 Pro` / `Unknown Camera`
- `iPhone 14 Pro back triple camera 6.86mm f/1.78` / `Generic`
- `±1-2%` / `±5-10%`

**❌ Entfernt:**
- `write_metadata_to_exif()` - keine EXIF-Schreibfunktion mehr
- Vergleichsbilder
- `correct_lens_distortion()` - durch bytes-basierte Pipeline ersetzt

## 📁 Projektstruktur

```
preprocessing/
├── _1_lens_correction.py       # Bytes-basiertes Lens Correction Tool
├── _2_identify_main_facade.py
├── _3_crop_image.py
├── _4_rectify_image.py
├── rectification_zihan.py      # Perspektivkorrektur (Schritt 2)
├── rectify_facades.py          # Fassaden-Korrektur
└── README.md                   # Diese Datei
```

## 🐛 Troubleshooting

### "No EXIF data found"

**Problem:** Bild hat keine EXIF-Daten

**Lösung:**
- Prüfen: `exiftool bild.jpg`
- EXIF kann bei Bearbeitung verloren gehen
- Originalbild aus Datenbank verwenden
- EXIF-Daten sind im Original-Upload erforderlich

### "lensfunpy not available"

**Problem:** Lensfun nicht installiert

**Lösung:**
```bash
pip install lensfunpy
```

Bei Windows: Ggf. Build-Tools erforderlich

### Kamera nicht in Lensfun gefunden

**Problem:** Unbekanntes Kameramodell

**Was passiert:**
- Automatischer Fallback auf Parameter-Schätzung
- Warnung im metadata-Feld gespeichert
- Accuracy: ±5-10%

**Lösung:**
- Prüfen ob EXIF-Daten korrekt sind
- Bei neuen Kameras: Lensfun-Datenbank aktualisieren
- Für beste Ergebnisse: Eigene Kalibrierung durchführen

### Database Upload/Download Fehler

**Problem:** Verbindung zur Datenbank fehlgeschlagen

**Lösung:**
- Access Token prüfen
- Netzwerkverbindung prüfen
- ID_LOD2 und facade_id validieren

## 📚 Weiterführende Schritte

Nach der Linsenkorrektur:

1. **Perspektivkorrektur:**
   - `rectification_zihan.py` - Generische Entzerrung
   - `rectify_facades.py` - Speziell für Fassaden

2. **Metrisches Aufmaß:**
   - Referenzmaßstab im Bild nutzen
   - Pixel-zu-mm Ratio berechnen
   - Messungen durchführen

3. **Validierung:**
   - Mit bekannten Maßen vergleichen
   - Unsicherheit dokumentieren

## 🔗 Referenzen

- **Lensfun:** https://lensfun.github.io/
- **OpenCV Calibration:** https://docs.opencv.org/4.x/dc/dbb/tutorial_py_calibration.html
- **lensfunpy:** https://github.com/letmaik/lensfunpy

## 📄 Lizenz

Siehe Hauptprojekt. Lensfun ist LGPL v3 lizenziert.

---

**Version:** 3.0 (Bytes-basierte Architektur)  
**Datum:** Dezember 2024  
**Projekt:** WattWert - Fassadenaufmaß Backend  
**Änderungen:** ~200 Zeilen weniger Code, keine temporären Dateien, Metadata in Datenbank
