import numpy as np
from collections import defaultdict
import trimesh

import numpy as np
from scipy.spatial import cKDTree

from helpers.roof_repair import split_courtyard_roofs


import numpy as np
from scipy.spatial import cKDTree
from shapely.geometry import Polygon
import trimesh


def triangulate_polygon(polygon):
    """Triangulate a single polygon into vertices and faces"""
    if len(polygon) < 3:
        return [], []

    # Handle closed polygons (first and last points are the same)
    if len(polygon) > 1 and polygon[0] == polygon[-1]:
        vertices = list(polygon[:-1])  # Remove the duplicate closing point
    else:
        vertices = list(polygon)

    if len(vertices) < 3:
        return [], []

    faces = []

    # Use ear clipping or fan triangulation for simple polygons
    if len(vertices) == 3:
        # Already a triangle
        faces.append([0, 1, 2])
    elif len(vertices) == 4:
        # Quadrilateral - split into two triangles
        faces.append([0, 1, 2])
        faces.append([0, 2, 3])
    else:
        # For polygons with > 4 vertices, use fan triangulation
        # This assumes the polygon is convex and points are in order
        for i in range(1, len(vertices) - 1):
            faces.append([0, i, i + 1])

    return vertices, faces

def calculate_attic_volume(roof_surface_geometries):
    '''
    Calculates the volume of the attic using the roof surface geometries. Only used for non-flat roof cases.
    It works by taking the roof surfaces, and for every surface, create a "baseline" surface on the height of its lowest point.
    Then, project the roof surface onto the baseline surface, and calculate the volume of the resulting mesh. Add up all volume calculated this way.
    TODO (not urgent): Handle "Round" roofs better that have several segments. Right now, every segment is treated as a seperate roof surface. Leads to too small volumes.
    '''
    total_attic_volume = 0.0

    for k, roof_poly in enumerate(roof_surface_geometries, start=1):

        roof_vertices, top_faces = triangulate_polygon(roof_poly)
        if not roof_vertices or len(roof_vertices) < 3:
            continue

        # Optional: remove consecutive duplicate vertices
        def dedup(seq):
            out = []
            for p in seq:
                if not out or p != out[-1]:
                    out.append(p)
            # also drop if last equals first
            if len(out) > 1 and out[0] == out[-1]:
                out.pop()
            return out

        roof_vertices = dedup(roof_vertices)
        if len(roof_vertices) < 3:
            continue

        min_z = min(p[2] for p in roof_vertices)
        max_z = max(p[2] for p in roof_vertices)
        if abs(max_z - min_z) < 1e-6:  # flat
            continue

        # Build base ring at min_z using same XY order
        base_vertices = [(p[0], p[1], min_z) for p in roof_vertices]

        # Triangulate bottom (don’t re-close)
        _, bottom_faces_raw = triangulate_polygon(base_vertices)

        n = len(roof_vertices)
        all_vertices = roof_vertices + base_vertices
        all_faces = []

        # Top faces as-is
        all_faces.extend(top_faces)

        # Bottom faces: reverse winding and offset indices by n
        bottom_faces = [[idx + n for idx in face[::-1]] for face in bottom_faces_raw]
        all_faces.extend(bottom_faces)

        # Walls: correct diagonal!
        for i in range(n):
            p1_idx = i
            p2_idx = (i + 1) % n
            b1_idx = i + n
            b2_idx = (i + 1) % n + n

            all_faces.append([p1_idx, p2_idx, b2_idx])  # diagonal p1 -> b2
            all_faces.append([p1_idx, b2_idx, b1_idx])

        try:
            mesh = trimesh.Trimesh(vertices=all_vertices, faces=all_faces, process=True)
            mesh.remove_degenerate_faces()
            mesh.remove_duplicate_faces()
            mesh.remove_unreferenced_vertices()
            mesh.fix_normals()

            if mesh.is_watertight:
                vol = mesh.volume
                total_attic_volume += vol
            else:
                print("Warning: generated attic mesh component is not watertight.")
        except Exception as e:
            print(f"An error occurred during attic volume calculation for a roof surface: {e}")

    return total_attic_volume

def calculate_volume(triangulated_geometry, mesh, roof_surface_geometries, ground_surface_area, height, roof_type_nr):
    '''
    Calculates the volume of the geometry using trimesh.
    Takes wall, roof and ground surface geometries as input.
    Assumes the geometry is welded nicely.

    Steps:
    1. Triangulate the surfaces
    2. Check watertightness of the triangulated mesh
    3. Calculate & return the volume of the triangulation

    Args:
        wall_surface_geometries: List of wall surface polygons
        roof_surface_geometries: List of roof surface polygons
        ground_surface_shape: List of ground surface polygons

    Returns:
        float: The calculated volume, or 0.0 if watertightness check fails

    TODO: Buildings with "Holes" (courtyards) are not always handled correctly, can lead to too high volumes.
    '''

    if mesh is None:
        print("Failed to create mesh from geometry")
        return 0.0

    # Step 2: Check watertightness
    is_watertight = mesh.is_watertight

    # Calculate basic volume (extruded groundSurface) for sanity check
    if roof_type_nr == 1000: # case Flachdach
        simple_volume = float(ground_surface_area)* float(height)
    else:
        simple_volume = float(ground_surface_area)* (float(height)-4) + float(ground_surface_area) * 4 * 0.5 # Account for smaller volume in non flat roof cases. Assumption: 4m high roof
    print(f"Basic volume (Ground surface area * height, with roof type considered): {simple_volume} m³")

    if not is_watertight:
        print("Mesh is not watertight! Trying to calculate volume anyway.")
        print(f"Mesh has {len(mesh.faces)} faces and {len(mesh.vertices)} vertices")
        print(f"Number of holes: {len(mesh.facets_boundary) - len(mesh.facets)}")

    # Step 3: Calculate volume
    try:
        volume = mesh.volume
        print(f"Successfully calculated volume: {volume} m³")
    except Exception as e:
        print(f"Error calculating volume: {e}. Returning basic volume instead: {simple_volume} m³")
        volume = simple_volume

    if volume > 1.6 * simple_volume or volume < 0.2 * simple_volume:
        print("Sanity check failed: Volume is more than 160% or less than 20% of the basic volume. Using basic volume instead.")
        volume = simple_volume

    volume_basement = float(ground_surface_area)* 2.5 # Assumption: 2.5m high basement
    print(f"Volume basement: {volume_basement} m³")
    if roof_type_nr == 1000:
        volume_attic = 0
    else:
        try:
            volume_attic = calculate_attic_volume(roof_surface_geometries)
            print(f"Volume attic: {volume_attic} m³")
        except Exception as e:
            print(f"Error calculating attic volume: {e}. Returning basic estimate.")
            volume_attic = float(ground_surface_area)* 4 * 0.5 # Assumption: 4m high roof

    return {
        "volume_model": volume,
        "volume_basement": volume_basement,
        "volume_attic": volume_attic
    }

    