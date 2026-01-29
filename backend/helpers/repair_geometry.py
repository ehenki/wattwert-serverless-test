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

# --- your split_courtyard_roofs() must already exist ---

def _as_np(poly):
    return np.asarray(poly, dtype=float)

def _get_plane_from_polygon(points3d):
    """
    Get a plane from a 3D polygon's vertices without using a "best-fit"
    method, to preserve the original orientation.
    Uses Newell's method for the normal and the mean for the origin.
    """
    points3d = np.asarray(points3d, dtype=float)
    if len(points3d) < 3:
        # Not enough points to define a plane, fallback to best-fit
        return trimesh.points.plane_fit(points3d)

    # Use the mean of the vertices as the plane's origin
    origin = np.mean(points3d, axis=0)
    
    # Use Newell's method to compute a robust normal
    normal = np.array([0.0, 0.0, 0.0], dtype=float)
    for i, p1 in enumerate(points3d):
        p2 = points3d[(i + 1) % len(points3d)]
        normal[0] += (p1[1] - p2[1]) * (p1[2] + p2[2])
        normal[1] += (p1[2] - p2[2]) * (p1[0] + p2[0])
        normal[2] += (p1[0] - p2[0]) * (p1[1] + p2[1])

    norm_len = np.linalg.norm(normal)
    if norm_len < 1e-9:
        # Fallback for degenerate polygons (e.g., all points collinear)
        return trimesh.points.plane_fit(points3d)

    normal /= norm_len
    return origin, normal

def _triangulate_polygon_3d(ring3d, *, engine='earcut', force_vertices=False):
    """
    Triangulate a single 3D polygon ring (no holes) to 3D triangles,
    using a robust method that preserves the polygon's global orientation.
    """
    P = _as_np(ring3d)
    if len(P) < 3:
        return np.empty((0,3), float), np.empty((0,3), int)

    # 1. Calculate plane from polygon, preserving original orientation
    origin, normal = _get_plane_from_polygon(P)

    # 2. Create a robust local coordinate system (orthonormal basis) for the plane
    z_axis = normal
    # Pick a world vector that is not parallel to the normal to create a stable basis
    if np.abs(np.dot(z_axis, [0, 0, 1])) > 0.99:  # Normal is close to vertical
        up_vector = np.array([0, 1, 0])
    else:
        up_vector = np.array([0, 0, 1])
    
    x_axis = np.cross(up_vector, z_axis)
    x_axis /= np.linalg.norm(x_axis)
    y_axis = np.cross(z_axis, x_axis)

    # 3. Create transformation matrix from local basis to world coordinates
    rotation_to_world = np.array([x_axis, y_axis, z_axis]).T
    
    # 4. Project original 3D points to the 2D plane of the new basis
    P_centered = P - origin
    pts2d = np.dot(P_centered, np.array([x_axis, y_axis]).T)

    # 5. Triangulate the 2D polygon
    poly2d = Polygon(pts2d)
    if not poly2d.is_valid or poly2d.area <= 1e-9:
        return np.empty((0,3), float), np.empty((0,3), int)

    v2d, f = trimesh.creation.triangulate_polygon(
        polygon=poly2d,
        engine=engine,
        force_vertices=force_vertices
    )
    if len(v2d) == 0 or len(f) == 0:
        return np.empty((0,3), float), np.empty((0,3), int)

    # 6. Map the new 2D vertices back to 3D world coordinates
    v3d_local = np.column_stack([v2d, np.zeros(len(v2d))])
    v3d_world = np.dot(v3d_local, rotation_to_world.T) + origin
    
    return v3d_world, f

def _triangulate_surface_list(surface_polygons, **kw):
    """
    Triangulate a list of 3D polygons.
    Returns a single packed (vertices, faces) by concatenating results.
    """
    all_vertices = []
    all_faces = []
    v_offset = 0

    for ring in surface_polygons:
        V, F = _triangulate_polygon_3d(ring, **kw)
        if len(V) == 0 or len(F) == 0:
            continue
        all_vertices.append(V)
        all_faces.append(F + v_offset)
        v_offset += len(V)

    if len(all_vertices) == 0:
        return np.empty((0,3), float), np.empty((0,3), int)

    Vcat = np.vstack(all_vertices)
    Fcat = np.vstack(all_faces)
    return Vcat, Fcat

def _create_combined_mesh(tri_wall_V, tri_wall_F, tri_roof_V, tri_roof_F, tri_ground_V, tri_ground_F):
    """Creates a single trimesh object from separate triangulated surface components."""
    all_vertices = []
    all_faces = []
    v_offset = 0

    if len(tri_wall_V) > 0:
        all_vertices.append(tri_wall_V)
        all_faces.append(tri_wall_F)
        v_offset += len(tri_wall_V)

    if len(tri_roof_V) > 0:
        all_vertices.append(tri_roof_V)
        all_faces.append(tri_roof_F + v_offset)
        v_offset += len(tri_roof_V)

    if len(tri_ground_V) > 0:
        all_vertices.append(tri_ground_V)
        all_faces.append(tri_ground_F + v_offset)

    if all_vertices:
        Vcat = np.vstack(all_vertices)
        Fcat = np.vstack(all_faces)
        return trimesh.Trimesh(vertices=Vcat, faces=Fcat)
    else:
        return trimesh.Trimesh()

def facade_areas_by_direction(normals, areas, wall_geometries_external):
    """
    Calculates the total facade area for each cardinal direction (N, E, S, W).

    Args:
        normals (np.ndarray): Array of face normal vectors, shape (n, 3).
        areas (np.ndarray): Array of face areas, shape (n,).
        wall_geometries_external (list): List of wall geometry polygons.

    Returns:
        dict: A dictionary with the total area for each cardinal direction.
    """
    # Define cardinal directions (North, East, South, West)
    directions = {
        "N": np.array([0, 1, 0]),
        "NE": np.array([1/np.sqrt(2), 1/np.sqrt(2), 0]),
        "E":  np.array([1, 0, 0]),
        "SE": np.array([1/np.sqrt(2), -1/np.sqrt(2), 0]),
        "S": np.array([0, -1, 0]),
        "SW": np.array([-1/np.sqrt(2), -1/np.sqrt(2), 0]),
        "W":  np.array([-1, 0, 0]),
        "NW": np.array([-1/np.sqrt(2), 1/np.sqrt(2), 0]),
    }

    # Initialize dictionary to hold areas
    areas_by_direction = {name: 0.0 for name in directions.keys()}
    avg_normal_by_direction = {name: np.array([0.0, 0.0, 0.0]) for name in directions.keys()}
    geometries_by_direction = {name: [] for name in directions.keys()}

    if len(normals) == 0:
        return areas_by_direction

    # For each facade, find the best matching cardinal direction
    # Dot product of normalized vectors gives the cosine of the angle; the direction with the highest dot product is the best match.
    dot_products = np.dot(normals, np.array(list(directions.values())).T)
    
    # Find the index of the maximum dot product for each normal
    best_match_indices = np.argmax(dot_products, axis=1)

    # Sum the areas for each direction
    direction_names = list(directions.keys())
    for i, dir_name in enumerate(direction_names):
        mask = (best_match_indices == i)
        areas_by_direction[dir_name] = np.sum(areas[mask])
        # Collect all wall geometries for this direction
        for j, is_match in enumerate(mask):
            if is_match:
                geometries_by_direction[dir_name].append(wall_geometries_external[j])
        avg_normal_by_direction[dir_name] = np.mean(normals[mask], axis=0)
    
    return areas_by_direction, avg_normal_by_direction, geometries_by_direction

def get_middle_points(avg_normal_by_direction, areas_by_dir, ground_surface_middle, vertices):
    # determie the furthest distance from the ground surface middle to any vertex in the geometry to be able to create proper positions for the facade refpoints in 3D view.
    furthest_distance = max(np.linalg.norm(np.array(p) - np.array(ground_surface_middle)) for p in vertices)
    facade_refpoints = []
    for normal in avg_normal_by_direction.values():
        normal[2] = 0.0 # set z component to 0 - we only use x and y components of normals to determine direction
        facade_refpoints.append(normal * furthest_distance + ground_surface_middle)
    
    for i, area in enumerate(areas_by_dir.values()): # Only count directions with sufficiently big area
        if area < 10:
            facade_refpoints[i] = []
        else:
            facade_refpoints[i][2] += 1.5 # bring the reference point on eye-level height to give a better reference for photos.
    return facade_refpoints

def repair_geometry(wall_surface_geometries, roof_surface_geometries, ground_surface_shape, ground_surface_middle):
    '''
    Repairs the geometry by "welding" the surfaces together, then triangulates ground/roof/walls into 3D triangles.
    These can then be used to calculate the facade areas by direction (see facade_areas_by_direction() and get_middle_points()).
    These are called by extract_building_data() in geomf.py after all other geometry processing is done.

    Args:
        wall_surface_geometries: List of wall surface polygons, each polygon is a list of (x,y,z) tuples
        roof_surface_geometries: List of roof surface polygons, each polygon is a list of (x,y,z) tuples
        ground_surface_shape:    List of ground surface polygons, each polygon is a list of (x,y,z) tuples

    Returns:
        dict with welded surfaces + triangulations:
    '''

    # First: Handle Roofs with "Holes", e.g. courtyards
    roof_surface_geometries = split_courtyard_roofs(
        roof_surface_geometries,
        touch_epsilon=0.02, area_eps_abs=1e-4, area_eps_rel=1e-5
    )

    # ---- Collect points (keep metadata, avoid repeated conversions) ----
    # surface_type: 0=ground, 1=roof, 2=wall (dominance: 0/1 over 2)
    def collect_all_points():
        pts = []
        types = []

        def add(polys, stype):
            for polygon in polys:
                for p in polygon:
                    pts.append(p)
                    types.append(stype)

        add(ground_surface_shape, 0)
        add(roof_surface_geometries, 1)
        add(wall_surface_geometries, 2)

        pts_arr = np.asarray(pts, dtype=float)  # (N,3)
        types_arr = np.asarray(types, dtype=np.int8)
        return pts, pts_arr, types_arr

    # ---- Seed-based “clusters”: neighbors within tolerance of the seed (not transitive) ----
    def find_clusters_kdtree(pts_arr, types_arr, tolerance):
        tree = cKDTree(pts_arr)
        N = len(pts_arr)
        visited = np.zeros(N, dtype=bool)
        clusters = []  # list of lists of indices

        for i in range(N):
            if visited[i]:
                continue
            neigh = tree.query_ball_point(pts_arr[i], r=tolerance)
            neigh = [j for j in neigh if not visited[j]]
            for j in neigh:
                visited[j] = True
            if len(neigh) > 1:
                clusters.append(neigh)
        return clusters

    # ---- Dominance centroid - Ground/roof "dominate" over walls ----
    def calculate_dominant_centroid_idx(cluster_idx, pts_arr, types_arr):
        c = np.asarray(cluster_idx, dtype=int)
        if c.size == 0:
            return None
        sel = pts_arr[c]

        m_ground = (types_arr[c] == 0)
        m_roof   = (types_arr[c] == 1)
        m_wall   = (types_arr[c] == 2)

        def mean_if(mask):
            if mask.any():
                return sel[mask].mean(axis=0)
            return None

        g = mean_if(m_ground); r = mean_if(m_roof); w = mean_if(m_wall)
        if g is not None and r is not None:
            return (g + r) / 2.0
        elif g is not None:
            return g
        elif r is not None:
            return r
        elif w is not None:
            return w
        else:
            return sel.mean(axis=0)

    # ---- Welding (exact tuple-key replacement) ----
    def weld_clusters(pts_tuple_list, clusters, pts_arr, types_arr):
        replacements = {}
        for cluster in clusters:
            centroid = calculate_dominant_centroid_idx(cluster, pts_arr, types_arr)
            centroid_t = tuple(float(x) for x in centroid)
            for idx in cluster:
                key = tuple(pts_tuple_list[idx])
                replacements[key] = centroid_t

        def replace_in_polys(polys):
            out = []
            for poly in polys:
                new_poly = []
                for p in poly:
                    new_poly.append(replacements.get(tuple(p), p))
                out.append(tuple(new_poly))
            return out

        repaired_ground = replace_in_polys(ground_surface_shape)
        repaired_roof   = replace_in_polys(roof_surface_geometries)
        repaired_wall   = replace_in_polys(wall_surface_geometries)
        return repaired_wall, repaired_roof, repaired_ground

    # ---- Connectivity check uses 0.01 as tolerance ----
    def check_connectivity_fast(pts_arr):
        tree = cKDTree(pts_arr)
        neigh_lists = tree.query_ball_point(pts_arr, r=0.01)
        return all(len(lst) >= 2 for lst in neigh_lists)

    # ---- Main welding loop ----
    tolerance = 0.01
    max_tolerance = 1
    tolerance_step = 0.01

    while tolerance <= max_tolerance:
        pts_tuple_list, pts_arr, types_arr = collect_all_points()
        clusters = find_clusters_kdtree(pts_arr, types_arr, tolerance)

        if clusters and check_connectivity_fast(pts_arr):
            repaired_wall, repaired_roof, repaired_ground = weld_clusters(
                pts_tuple_list, clusters, pts_arr, types_arr
            )

            # ---------- Triangulation ----------
            # force_vertices=True is critical to prevent the triangulation from creating new vertices and thus altering the global orientation of the geometry.
            # This ensures the original coordinate system is preserved.
            tri_wall_V, tri_wall_F     = _triangulate_surface_list(repaired_wall,  engine='earcut', force_vertices=True)
            tri_roof_V, tri_roof_F     = _triangulate_surface_list(repaired_roof,  engine='earcut', force_vertices=True)
            tri_ground_V, tri_ground_F = _triangulate_surface_list(repaired_ground,engine='earcut', force_vertices=True)

            # Check: Calculate the total area of the triangulated surfaces
            # --- triangulated surfaces (vectorized) ---
            total_facade_area = 0.0
            if len(tri_wall_F):
                total_facade_area += trimesh.triangles.area(tri_wall_V[tri_wall_F]).sum()

            repaired_mesh = _create_combined_mesh(
                tri_wall_V, tri_wall_F, tri_roof_V, tri_roof_F, tri_ground_V, tri_ground_F
            )
            
            return {
                "wall_surface_geometries": repaired_wall,
                "roof_surface_geometries": repaired_roof,
                "ground_surface_shape": repaired_ground,
                "triangulation": {
                    "wall":   {"vertices": tri_wall_V,   "faces": tri_wall_F},
                    "roof":   {"vertices": tri_roof_V,   "faces": tri_roof_F},
                    "ground": {"vertices": tri_ground_V, "faces": tri_ground_F},
                },
                "mesh": repaired_mesh,
                "total_facade_area": total_facade_area,
            }

        tolerance += tolerance_step

    print("Geometry could not be repaired! Trying to triangulate & calculate facade areas by cardinal direction anyways.")
    # Still try to triangulate inputs (best effort), so downstream can proceed
    # Also apply force_vertices=True here to maintain consistency.
    tri_wall_V, tri_wall_F     = _triangulate_surface_list(wall_surface_geometries,  engine='earcut', force_vertices=True)
    tri_roof_V, tri_roof_F     = _triangulate_surface_list(roof_surface_geometries,  engine='earcut', force_vertices=True)
    tri_ground_V, tri_ground_F = _triangulate_surface_list(ground_surface_shape,     engine='earcut', force_vertices=True)

    total_facade_area = 0.0
    if len(tri_wall_F):
        total_facade_area += trimesh.triangles.area(tri_wall_V[tri_wall_F]).sum()
    print(f"Total area of triangulated surfaces: {total_facade_area:.6f} m²")

    repaired_mesh = _create_combined_mesh(
        tri_wall_V, tri_wall_F, tri_roof_V, tri_roof_F, tri_ground_V, tri_ground_F
    )

    return {
        "wall_surface_geometries": wall_surface_geometries,
        "roof_surface_geometries": roof_surface_geometries,
        "ground_surface_shape": ground_surface_shape,
        "triangulation": {
            "wall":   {"vertices": tri_wall_V,   "faces": tri_wall_F},
            "roof":   {"vertices": tri_roof_V,   "faces": tri_roof_F},
            "ground": {"vertices": tri_ground_V, "faces": tri_ground_F},
        },
        "mesh": repaired_mesh,
        "total_facade_area": total_facade_area,
    }
