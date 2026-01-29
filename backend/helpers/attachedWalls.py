from typing import List, Dict, Set, Tuple, Optional
import numpy as np
import xml.etree.ElementTree as ET
from shapely.geometry import Point
from helpers.geometry_helpers import polygon_area_3d, extract_neighbour_geom, compute_wall_angle
import copy
from shapely.geometry import Polygon as ShapelyPolygon

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

def find_neighbouring_buildings(x, y, bldg_footprints, id_lod2, building_search_radius):
    point = Point(x, y)
    
    # Check for buildings within a radius of building_search_radius metres.
    building_search_radius = building_search_radius
    building_ids = []
    for building_id, polygon in bldg_footprints.items():
        if polygon.distance(point) <= building_search_radius:
            if building_id != id_lod2: # ignore the current building
                building_ids.append(building_id)

    return building_ids

def boolean_difference(wall_1: List[Tuple[float, float, float]], wall_2: List[Tuple[float, float, float]]) -> List[List[Tuple[float, float, float]]]:
    """
    Compute the boolean difference of two wall geometries.
    Works by projecting wall_2 onto the plane of wall_1 and then
    subtracting the intersection from wall_1.
    """
    if not wall_1 or not wall_2:
        return [wall_1]

    wall_1_np = np.array(wall_1)
    wall_2_np = np.array(wall_2)

    # 1. Define the plane of wall_1
    p1, p2, p3 = wall_1_np[0], wall_1_np[1], wall_1_np[2]
    v1 = p2 - p1
    v2 = p3 - p1
    normal = np.cross(v1, v2)
    norm_mag = np.linalg.norm(normal)
    if norm_mag == 0: return [wall_1] # Invalid wall_1 geometry
    normal = normal / norm_mag

    # 2. Create a 2D basis (u, v vectors) on the plane of wall_1
    origin = wall_1_np[0]
    u = v1 / np.linalg.norm(v1)
    v = np.cross(normal, u)

    # 3. Project vertices of both polygons to the 2D system
    def project_to_2d(points_3d):
        projected_points = np.array([p - np.dot(p - origin, normal) * normal for p in points_3d])
        return np.array([[np.dot(p - origin, u), np.dot(p - origin, v)] for p in projected_points])

    wall_1_2d = project_to_2d(wall_1_np)
    wall_2_2d = project_to_2d(wall_2_np)

    # 4. Perform 2D boolean difference using shapely
    try:
        poly_1_2d = ShapelyPolygon(wall_1_2d)
        poly_2_2d = ShapelyPolygon(wall_2_2d)

        if not poly_1_2d.is_valid: poly_1_2d = poly_1_2d.buffer(0)
        if not poly_2_2d.is_valid: poly_2_2d = poly_2_2d.buffer(0)

        difference_2d = poly_1_2d.difference(poly_2_2d)
    except Exception:
        return [wall_1]

    # 5. Transform the result back to 3D
    def transform_to_3d(poly_2d):
        # Using exterior coords only, ignoring potential holes for this use case.
        # Shapely polygons have a repeated last point, so we slice it off [:-1].
        return [tuple(origin + p[0] * u + p[1] * v) for p in poly_2d.exterior.coords[:-1]]

    result_3d_polygons = []
    if difference_2d.is_empty:
        return []

    if difference_2d.geom_type == 'Polygon':
        result_3d_polygons.append(transform_to_3d(difference_2d))
    elif difference_2d.geom_type == 'MultiPolygon':
        for poly in difference_2d.geoms:
            result_3d_polygons.append(transform_to_3d(poly))

    # Convert all numpy float types to regular Python floats
    def convert_to_python_floats(polygons):
        result = []
        for polygon in polygons:
            converted_polygon = []
            for point in polygon:
                converted_point = tuple(float(coord) for coord in point)
                converted_polygon.append(converted_point)
            result.append(converted_polygon)
        return result

    return convert_to_python_floats(result_3d_polygons)

def subtract_attached_walls(
    wall_geometries: List[List[Tuple[float, float, float]]], # Walls of the current building
    xml_root: ET.Element, # LOD2 file
    ns: Dict[str, str], # Namespace for the LOD2 file
    utm_coords: List[float], # UTM coordinates of the current building
    building_id, # LOD2 ID(s) of the current building - can be string or list
    footprints: Dict[str, any], # Contains the footprints of all buildings in the same LOD2 file
):
    """
    Substract any walls of neighbouring buildings that intersect with the walls of the building_id(s).
    Only check in the same LOD2 File xml_root. Check for neighbouring buildings in the same LOD2 file first, get their walls.
    Find intersections.
    Return the remaining walls.
    """
    # Normalize building_id to a list for consistent processing
    if isinstance(building_id, list):
        building_ids = building_id
    else:
        building_ids = [building_id]

    # parameters for the identification of attached walls
    building_search_radius = 30 # in meters
    angle_tolerance = 3 # tolerance for the angle difference between attached walls in degrees
    distance_tolerance = 1.5 # tolerance for the distance between attached walls in meters

    # Find neighbours for all building IDs, excluding any of the target buildings from being considered neighbours
    neighbours_lod2_ids = find_neighbouring_buildings(utm_coords[0], utm_coords[1], footprints, building_ids[0], building_search_radius)
    # Remove any of the target buildings from the neighbours list
    neighbours_lod2_ids = [nid for nid in neighbours_lod2_ids if nid not in building_ids]

    # get all wall geometries of the neighbouring buildings
    neighbours_wall_geometries = []
    neighbours_geometries = []
    for neighbour_id in neighbours_lod2_ids:
        walls, neighbour_geom = extract_neighbour_geom(xml_root, target_building_id=neighbour_id, ns=ns)
        neighbours_wall_geometries.append(walls)
        neighbours_geometries.append(neighbour_geom)
    # Compute wall angles and normals for all walls of the current building
    wall_angles = []
    wall_normals = []
    for wall in wall_geometries:
        wall_area = polygon_area_3d(wall)
        wall_data = compute_wall_angle(wall, utm_coords, wall_area)
        wall_angles.append(wall_data["Angle"])
        wall_normals.append(wall_data["Normal"])
    
    # Compute wall angles for all walls of the neighbouring buildings
    neighbours_wall_angles = []
    for walls in neighbours_wall_geometries:
        current_wall_angles = []
        for wall in walls:
            wall_area = polygon_area_3d(wall)
            current_wall_angles.append(compute_wall_angle(wall, utm_coords, wall_area)["Angle"])
        neighbours_wall_angles.append(current_wall_angles)



    # Final filtering: replace neighbour walls that are attached (fulfill angle and distance constraint) with None.
    final_neighbour_geometries = copy.deepcopy(neighbours_wall_geometries)
    intersect_walls = [None for _ in wall_geometries]
    # turn every entry of intersect_walls into a list
    intersect_walls = [[] for _ in wall_geometries]

    for j, neighbour_walls_group in enumerate(neighbours_wall_geometries):
        for k, neighbour_wall in enumerate(neighbour_walls_group):
            if neighbour_wall is None:
                continue

            # Check if this neighbour wall is adjacent to any of the current building's walls. If not, remove it from the list - it's not relevant
            should_keep_wall = False
            for i, current_wall in enumerate(wall_geometries):
                current_angle = wall_angles[i]
                neighbour_angle = neighbours_wall_angles[j][k]
                
                if neighbour_angle is None: continue

                delta = min(abs(current_angle - neighbour_angle), abs(current_angle + 180 - neighbour_angle), abs(current_angle - 180 + neighbour_angle))
                angular_distance = min(delta, 180 - delta) # May seem odd, but as the max. angle is 180 degrees, we must use this instead of 360.

                if angular_distance < angle_tolerance:
                    # 2. Distance Check - find minimum distance between any two vertices between the two walls
                    min_distance = float('inf')
                    for curr_point in current_wall:
                        for neigh_point in neighbour_wall:
                            curr_np = np.array(curr_point)
                            neigh_np = np.array(neigh_point)
                            distance = np.linalg.norm(curr_np - neigh_np)
                            if distance < min_distance:
                                min_distance = distance

                    if min_distance <= distance_tolerance:
                        should_keep_wall = True
                        intersect_walls[i].append(neighbour_wall)
            
            if not should_keep_wall:
                final_neighbour_geometries[j][k] = None


    # Filter the LOD2 ids of buildings that actually have adjacent walls
    actual_neighbour_ids = []
    actual_neighbour_geometries = []
    surrounding_buildings_ids = []
    surrounding_buildings_geometries = []
    for i, neighbour_geometry in enumerate(final_neighbour_geometries):
        if any(wall is not None for wall in neighbour_geometry):
            actual_neighbour_ids.append(neighbours_lod2_ids[i])
            actual_neighbour_geometries.append(neighbours_geometries[i])
        else:
            # All buildings with no "true" adjacent walls are treated only as surrounding buildings.
            surrounding_buildings_geometries.append(neighbours_geometries[i])
            surrounding_buildings_ids.append(neighbours_lod2_ids[i])

    # final_wall_geometries will be a flat list of final wall polygons (or fragments)
    final_wall_geometries = []
    for i, original_wall in enumerate(wall_geometries):
        intersecting_walls = intersect_walls[i]
        
        if not intersecting_walls:
            # If there are no intersections, add the original wall
            final_wall_geometries.append(original_wall)
        else:
            # If there are intersections, calculate the remaining fragments
            fragments = [original_wall]
            for intersect_wall in intersecting_walls:
                next_fragments = []
                for fragment in fragments:
                    next_fragments.extend(boolean_difference(fragment, intersect_wall))
                fragments = next_fragments
            
            final_wall_geometries.extend(fragments)
    return {
        "Wall_geometries_external": final_wall_geometries, # new geometries with attached walls subtracted
        "neighbour_lod2_ids": actual_neighbour_ids, # LOD2 ids of buildings that actually have adjacent walls. Maybe use later for visualization.
        "neighbour_geometries": actual_neighbour_geometries,
        "surrounding_buildings_geometries": surrounding_buildings_geometries,
        "surrounding_buildings_lod2_ids": surrounding_buildings_ids
    }
