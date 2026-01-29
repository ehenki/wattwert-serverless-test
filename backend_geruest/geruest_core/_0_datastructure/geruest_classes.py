from dataclasses import dataclass, field
from typing import Optional
import json

Point2D = tuple[float, float]  # [x, y]
Point3D = tuple[float, float, float]  # [x, y, z]
Polygon2D = list[Point2D]
Polygon3D = list[Point3D]

''' 
Basic structure:
Every class has their owm, corresponding database table. These contain all the properties defined here. 
Communication should happen over the database wherever possible to ensure consistency and avoid redundancy.
"Higher Tier" objects like Gebauede or Geruest objects do not directly reference "their" objects themselves, but are referenced by the "lower tier" objects 
like Geruest_Module etc. via the ID_LOD2 and geruest_id. Everything ending with _id combined creates a unique identifier for the object.
This way, every element is clearly referencing only one facade and building it belongs to and Gebauede and Geruest objects don't become "bloated" by referencing too many objects.

Uploading data to the database is done by functions in geruest_core/database.
ID_LOD2 and every *_id field is used to identify the object uniquely, entries for which these match existing entries are updated, new ones are inserted.
'''


@dataclass
class Gebaeude: # Muss im Wesentlichen nur existieren - dient dazu, alle Fassaden-Objekte zu sammeln und einem Gebäude zuzuordnen und mit allg. Daten wie Baujahr, Standort, Adresse zu verknüpfen.
    # Die meisten Eigenschaften werden nicht für das Gerüste verwendet, aber für Kompatibilität zum Eigentümer-Tool vorerst beibehalten.
    """Sammelt alle relevanten Gebäudedaten."""
    ID_LOD2: str
    name: str
    standort: str
    coordinates_N: float
    coordinates_E: float
    baujahr: int
    beheiztes_bruttovolumen: float
    bauart: str = 'schwer'  # 'schwer' oder 'leicht' für die Wärmespeicherfähigkeit
    num_units: int = 1
    owner_role: str = 'landlord' # Options: landlord, self_use, landlord-and-self
    building_class: str = 'EFH'
    floor_area_factor: float = 0.32
    air_volume_factor: float = 0.76
    living_area: Optional[float] = None
    nutzflaeche: Optional[float] = None
    ground_area: Optional[float] = None
    heated_floors: Optional[int] = None
    roof_type_name: Optional[str] = 'Satteldach'
    building_height: Optional[float] = None
    heated_attic: bool = True
    heated_basement: bool = False
    heating_system: str = 'Gas'
    warmwater: str = 'central'
    # bauteile: List[Bauteil] = field(default_factory=list)
    u_values_used: dict[str, float] = field(default_factory=dict)
    average_rent_per_m2: Optional[float] = 8.50
    location_cap_rate: Optional[float] = 0.045

    # Volumen, werden aus Datenbank bezogen (ersetzt alte Logik mit occ_volume, simple_volume, mesh_volume)
    volume_model: Optional[float] = None # Enhält das Volumen des 3D-Modells, d.h. Überirdische Geschosse + Dach
    volume_basement: Optional[float] = None # Nur Keller berechnet aus Grundfläche und Keller-Raumhöhe 2.5m
    volume_attic: Optional[float] = None # Dach,
    
    # Component renovation years for optimization
    facade_year: Optional[int] = None
    roof_year: Optional[int] = None
    window_year: Optional[int] = None
    heating_year: Optional[int] = None
    upper_ceiling_year: Optional[int] = None
    basement_ceiling_year: Optional[int] = None
    perimeter_year: Optional[int] = None
    
    # Echte Bauteilflächen aus buildings_data Tabelle
    facade_area_total: Optional[float] = None  # Summe aller Fassadenflächen
    wall_area: Optional[float] = None          # Summe aller Wandflächen
    roof_area: Optional[float] = None          # Summe aller Dachflächen
    window_area: Optional[float] = None        # Summe aller Fensterflächen
    ground_floor_area: Optional[float] = None  # Grundfläche (für Kellerdecke bzw. OGD)

@dataclass
class Geruest_Facade:
    """ Enthält 3D-Informationen für eine Fassade je Himmelsrichtung (id gibt Richtung als Nr zw. 1 und 8 an)."""
    ID_LOD2: str
    facade_id: str
    TABLE_NAME: str = "geruest_facade"
    surface_3d: Optional[Polygon3D] = None # Real coordinates in global coordinate system.

@dataclass
class Geruest_Standard_Module:
    """ Enthält die Standard-Module für ein Gerüst nach Systemen und referenziert ggf. ein 3D-Modell.
    Werden von Geruest_Module Objekten referenziert, welche die Länge, Breite, Höhe und Fläche vom Standard-Modul übernehmen.
    Die entsprechende Funktion ist bereits in der Datenbank implementiert."""
    ID_LOD2: str
    geruest_id: str
    standard_module_id: str # Unique for each standard module
    TABLE_NAME: str = "geruest_standard_module"
    name: str 
    x_length: float  # in meters
    y_width: float  # in meters
    z_height: float  # in meters
    outer_area: float  # in square meters
    system: str  # e.g., 'Layher Allround', 'Peri Up', etc.
    mesh_3d: Optional[Polygon3D] # Simple 3D mesh model (usually a box)
    model_name: Optional[str] = None  # Name of the 3D model file if exists
    tags: list[str] = None  # String list for additional attributes; e.g. "ground", "staircase", etc.

@dataclass
class Geruest_Module:
    """ Einzelnes Gerüst-Modul, referenziert ein Standard-Modul und übernimmt dessen Maße.
    Zusätzlich wird die globale Position und Zugehörigkeit zu Gebäude und Gerüst gespeichert. id automatisch beim Einfügen in Datenbank generiert."""
    ID_LOD2: str
    geruest_id: str
    TABLE_NAME: str = "geruest_module"
    standard_module_id: str  # References Geruest_Standard_Module
    anchor_coordinates: Point3D  # Global position of the module's anchor point
    x_length: float  # in meters (from standard module)
    y_width: float  # in meters (from standard module)
    z_height: float  # in meters (from standard module)
    outer_area: float  # in square meters (from standard module)
    is_active: bool = True  # Whether the module is currently in activated by the user

@dataclass
class Geruest:
    """ Enthält allgemeine Informationen zu einem Gerüst für ein Gebäude."""
    ID_LOD2: str
    geruest_id: str
    TABLE_NAME: str = "geruest"
    count_modules: int = 0
    system: str = None # e.g., 'Layher Allround', 'Peri Up', etc.
    state: str = "under_construction"  # Options: planned, under_construction, completed, dismantled
    facades_3D: Optional[Polygon3D] = None # 3D-Modell aller Fassadenflächen des Gerüsts in globalen Koordinaten
    outer_area_real: Optional[float] = None  # in square meters, real outer area of the entire scaffolding
    outer_area_by_norm: Optional[float] = None  # in square meters, according to VOB-Norm calculation