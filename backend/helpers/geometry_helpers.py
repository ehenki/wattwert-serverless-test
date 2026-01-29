import numpy as np
from itertools import combinations

import xml.etree.ElementTree as ET

def extract_neighbour_geom(xml_root, target_building_id, ns):
    """
    Extracts only the walls of a building from a CityGML file by building ID. Used for getting walls of neighbouring buildings and then substracting them in attachedWalls.py
    """
    # Iterate through all WallSurface elements in the building

    for building in xml_root.findall(".//bldg:Building", ns):
        building_id = building.get("{http://www.opengis.net/gml}id")
        if building_id == target_building_id:
            break

    wall_surface_geometries = []

    for wall_surface in building.findall(".//bldg:WallSurface", ns):
        # 1) Geometry: parse posList
        pos_list_elem = wall_surface.find(".//gml:posList", ns)
        if pos_list_elem is None:
            continue

        # build list of (x,y,z)
        try:
            vals = [float(v) for v in pos_list_elem.text.split()]
            geom = [(vals[i], vals[i+1], vals[i+2]) 
                    for i in range(0, len(vals), 3)]
        except (ValueError, IndexError) as e:
            wid = wall_surface.get("{gml:id}", "unknown")
            print(f"Warning: bad coords on wall {wid}: {e}")
            continue

        wall_surface_geometries.append(geom)

    roof_surface_geometries = []
    # Iterate through all RoofSurface elements in the building
    for roof_surface in building.findall(".//bldg:RoofSurface", ns):
        # 1) find the posList
        pos_list = roof_surface.find(".//gml:posList", ns)
        if pos_list is None:
            # no geometry to measure, but still count it
            roof_surface_count += 1
            continue

        # 2) parse into [(x,y,z), …]
        try:
            vals = [float(v) for v in pos_list.text.split()]
            geom = [(vals[i], vals[i+1], vals[i+2]) for i in range(0, len(vals), 3)]
        except (ValueError, IndexError) as e:
            wid = roof_surface.get("{gml:id}", "unknown")
            print(f"Warning: bad coords on roof surface {wid}: {e}")
            roof_surface_count += 1
            continue

        pos_list_elem = roof_surface.find(".//gml:posList", ns)
        if pos_list_elem is not None:
            try:
                # Convert text to a list of floats, handling potential errors
                coords = [float(value) for value in pos_list_elem.text.split()]
                # Convert to a list of (x, y, z) tuples
                geometry = [(coords[i], coords[i+1], coords[i+2]) for i in range(0, len(coords), 3)]
                roof_surface_geometries.append(geometry)
            except (ValueError, IndexError) as e:
                print(f"Warning: Error processing coordinates for wall surface {roof_surface.get('{gml:id}', 'unknown')}: {e}")
    # combine into one list
    neighbour_geom = wall_surface_geometries + roof_surface_geometries

    return wall_surface_geometries, neighbour_geom

def polygon_area_3d(coords):
    # returns the magnitude of the projection of the polygon onto its own plane, which is equivalent to the actual area. Works for planar polygons.
    P = np.array(coords)
    P_next = np.roll(P, -1, axis=0)
    cross_sum = np.cross(P, P_next).sum(axis=0)
    return 0.5 * np.linalg.norm(cross_sum)

def calculate_external_wall_properties(wall_geometries, reference_mesh):
    """
    Calculates face areas and normals for external wall geometries, oriented with respect to a reference mesh.

    Args:
        wall_geometries (list): A list of polygons, where each polygon is a list of 3D vertex coordinates.
        reference_mesh (trimesh.Trimesh): A watertight trimesh object of the building volume.

    Returns:
        tuple: A tuple containing:
            - face_areas (np.ndarray): An array of areas for each wall polygon.
            - face_normals (np.ndarray): An array of correctly oriented normal vectors for each wall polygon.
    """
    face_areas = []
    face_normals = []

    if not wall_geometries:
        return np.array([]), np.array([])
    total_area = 0
    for wall_polygon in wall_geometries:
        # Ensure polygon has at least 3 vertices to form a plane
        if len(wall_polygon) < 3:
            continue
            
        # 1. Calculate area
        area = polygon_area_3d(wall_polygon)
        if area < 1e-6: # Skip degenerate polygons
            continue
        face_areas.append(area)

        # 2. Calculate normal: try only valid vertex triplets; avoid z-dominant or tiny normals
        vertices = [np.array(p) for p in wall_polygon if p is not None]

        def try_compute_normal(a, b, c):
            v1_local = b - a
            v2_local = c - a
            n_local = np.cross(v1_local, v2_local)
            mag_local = np.linalg.norm(n_local)
            if mag_local <= 1e-6:
                return None
            n_local = n_local / mag_local
            # Valid wall normals should primarily lie in the XY-plane
            if abs(n_local[2]) >= 0.5:
                return None
            return n_local

        normal = None
        if len(vertices) >= 3:
            # Iterate over all unique triplets and pick the first valid normal
            for i, j, k in combinations(range(len(vertices)), 3):
                candidate = try_compute_normal(vertices[i], vertices[j], vertices[k])
                if candidate is not None:
                    normal = candidate
                    break

        # Fallback: derive a replacement normal from mesh centroid to polygon average (XY only)
        if normal is None:
            centroid = np.mean(np.array(vertices), axis=0)
            mesh_centroid = getattr(reference_mesh, "centroid", None)
            if mesh_centroid is None:
                mesh_centroid = getattr(reference_mesh, "center_mass", None)
            if mesh_centroid is None:
                mesh_centroid = np.mean(np.array(reference_mesh.vertices), axis=0)
            replacement = centroid - mesh_centroid
            replacement[2] = 0.0
            rep_mag = np.linalg.norm(replacement)
            if rep_mag <= 1e-12:
                normal = np.array([1.0, 0.0, 0.0])
            else:
                normal = replacement / rep_mag

        # 3. Orient the normal using the reference mesh. If the test point is inside the (closed) reference mesh, the normal is flipped.
        centroid = np.mean(np.array(vertices), axis=0)
        test_point = centroid + 0.1 * normal
        if reference_mesh.contains([test_point])[0]:
            normal = -normal
        face_normals.append(normal)
        total_area = total_area + area
    return np.array(face_areas), np.array(face_normals), total_area

def compute_wall_angle(geometry, refpoint, area):

    ''' 
    Right now only used for detecting attached walls, wall normals & directions of active building are determined using calculate_external_wall_properties.
    This is more reliable for the active building, especially differenciating between N/S, E/W etc.
    This function is simpler in its application and robust for attached wall detection.
    '''
    ref_vector = (0, 1, 0) # vector to compute the angle from, pointing straight north in UTM coordinates
    # Choose three distinct points - here, simply the first three are chosen. Any 3 points on a wall surface should work as long as it's vertical (which all wall surfaces should be)
    p1 = np.array(geometry[0])
    p2 = np.array(geometry[1])
    p3 = np.array(geometry[2])
    # Compute two vectors in the plane
    v1 = p2 - p1
    v2 = p3 - p1

    # Compute the normal to the plane
    normal = np.cross(v1, v2)
    normal[2] = 0  # Assume walls are vertical, so normal is in XY plane
    normal = normal / np.linalg.norm(normal)  # Normalize the normal vector
    center = np.mean(geometry, axis=0)

    cos_theta = np.dot(normal, ref_vector) / (np.linalg.norm(normal) * np.linalg.norm(ref_vector))
    theta_rad = np.arccos(np.clip(cos_theta, -1.0, 1.0))  # Clip for numerical stability
    #theta_rad = np.arccos(cos_theta)
    theta_deg = np.degrees(theta_rad)

    # average wall position vs. building center
    avg_x = np.average([p[0] for p in geometry])
    avg_y = np.average([p[1] for p in geometry])
    dx = avg_x - refpoint[0]
    dy = avg_y - refpoint[1]

    # sector edges for 8-way compass (22.5° each)
    # Use parentheses so 'or'/'and' precedence is unambiguous.
    if (theta_deg < 22.5) or (theta_deg >= 157.5):
        # Mostly North/South: choose by dy
        if dy > 0:
            direction = "North"
        elif dy <= 0:
            direction = "South"
        else:
            direction = "Unknown"

    elif (112.5 <= theta_deg < 157.5):
        # Diagonals 1: choose by quadrant of (dx, dy)
        if dx > 0 and dy > 0:
            direction = "South-East"
        elif dx < 0 and dy < 0:
            direction = "South-West"
        elif dx > 0: # decide only by dy (east/west) if no decision can be made by including dx
            direction = "South-East"
        else:
            direction = "South-West"
    
    elif  22.5 < theta_deg < 67.5: 
        # Diagonals 2: choose by quadrant of (dx, dy)
        if dx > 0 and dy < 0:
            direction = "North-East"
        elif dx < 0 and dy > 0:
            direction = "North-West"
        elif dx < 0: # decide only by dy (east/west) if no decision can be made by including dx
            direction = "North-West"
        else:
            direction = "North-East"


    elif 67.5 <= theta_deg <= 112.5:
        # Mostly East/West: choose by dx
        if dx > 0:
            direction = "East"
        elif dx <= 0:
            direction = "West"
        else:
            direction = "Unknown"

    else:
        direction = "Unknown"

    return {
            "Angle": theta_deg,
            "Direction": direction,
            "Area": area,
            "Center": center,
            "Normal": normal
    }
