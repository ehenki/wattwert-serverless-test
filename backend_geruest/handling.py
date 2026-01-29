from helpers.addressf import get_coords, find_building_by_point, convert_utm_to_lat_long, get_utm_zone
from helpers.geomf import download_LOD2_file, create_ground_surface_list, extract_building_data, filter_roof_extrusion, group_extrusions, model_extrusion_footprints, extrude_footprints
from helpers.laserf import download_laser_file, filter_points_by_location
import laspy
import numpy as np
import xml.etree.ElementTree as ET
from geopy.geocoders import Nominatim
from typing import Any
import utm
from helpers.volume_calc import calculate_volume

def start_process(coordinates: list[float], street: str, nr: str, city: str, state: str, country: str, get_laser_data:bool, ID_LOD2_list: list[str] | None = None):
    print(f"Starting process for address: {street} {nr}, {city}, {state}, {country} at coordinates: {coordinates}")
    # Kicks off the Building model extraction & processing pipeline. 
    result_dict: dict[str, Any] ={}
    # define all parameters here
    # States, list that contains all states for which we currently have a retrieval function. To be updated when new states are added.
    states = ["Bayern", "Sachsen", "Baden-Württemberg", "Nordrhein-Westfalen", "Hamburg", "Niedersachsen", "Hessen",
    "Berlin", "Thüringen", "Rheinland-Pfalz", "Brandenburg", "Mecklenburg-Vorpommern", "Schleswig-Holstein", "Bremen"] # WARNING: Only Wiesbaden for Hessen so far
    # order states alphabetically
    states.sort()
    laser_exists = {"Bayern": True, "Sachsen": True, "Baden-Württemberg": False, "Nordrhein-Westfalen": True, "Hamburg": False,
    "Niedersachsen": False, "Berlin": False, "Thüringen": False, "Rheinland-Pfalz": False, "Brandenburg": False,
    "Mecklenburg-Vorpommern": False, "Schleswig-Holstein": False, "Bremen": False}
    laser_building_classification = {"Bayern": 6, "Sachsen": 20, "Baden-Württemberg": 0, "Nordrhein-Westfalen": 20, "Hamburg": 0,
    "Niedersachsen": 0, "Berlin": 0, "Thüringen": 0, "Rheinland-Pfalz": 0, "Brandenburg": 0, "Mecklenburg-Vorpommern": 0, "Schleswig-Holstein": 0, "Bremen": 0} # 0 when not used (but doesn't really matter)

    # Dachtypen, obtained from Alkis Dachformen
    roof_types = {
        "Flachdach": 1000,
        "Pultdach": 2100,
        "Versetztes Pultdach": 2200,
        "Satteldach": 3100,
        "Walmdach": 3200,
        "Krüppelwalmdach": 3300,
        "Mansardendach": 3400,
        "Zeltdach": 3500,
        "Kegeldach": 3600,
        "Kuppeldach": 3700,
        "Sheddach": 3800,
        "Bogendach": 3900,
        "Turmdach": 4000,
        "Mischform": 5000,
        "Sonstiges": 9999
    }

    # Reverse mapping: Number → Roof type
    roof_numbers = {v: k for k, v in roof_types.items()}

    # calling the Nominatim tool and create Nominatim class
    loc = Nominatim(user_agent="Geopy Library")

    # define the namespace for the CityGML file
    ns = {
        'bldg': 'http://www.opengis.net/citygml/building/1.0',
        'xAL' : 'urn:oasis:names:tc:ciq:xsdschema:xAL:2.0',
        'gen' : 'http://www.opengis.net/citygml/generics/1.0',
        'gml' : 'http://www.opengis.net/gml'
    }

    if coordinates is None:
        print(f"ERROR: Could not geocode address:\n{address}")
        return
    
    # Get coordinates in UTM format and download the CityGML file
    zone_nr = get_utm_zone(state)
    coords = utm.from_latlon(coordinates[1], coordinates[0], force_zone_number=zone_nr, force_zone_letter='N')
    e, n, *_ = coords

    gml_path = download_LOD2_file(state, e, n)
    if not gml_path:
        print(f"ERROR: Failed to download CityGML for\n{coordinates} in {state}")
        raise RuntimeError(f"Failed to download CityGML for {coordinates} in {state}")
    
    # Get the laser scan file if wanted
    if get_laser_data == True and laser_exists[state] == True:
        laser_path = download_laser_file(state, e, n)
        if not laser_path:
            print(f"ERROR: Failed to download Laser Scan for\n{coordinates} in {state}")
    else:
        laser_path = None
    
    print(gml_path)
    tree = ET.parse(gml_path)
    xml_root = tree.getroot()

    # Find the building by the coordinates
    footprints = create_ground_surface_list(xml_root, ns)
    print("List of LOD2 ids found: ", ID_LOD2_list)
    if ID_LOD2_list:
        bldg_id = ID_LOD2_list
    else:
        bldg_id = ["test"] # Make sure it's a list to begin with
        bldg_id[0] = find_building_by_point(e, n, footprints)
    if not bldg_id:
        print("WARNING: No building found at that point")
        return

    # Extract the building data from the CityGML file (LOD2 File) - also works for multiple buildings
    building_properties: dict[str, Any] = extract_building_data(xml_root, f"{street} {nr}", bldg_id, ns, roof_numbers)
    # If bldg_id is a list, now continue only with the first element - makes assigning results in the database easier
    if isinstance(bldg_id, list):
        bldg_id = bldg_id[0]

    # Calculate the volume of the building: Volume of the 3D Model (With Attic, without basement), only the basement volume and the attic volume.
    volumes = calculate_volume(
        building_properties["Triangulated_Geometry"], building_properties["Mesh"], building_properties["Roof_geometries"], 
        building_properties["Ground_area"], building_properties["Height"], building_properties["Roof_type_nr"])
    
    building_properties["volume_model"] = volumes["volume_model"]
    building_properties["volume_basement"] = volumes["volume_basement"]
    building_properties["volume_attic"] = volumes["volume_attic"]

    # Format results string to display in the GUI, exclude information that is not relevant for the user right now.
    excluded_keys = {"Wall_centers", "Ground_area_middle", "Address", "Wall_geometries", "Roof_geometries", "Ground_area_geometry", "coordinates", "facade_N", "facade_NE", "facade_E", "facade_SE", "facade_S", "facade_SW", "facade_W", "facade_NW"}
    lines = [f"{k}: {v}" for k, v in building_properties.items() if k not in excluded_keys]
    display_text = f"Adresse: {street} {nr}, {city}, {state}, {country}\nMaßeinheit: Meter\n\n" + "\n".join(lines)
    result_dict = building_properties
    result_dict["Street"] = street
    result_dict["House_number"] = nr
    result_dict["City"] = city
    result_dict["State"] = state
    result_dict["Country"] = country
    result_dict["Display_text"] = display_text
    zone_nr = get_utm_zone(state)
    result_dict["coordinates"] = convert_utm_to_lat_long(coords)
    result_dict["ID_LOD2"] = bldg_id
    result_dict["Coordinates_N"] = convert_utm_to_lat_long(coords)[1]
    result_dict["Coordinates_E"] = convert_utm_to_lat_long(coords)[0]

    # Get the laser scan points of type building in the correct area
    if laser_path and get_laser_data == True and laser_exists[state]==True:
        las = laspy.read(laser_path, laz_backend=laspy.LazBackend.Laszip)
        #print(f"Laserscan classifications in dataset: {np.unique(las.classification)}")
        all_points = las.xyz
        building_points_mask = las.classification == laser_building_classification[state] # Building data points are often classified differently for each state
        building_points = las.points[building_points_mask]
        building_xyz = all_points[building_points_mask]

        # Filter by points that are inside the ground surface (within a certain tolerance)
        in_groundsurface_mask = filter_points_by_location(building_xyz, building_properties["Ground_area_geometry"], 0.5)
        filtered_points_xyz = building_xyz[in_groundsurface_mask]
        filtered_points = building_points[in_groundsurface_mask]

        # Separate single and multi returns ---
        return_numbers = filtered_points['return_number']
        num_returns = filtered_points['number_of_returns']

        single_returns_mask = (np.asarray(return_numbers) == 1) & (np.asarray(num_returns) == 1)
        multi_returns_mask = (np.asarray(num_returns) > 1)

        Points_single = filtered_points_xyz[single_returns_mask]
        Points_multi = filtered_points_xyz[multi_returns_mask]

        Points_roof_extrusions = filter_roof_extrusion(building_properties["Roof_geometries"], Points_single, 0.18)
        Points_roof_extrusions_grouped = group_extrusions(Points_roof_extrusions, 0.45)
        roof_Extrusion_tops = model_extrusion_footprints(Points_roof_extrusions_grouped, 1.0, True)
        roof_extrusions = extrude_footprints(roof_Extrusion_tops, building_properties["Roof_geometries"])

        result_dict["Points_single"] = Points_single
        result_dict["Points_multi"] = Points_multi
        result_dict["Points_roof_extrusions"] = Points_roof_extrusions_grouped
        result_dict["Extrusion_tops"] = roof_Extrusion_tops
        result_dict["Extrusion_walls"] = roof_extrusions

    else:
        "No laser scan file found"
        Points_single = None
        Points_multi = None

        result_dict["Points_single"] = None
        result_dict["Points_multi"] = None
        result_dict["Points_roof_extrusions"] = None
        result_dict["Extrusion_tops"] = None
        result_dict["Extrusion_walls"] = None

    return result_dict