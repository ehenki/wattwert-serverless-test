from shapely.geometry import Polygon, LinearRing, LineString
from shapely.ops import split as shp_split
import numpy as np
import math

def _poly2d_from_3d(poly3d):
    return Polygon([(x, y) for x, y, _ in poly3d])

def _poly3d_from_shapely(poly2d: Polygon, z_value: float, want_closed: bool):
    """
    Lift 2D polygon to 3D at z=z_value.
    Preserve the input's closed/open convention:
      - want_closed=True  => keep the closing vertex (first == last)
      - want_closed=False => drop the last coord if it's a duplicate of the first
    """
    if poly2d.is_empty:
        return []
    coords = list(LinearRing(poly2d.exterior.coords).coords)  # this is closed
    if not want_closed and len(coords) >= 2 and coords[0] == coords[-1]:
        coords = coords[:-1]
    return [(float(x), float(y), float(z_value)) for x, y in coords]

def _long_split_line(origin_pt, direction_vec, bbox, scale=3.0) -> LineString:
    minx, miny, maxx, maxy = bbox
    diag = math.hypot(maxx - minx, maxy - miny) * scale
    d = np.asarray(direction_vec, dtype=float)
    n = np.linalg.norm(d)
    if n == 0.0:
        d = np.array([1.0, 0.0])
    else:
        d = d / n
    p1 = (origin_pt.x - d[0] * diag, origin_pt.y - d[1] * diag)
    p2 = (origin_pt.x + d[0] * diag, origin_pt.y + d[1] * diag)
    return LineString([p1, p2])

def _split_polygon_with_one_hole_into_two(poly_with_holes: Polygon):
    if not poly_with_holes.interiors:
        return [poly_with_holes]

    hole = list(poly_with_holes.interiors)[0]
    hole_centroid = Polygon(hole).centroid
    outer_centroid = poly_with_holes.exterior.centroid

    base_dir = np.array([hole_centroid.x - outer_centroid.x,
                         hole_centroid.y - outer_centroid.y], dtype=float)
    if np.allclose(base_dir, 0.0):
        base_dir = np.array([1.0, 0.0])

    # primary cut
    cut = _long_split_line(hole_centroid, base_dir, poly_with_holes.bounds, scale=3.0)
    parts_gc = shp_split(poly_with_holes, cut)
    parts = list(getattr(parts_gc, "geoms", []))

    # orthogonal fallback
    if len(parts) < 2:
        ortho = np.array([-base_dir[1], base_dir[0]], dtype=float)
        cut = _long_split_line(hole_centroid, ortho, poly_with_holes.bounds, scale=3.0)
        parts_gc = shp_split(poly_with_holes, cut)
        parts = list(getattr(parts_gc, "geoms", []))

    # direct connector fallback
    if len(parts) < 2:
        cut = LineString([(outer_centroid.x, outer_centroid.y),
                          (hole_centroid.x, hole_centroid.y)])
        parts_gc = shp_split(poly_with_holes, cut)
        parts = list(getattr(parts_gc, "geoms", []))

    if len(parts) == 2:
        return parts

    # stable fallback: biggest two
    parts_sorted = sorted(parts, key=lambda g: getattr(g, "area", 0.0), reverse=True)
    return parts_sorted[:2]

def split_courtyard_roofs(roof_surface_geometries, touch_epsilon: float = 0.02,
                          area_eps_abs: float = 1e-4, area_eps_rel: float = 1e-5):
    """
    For each roof polygon O, find other roof polygons H that are strictly contained
    within O in 2D (XY). Only split O; keep H untouched. Returns a new list of 3D polygons.
    - Preserves closed/open convention of each input ring.
    - Avoids duplicates in the output list.
    - Drops tiny sliver parts from the split (area threshold).
    """
    if not roof_surface_geometries:
        return []

    # Precompute shapely 2D polys, z, and closure flag per ring
    polys2d = []
    zvals = []
    is_closed = []
    for poly3d in roof_surface_geometries:
        closed = len(poly3d) >= 2 and tuple(poly3d[0]) == tuple(poly3d[-1])
        p2 = _poly2d_from_3d(poly3d)
        if p2.is_empty or not p2.is_valid or p2.area <= 0:
            polys2d.append(None)
            zvals.append(None)
            is_closed.append(closed)
            continue
        polys2d.append(p2)
        # Use the first vertex's z to preserve exact plane value
        zvals.append(float(poly3d[0][2]))
        is_closed.append(closed)

    n = len(roof_surface_geometries)
    output = []

    for i in range(n):
        pi = polys2d[i]
        if pi is None:
            continue

        # Detect "holes" as fully contained other roofs; we only use their outlines as signals.
        holes = []
        for j in range(n):
            if j == i:
                continue
            pj = polys2d[j]
            if pj is None:
                continue
            if pi.buffer(touch_epsilon).contains(pj.buffer(-touch_epsilon)):
                holes.append(pj)

        if not holes:
            # Keep original once (no duplicates)
            output.append(roof_surface_geometries[i])
            continue

        # Build polygon-with-holes from THIS outer only
        pwh = Polygon(pi.exterior.coords, [h.exterior.coords for h in holes])

        # Split iteratively until parts are simple (no interiors)
        queue = [pwh]
        simple_parts = []
        while queue:
            cur = queue.pop()
            if not cur.interiors:
                simple_parts.append(cur)
                continue
            p1, p2 = _split_polygon_with_one_hole_into_two(cur)
            for p in (p1, p2):
                if p.is_empty:
                    continue
                if p.interiors:
                    queue.append(p)
                else:
                    simple_parts.append(p)

        # Filter tiny slivers (absolute and relative to the original outer)
        outer_area = max(pi.area, 1.0)  # guard
        filtered = []
        for sp in simple_parts:
            if sp.area >= max(area_eps_abs, area_eps_rel * outer_area):
                filtered.append(sp)

        # Lift back to 3D preserving closure style and z of the outer
        zi = zvals[i]
        want_closed = is_closed[i]
        for sp in filtered:
            poly3d = _poly3d_from_shapely(sp, zi, want_closed)
            if poly3d:
                output.append(poly3d)

    return output
