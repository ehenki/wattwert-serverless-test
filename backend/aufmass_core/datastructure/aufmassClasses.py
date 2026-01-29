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
"Higher Tier" objects like Gebauede or Facade objects do not directly reference "their" objects themselves, but are referenced by the "lower tier" objects 
like Openings, WallSections, RoofOverhangs, etc. via the ID_LOD2 and facade_id. Everything ending with _id combined creates a unique identifier for the object.
There are 5 main types of facade elements that each have their own table in the database: Opening, OpeningAccessory, WallSection, RoofOverhang and FacadeAttachment. 
They have subclasses for more specific types.
This way, every element is clearly referencing only one facade and building it belongs to and Gebauede and Facade objects don't become "bloated" by referencing too many objects.

Uploading data to the database is done by using the _insert_aufmass_object function in database_functions.py. One function fits all classes & tables for simplicity.
ID_LOD2 and every *_id field is used to identify the object uniquely, entries for which these match existing entries are updated, new ones are inserted.
'''

@dataclass
class Gebaeude: # Muss im Wesentlichen nur existieren - dient dazu, alle Fassaden-Objekte zu sammeln und einem Gebäude zuzuordnen und mit allg. Daten wie Baujahr, Standort, Adresse zu verknüpfen.
    # Die meisten Eigenschaften werden nicht für das Aufmaß verwendet, aber für Kompaitbilität zum Eigentümer-Tool vorerst beibehalten.
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
class Facade:
    """ Enthält alle Aufmaß-Informationen für eine Fassade."""
    ID_LOD2: str
    facade_id: str
    TABLE_NAME: str = "facade"
    scale_factor: Optional[float] = None # Scale factor of the photo/masks in meters per pixel (typ. Werte ~ 0.005-0.02 m/px)
    image_processed: bool = False # True if the image has been processed and is ready for analysis
    surface_2d: Optional[Polygon2D] = None # Simple, flat 2D Polygon without global coordinate system. [0,0] is the bottom left corner.
    surface_3d: Optional[Polygon3D] = None # Real coordinates in global coordinate system.
    material_ids: Optional[list[int]] = None # Materials used for the Wall surface
    material_fractions: Optional[list[float]] = None # Fractions of the materials in the surface
    max_height: Optional[float] = None # Maximum height of the facade in m - important e.g. for scaffolding calculations
    eave_length: Optional[float] = None # Length of the eave in m - important e.g. for calculating roof overhang areas
    direction: Optional[str] = None # Direction of the facade, e.g. "N", "NE", "E", "SE", "S", "SW", "W", "NW"
    area: Optional[float] = None # Total area of the facade in m² (according to LOD2 model for now)
    wwr: Optional[float] = None # Window-to-wall ratio of the facade
    window_count: Optional[int] = None # Number of windows on the facade

@dataclass
class Opening:
    """ Enthält alle Aufmaß-Informationen für eine Fassadenöffnungen wie Türen, Fenster, Garagentüren, etc., die durch einfache Polygone beschrieben werden können und Laibunstiefen haben. """
    ID_LOD2: str
    facade_id: str
    opening_id: str
    type: str # type identifier of the opening, e.g. "window", "door", "garage_door", "hole"
    surface_2d: Polygon2D # Simple, flat 2D Polygon without global coordinate system. [0,0] is the bottom left corner of the corresponding facade.
    surface_3d: Polygon3D # Real coordinates in global coordinate system.
    area: float # Area of the opening in m²
    height: float # Height of the opening in m
    width: float # Width of the opening in m
    laibung_depth: float # Depth of the laibung in m
    deviation_from_raw_segmentation: float # Deviation of the approximated rectangle from the raw segmentation in percent
    TABLE_NAME: str = "opening"

@dataclass
class Window(Opening):
    """ Enthält alle Aufmaß-Informationen für ein Fenster. Erbt von Opening und erweitert um die Material-ID. """
    material_id: str = "0" # Material of the window frame
    TABLE_NAME: str = "opening"

@dataclass
class Door(Opening):
    """ Enthält alle Aufmaß-Informationen für eine Tür. Erbt von Opening und erweitert um die Material-ID. """
    material_id: int = 0 # Material of the door
    TABLE_NAME: str = "opening"

@dataclass
class GarageDoor(Opening):
    """ Enthält alle Aufmaß-Informationen für ein Garagentor. Erbt von Opening und erweitert um die Material-ID. """
    material_id: int = 0 # Material of the garage door
    TABLE_NAME: str = "opening"

@dataclass
class OpeningAccessory:
    """ Enthält alle Aufmaß-Informationen für ein Zubehör für eine Fassadenöffnung. """
    ID_LOD2: str
    facade_id: str
    opening_id: str
    accessory_id: str
    type: str # type identifier of the accessory, e.g. "shutter", "railing"
    surface_2d: Polygon2D # Simple, flat 2D Polygon without global coordinate system. [0,0] is the bottom left corner of the corresponding facade.
    surface_3d: Polygon3D # Real coordinates in global coordinate system.
    area: float # Area of the accessory in m²
    height: float # Height of the accessory in m
    width: float # Width of the accessory in m
    deviation_from_raw_segmentation: float # Deviation of the approximated rectangle from the raw segmentation in percent
    TABLE_NAME: str = "opening_accessory"

@dataclass
class WallSection:
    """ Überklasse für besondere Teile der Wand, z.B. Sockel oder Vorsprung, der bei Anstrich oder Isolierung unterschieden werden muss. """
    ID_LOD2: str
    facade_id: str
    wall_section_id: str
    type: str # type identifier of the wall section, e.g. "base", "section", "protruision"
    surface_2d: Polygon2D # Simple, flat 2D Polygon without global coordinate system. [0,0] is the bottom left corner of the corresponding facade.
    surface_3d: Polygon3D # Real coordinates in global coordinate system.
    area: float # Area of the base in m²
    height: float # Height of the base in m
    width: float # Width of the base in m
    material_id: int # Material of the base
    deviation_from_raw_segmentation: float # Deviation of the approximated rectangle from the raw segmentation in percent
    TABLE_NAME: str = "wall_section"

@dataclass
class Protrusion(WallSection):
    """ Enthält alle Aufmaß-Informationen für Vorsprünge, Gesimse o.ä. Erbt von WallSection und erweitert um die Tiefe. """
    depth: float = 0.0 # Vorsprungs-Tiefe: Positiv für Vorsprünge, Negativ für Einbuchtungen
    TABLE_NAME: str = "wall_section"

@dataclass
class RoofOverhang:
    """ Enthält alle Aufmaß-Informationen für einen Dachüberhang."""
    ID_LOD2: str
    facade_id: str
    roof_overhang_id: str
    area: float # Area of the roof overhang in m²
    length: float # Length of the overhang in m
    width: float # Width of the overhang in m (= eave length
    material_id: int # Material of the overhang
    TABLE_NAME: str = "roof_overhang"

@dataclass
class FacadeAttachment:
    """ Überklasse für Anbauelemente an der Fassade, z.B. Balkone, Klimageräte, Lampen etc. """
    ID_LOD2: str
    facade_id: str
    facade_attachment_id: str
    type: str # type identifier of the facade attachment, e.g. "balcony", "ac_unit", "other"
    surface_2d: Polygon2D # Simple, flat 2D Polygon without global coordinate system. [0,0] is the bottom left corner of the corresponding facade.
    surface_3d: Polygon3D # Real coordinates in global coordinate system.
    area: float # Area of the attachment in m² (when projected on facade)
    depth: float # Depth of the attachment in m. As attachments are 3D objects, the depth is relevant e.g. for calculating the surface of the bottom side of balconies, which have to be painted.
    height: float # Height of the attachment in m
    width: float # Width of the attachment in m
    material_id: int # Material of the attachment
    deviation_from_raw_segmentation: float # Deviation of the approximated polygon from the raw segmentation in percent
    TABLE_NAME: str = "facade_attachment"

@dataclass
class FacadeEdge:
    """ Enthält alle Aufmaß-Informationen für eine Fassadenkante. Wird vorerst wahrscheinlich noch nicht benötigt."""
    ID_LOD2: str
    facade_id: str
    edge_id: str
    edge_type: str  # e.g. "inside_corner", "outside_corner", "building_edge", "attica"
    geometry_2d: tuple[Point2D, Point2D] # Simple, flat 2D Polygon without global coordinate system. [0,0] is the bottom left corner of the corresponding facade. For Edge: SHould only consist of 2 points.
    geometry_3d: tuple[Point3D, Point3D] # Real coordinates in global coordinate system. For Edge: Should only consist of 2 points.
    length: float   # m
    TABLE_NAME: str = "facade_edge"

@dataclass
class SegmentationMask:
    """ Segmentation Masks werden als jsonb in der Datenbank gespeichert. 
    Im Laufe des Prozesses werden mehrere Masken erstellt werden, weshalb eine klare Zuordung, um welche Maske es sich handelt, über Tags entscheidend ist."""
    ID_LOD2: str
    facade_id: str#
    mask_id: str
    tags: list[str] # Tags to identify the mask, e.g "rectified", "unobscured", "wall", "window", "door", "opening", "balcony", "garage_door", "base", "roof_overhang", "vegetation", "cars"...
    mask: any # Path to the mask of the facade, saved in jsonb format in database
    TABLE_NAME: str = "segmentation_mask"

@dataclass
class FacadeImage: # matches to database table "facade_image"
    ID_LOD2: str
    facade_id: str
    tags: list[str]
    title: Optional[str] = None
    storage_path: Optional[str] = None
    public_url: Optional[str] = None
    size_bytes: Optional[int] = None
    width: Optional[int] = None
    height: Optional[int] = None
    TABLE_NAME: str = "facade_image"

@dataclass
class FacadeMeasurement:
    """ Enthält alle Aufmaß-Informationen für eine Fassade. Wird noch vervollständigt. """
    ID_LOD2: str
    building_measurement_id: str
    facade_id: str
    facade_measurement_id: str # Getrennt von facade_id, so könnten meherer Aufmaße für eine Fassade erfasst werden.
    area_facade_total: float # Total area of the facade in m²
    area_wall_real: float # Real area of only the wall in m²
    area_wall_VOB: float # Wall area calculated according to VOB Methods (WIndows > 2.5 m², Sockel etc. substracted)
    area_windows_real: float # Real area of all windows in m²
    area_windows_VOB: float # Window area calculated according to VOB Methods (Windows > 2.5 m² substracted)
    area_doors_real: float # Real area of all doors in m²
    area_doors_VOB: float # Door area calculated according to VOB Methods (Doors > 2.5 m² substracted)
    area_base_real: float # Area of the base in m²
    area_base_VOB: float # Base area calculated according to VOB Methods (Base > 2.5 m² substracted)
    area_attachments_real: float # Real area of all attachments in m²
    area_attachments_VOB: float # Attachment area calculated according to VOB Methods (Attachments > 2.5 m² substracted)
    area_protrusions_real: float # Real area of all protrusions in m²
    area_protrusions_VOB: float # Protrusion area calculated according to VOB Methods (Protrusions > 2.5 m² substracted)
    count_windows: int
    count_doors: int
    count_base: int
    count_attachments: int
    count_protrusions: int
    laibung_length_total: float # Total length of the laibung in m
    laibung_area_total: float # Total area of the laibung in m²
    roof_overhang_area_total: float # Total area of the roof overhang in m²
    TABLE_NAME: str = "facade_measurement"

@dataclass
class BuildingMeasurement:
    """ Enthält alle Aufmaß-Informationen für ein Gebäude. Wird noch vervollständigt. """
    ID_LOD2: str
    building_measurement_id: str # Getrennt von gebauede_id, so könnten meherer Aufmaße für ein Gebäude erfasst werden.
    area_wall_VOB: float
    area_windows_VOB: float
    area_doors_VOB: float
    area_base_VOB: float
    area_attachments_VOB: float
    area_protrusions_VOB: float
    laibung_length_total: float
    laibung_area_total: float
    roof_overhang_area_total: float
    TABLE_NAME: str = "building_measurement"

@dataclass
class Offer:
    """ Enthält alle Angebots-Informationen zugehörig zu einem Gebaeudeaufmass. 
    Wird noch vervollständigt. """
    ID_LOD2: str
    gebaeudeaufmass_id: str
    angebot_id: str
    scaffolding_price: float
    cleaning_price: float
    undercoat_price: float
    covering_price: float
    connectors_price: float
    paint_price: float
    plaster_price: float
    insulation_price: float
    total_price: float
    TABLE_NAME: str = "offer"
