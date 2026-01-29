import importlib
import numpy as np
from shapely.geometry import Polygon, Point
from shapely.prepared import prep

def download_laser_file(state, utm_easting, utm_northing):
    modulename = f"{state}.laserdownloader"
    laserfunctions = importlib.import_module(modulename)
    # call state-specific download function
    path = laserfunctions.download_laser(utm_easting, utm_northing)
    return path

def filter_points_by_location(points_xyz, shape_coords, tolerance = 1.0):
    """
    Filters points that lie within a 2D polygon defined by shape_coords (usually the ground surface)
    Parameters:
    - points_xyz: np.ndarray of shape (N, 3), input points.
    - shape_coords: np.ndarray of shape (M, 3), polygon coordinates.

    Returns:
    - mask: np.ndarray of shape (N,), boolean mask for points inside the polygon.
    """
    coords_array = np.array(shape_coords[0])  # turn into numpy array with shape: (n_points, 3)
    # Create polygon and apply buffer
    poly = Polygon(coords_array[:, :2])
    if tolerance != 0:
        poly = poly.buffer(tolerance)

    prepared_poly = prep(poly)  # Speeds up many `contains` calls

    # Check containment
    mask = np.array([prepared_poly.contains(Point(xy)) for xy in points_xyz[:, :2]])

    return mask