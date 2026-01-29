from geopy.geocoders import Nominatim
from shapely.geometry import Point
import utm
from .states_utm_zones import get_utm_zone
import pyproj
from .geometry_helpers import polygon_area_3d

# Initialize the geocoder
loc = Nominatim(user_agent="my_app")

def get_coords(state, address):
    # entering the location name
    try:
        getLoc = loc.geocode(address)
        
        # Checking if the location was found
        if getLoc:
            # Printing address
            print(getLoc.address)

            # Printing latitude and longitude
            print("Latitude =", getLoc.latitude)
            print("Longitude =", getLoc.longitude)
            # Convert the latitude and longitude to UTM
            zone_nr = get_utm_zone(state)
            utm_coords = utm.from_latlon(getLoc.latitude, getLoc.longitude, force_zone_number=zone_nr, force_zone_letter='N')
            
            utm_easting, utm_northing, utm_zone_number, utm_zone_letter = utm_coords

            # Printing UTM coordinates
            print(f"UTM Easting: {utm_easting}")
            print(f"UTM Northing: {utm_northing}")
            print(f"UTM Zone: {utm_zone_number}{utm_zone_letter}")
            return utm_coords
        else:
            print("Address not found")
            return None
    except Exception as e:
        print(f"Error geocoding address: {e}")
        return None

def convert_utm_to_lat_long(utm_coords):
    utm_zone = utm_coords[2]
    utm_crs = pyproj.CRS(f"+proj=utm +zone={utm_zone} +datum=WGS84 +units=m +no_defs +type=crs")
    wgs84_crs = pyproj.CRS("EPSG:4326")
    transformer = pyproj.Transformer.from_crs(utm_crs, wgs84_crs, always_xy=True)
    lat, lon = transformer.transform(utm_coords[0], utm_coords[1])
    return lat, lon

def find_building_by_point(x, y, bldg_footprints):
    point = Point(x, y)
    
    min_dist = float('inf')
    closest_id = None
    area_of_closest = 0
    
    min_dist_large = float('inf')
    closest_id_large = None

    for b_id, poly in bldg_footprints.items():
        # Check if the point is inside or calculate distance
        dist = 0 if poly.contains(point) else poly.distance(point)
        if dist == 0:
            print(f"Building clearly identified: Point is inside the ground surface area")
        # Calculate area using polygon_area_3d
        # Convert Shapely polygon exterior coordinates to a list of tuples
        area = polygon_area_3d(list(poly.exterior.coords))
        
        # Track the absolute closest building
        if dist < min_dist:
            min_dist = dist
            closest_id = b_id
            area_of_closest = area
            
        # Track the closest building with area > 25
        if area > 40 and dist < min_dist_large:
            min_dist_large = dist
            closest_id_large = b_id

    # If no building found at all or closest is too far
    if closest_id is None or min_dist > 100:
        return None

    # Logic: If the closest found polygon has an area < 40, 
    # take the closest polygon with an area > 40. 
    # But only if this new, bigger polygon is < 20 further away than the small one.
    if area_of_closest < 40 and closest_id_large and closest_id_large != closest_id:
        if min_dist_large < min_dist + 20:
            # Maintain the 100m threshold for whatever is returned
            if min_dist_large <= 100:
                print(f"Closest building {closest_id} is small (area={area_of_closest:.2f}), "
                      f"switching to larger building {closest_id_large} at distance {min_dist_large:.2f}")
                return closest_id_large
    else:
        print(f"Identified closest building at a distance of {min_dist:.2f} meters")

    return closest_id
