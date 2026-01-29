import importlib
from shapely.geometry import Polygon
import numpy as np
from sklearn.cluster import DBSCAN
from scipy.spatial import ConvexHull
from shapely.geometry import Point
import cv2
import os
import sys
from helpers.repair_geometry import repair_geometry, facade_areas_by_direction, get_middle_points
from helpers.geometry_helpers import polygon_area_3d, calculate_external_wall_properties
from helpers.attachedWalls import subtract_attached_walls	

# Add the backend directory to Python path for imports
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)


def compute_roof_pitch(geometry, area):
    # computes the pitch of a roof surface relative to the ground surface in °
    # 0°: Flat roof, hypothetical 90°: "vertical" roof (would be a wall)
    ref_vector = (0, 0, 1) # reference vector for the pitch, points straight up
    # choose three distinct points from the surface. Any three work, as long as it's a flat polygon (which all roof surfaces should be). Here, the first three are chosen.
    p1 = np.array(geometry[0])
    p2 = np.array(geometry[1])
    p3 = np.array(geometry[2])
    # Compute two vectors in the plane
    v1 = p2 - p1
    v2 = p3 - p1
    normal = np.cross(v1, v2)
    normal = normal / np.linalg.norm(normal)  # Normalize the normal vector
    cos_theta = np.dot(normal, ref_vector) / (np.linalg.norm(normal) * np.linalg.norm(ref_vector))
    theta_rad = np.arccos(np.clip(cos_theta, -1.0, 1.0))  # Clip for numerical stability
    #theta_rad = np.arccos(cos_theta)
    theta_deg = np.degrees(theta_rad)
    return theta_deg, area

def group_extrusions(points, threshold=0.3):
    # groups the input points (shape (N,3) - in out usecase: Laserscan points of roof extrusions into groups
    # group separation is defined by threshold

    if len(points) == 0:
        return []
    
    # DBSCAN clustering in 3D space
    clustering = DBSCAN(eps=threshold, min_samples=1).fit(points)
    # Group points by their cluster labels
    labels = clustering.labels_
    unique_labels = np.unique(labels)
    clusters = [points[labels == label] for label in unique_labels]

    return clusters

def fit_plane(points):
    # Fit a plane to a list of 3D points using least squares
    points = np.array(points)
    A = np.c_[points[:, 0], points[:, 1], np.ones(points.shape[0])]
    C, _, _, _ = np.linalg.lstsq(A, points[:, 2], rcond=None)
    # Plane: z = C[0]*x + C[1]*y + C[2]
    return C

def filter_roof_extrusion(roof_surfaces, points, threshold = 0.3):
    # Filters all the points from a given building point cloud that are a certain threshold above the roof surface(s)
    # and returns the resulting points

    points_above = []

    for surface in roof_surfaces:
        surface = np.array(surface)
        xy_poly = Polygon(surface[:, :2])
        plane = fit_plane(surface)

        for pt in points:
            x, y, z = pt
            if not xy_poly.contains(Point(x, y)):
                continue
            z_roof = plane[0] * x + plane[1] * y + plane[2]
            if z > z_roof + threshold:
                points_above.append(pt)

    return np.array(points_above)

def approximate_surface_as_rectangle(surface_points):
    # Given 4 (or more) 3D points that form a quadrilateral surface, return a rectangle in 3D that best fits those points.
    # used to correct oddly shaped roof extrusions (Dachgauben)
    if len(surface_points) < 4:
        raise ValueError("Surface must contain at least 4 points")

    pts = np.array(surface_points)
    
    # Step 1: Compute best-fit plane
    centroid = np.mean(pts, axis=0)
    centered = pts - centroid
    _, _, vh = np.linalg.svd(centered)
    normal = vh[2]

    # Step 2: Create a local 2D coordinate system in the plane
    # Choose two orthogonal vectors in the plane
    v1 = vh[0]
    v2 = vh[1]

    # Step 3: Project points onto 2D plane coordinates
    projected_2d = np.array([[np.dot(p - centroid, v1), np.dot(p - centroid, v2)] for p in pts]).astype(np.float32)

    # Step 4: Use OpenCV to find the min-area rectangle
    rect = cv2.minAreaRect(projected_2d)
    box_2d = cv2.boxPoints(rect)

    # Step 5: Map 2D box corners back to 3D
    rectangle_3d = [tuple(centroid + pt[0] * v1 + pt[1] * v2) for pt in box_2d] # type: ignore  
    rectangle_3d.append(rectangle_3d[0])  # close polygon

    return rectangle_3d

def model_extrusion_footprints(point_groups, size_threshold_m2, model_as_rectangle = False):

    # Takes min and max x,y and z value of each point group to define the rectangular surface that fits the group the best. Represents the roof/top of a roof extension (Dachgaube) in the use case.
    # Returns a List of rectangular surfaces as closed polygon [(x1, y1, z), ..., (x1, y1, z)]

    surfaces = []

    for cluster in point_groups:
        if cluster.shape[0] < 3:
            continue  # Can't form a polygon

        # Compute axis-aligned bounding box in XY
        min_x, min_y = np.min(cluster[:, :2], axis=0)
        max_x, max_y = np.max(cluster[:, :2], axis=0)

        # Define bounding box corner positions (XY only)
        corners_xy = np.array([
            [min_x, min_y],
            [max_x, min_y],
            [max_x, max_y],
            [min_x, max_y]
        ])

        # Find the closest actual point in the cluster for each corner to get Z values
        surface = []
        for cx, cy in corners_xy:
            distances = np.linalg.norm(cluster[:, :2] - np.array([cx, cy]), axis=1)
            nearest_index = np.argmin(distances)
            nearest_point = cluster[nearest_index]
            surface.append((float(nearest_point[0]), float(nearest_point[1]), float(nearest_point[2])))

        # Close the polygon
        surface.append(surface[0])
        # Figuring out the area of the top plane, first: only use x,y coordinates (determining the area from a "top view", ignoring z-coordinates, is good enough)
        xy_points = [(x, y) for x, y, z in surface]
        # Create polygon and compute area
        polygon = Polygon(xy_points)
        area = polygon.area

        if area > size_threshold_m2: # filter roof extrusions that are smaller than the threshold, because they like are either artifacts, chimneys or satellite dishes and therfore not relevant
            surfaces.append(surface)

        # Approximate modeled surfaces as the most closely matching rectangle, if condition = True. May help to give a more realistic shape to the sometimes uneven models obtained from laser data.
        if model_as_rectangle == True: 
            for i in range(0, len(surfaces)):
                surfaces[i] = approximate_surface_as_rectangle(surfaces[i])

    return surfaces

def find_roof_z_below(point, roof_surfaces):
    # Finds the highest Z (roof) directly below the given (x, y).
    # Returns the Z value or None if no surface found below.

    x, y, z_top = point
    candidate_zs = []

    for surface in roof_surfaces:
        # Extract horizontal polygon and Zs
        poly_xy = [(vx, vy) for vx, vy, _ in surface]
        poly_z = [vz for _, _, vz in surface]
        # Simple point-in-polygon test
        if Polygon(poly_xy).contains(Point(x, y)):
            min_z = np.min(poly_z)
            if min_z < z_top:  # only surfaces *below* the point
                candidate_zs.append(min_z)
                print("Z: ", candidate_zs)

    if candidate_zs:
        return max(candidate_zs)  # Use highest roof below
    else:
        return None

def extrude_footprints(extrusion_tops, roof_surfaces):
    # For each edge in each extrusion top surface, create a vertical wall extending downward until it intersects with any of the roof surfaces.
    # extrusion_walls (list of list of (x, y, z)): List of wall surfaces as closed polygons
    extrusion_walls = []
    for top_surface in extrusion_tops:
        extrusion_walls_element = []
        for i in range(len(top_surface) - 1):  # Iterate over edges
            p1 = top_surface[i]
            p2 = top_surface[i + 1]

            # Use the lowest roof Z directly below each point
            base_z1 = find_roof_z_below(p1, roof_surfaces)
            base_z2 = find_roof_z_below(p2, roof_surfaces)

            if base_z1 is None or base_z2 is None:
                print("BASE COULD NOT BE DETERMINED")
                continue  # Skip wall if we couldn't determine base

            # Construct vertical wall polygon (quad)
            wall = [
                (p1[0], p1[1], p1[2]),
                (p2[0], p2[1], p2[2]),
                (p2[0], p2[1], base_z2),
                (p1[0], p1[1], base_z1),
                (p1[0], p1[1], p1[2])  # close polygon
            ]
            extrusion_walls_element.append(wall)
        extrusion_walls.append(extrusion_walls_element)
    return extrusion_walls

def download_LOD2_file(state, utm_easting, utm_northing):
    try:
        # Import the state-specific module from the backend directory
        module_path = f"States_data_download.{state}.LOD2downloader"
        LOD2functions = importlib.import_module(module_path)
        # call state-specific download function
        path = LOD2functions.download_LOD2(utm_easting, utm_northing)
        return path
    except ImportError as e:
        print(f"Error importing module for state {state}: {e}")
        print(f"Current sys.path: {sys.path}")
        return None
    except Exception as e:
        print(f"Error downloading LOD2 file for state {state}: {e}")
        return None

def create_ground_surface_list(xml_root, ns):

    footprints = {}
    for b in xml_root.findall(".//bldg:Building", ns):
        bid = b.get("{http://www.opengis.net/gml}id")
        for gs in b.findall(".//bldg:boundedBy/bldg:GroundSurface", ns):
            pos = gs.find(".//gml:posList", ns)
            if pos is None: continue
            coords = list(map(float, pos.text.split()))
            pts = [(coords[i], coords[i+1]) for i in range(0,len(coords),3)]
            footprints[bid] = Polygon(pts)
    return footprints

def extract_building_data(xml_root, target_address=None, target_building_id=None, ns=None, roof_numbers=None):
    """
    Extracts building data from a CityGML file by either address or building ID.
    
    :param target_address: The address to search for.
    :param target_building_id: The building ID (string) or list of building IDs to search for.
    :return: Dictionary with building information.
    """
    # Normalize target_building_id to a list
    if target_building_id:
        if isinstance(target_building_id, str):
            # If it's a string, check if it contains multiple IDs separated by commas or is a list-like string
            if ',' in target_building_id or '[' in target_building_id:
                # Handle comma-separated or list-like strings
                building_ids = [bid.strip().strip("[]'\" ") for bid in target_building_id.replace('[', '').replace(']', '').split(',')]
            else:
                building_ids = [target_building_id]
        elif isinstance(target_building_id, list):
            building_ids = target_building_id
        else:
            building_ids = [str(target_building_id)]
    else:
        building_ids = None
    
    def get_building_data(building, search_value, search_type, roof_numbers):
        #Extracts relevant building data from a given building element.
        height_roof_elem = building.find(".//gen:stringAttribute[@name='HoeheDach']/gen:value", ns)
        height_ground_elem = building.find(".//gen:stringAttribute[@name='HoeheGrund']/gen:value", ns)
        height_roof_lowerend_elem = building.find(".//gen:stringAttribute[@name='NiedrigsteTraufeDesGebaeudes']/gen:value", ns)
        if height_roof_lowerend_elem is None:
            height_roof_lowerend_elem = building.find(".//gen:stringAttribute[@name='MittlereTraufHoehe']/gen:value", ns)
        roof_type_elem = building.find(".//bldg:roofType", ns)
        measured_height_elem = building.find(".//bldg:measuredHeight", ns)
        storeys_elem = building.find(".//bldg:storeysAboveGround", ns)
        groundsurface_elem = building.find(".//bldg:GroundSurface/gen:stringAttribute[@name='Flaeche']/gen:value", ns)

        # Initialize variables for ground and wall surfaces
        total_wall_surface_area = 0.0
        wall_surface_count = 0
        total_ground_surface_area = 0.0 
        ground_surface_count = 0 # There is most likely only 1 ground surface per building defined, but we want to be prepared for exceptions
        ground_surface_middle = []
        total_roof_surface_area = 0.0
        roof_surface_count = 0

        total_ground_surface_area = 0.0
        ground_surface_count = 0
        ground_surface_shape = []

        roof_surface_pitches = []
        # Iterate through all ground surface elements in the building (there should be just one, but to be sure)
        for ground_surface in building.findall(".//bldg:GroundSurface", ns):
            pos_list = ground_surface.find(".//gml:posList", ns)
            if pos_list is None:
                # no geometry, skip but still count?
                ground_surface_count += 1
                continue

            try:
                vals = [float(v) for v in pos_list.text.split()]
                geom = [(vals[i], vals[i+1], vals[i+2]) for i in range(0, len(vals), 3)]
            except (ValueError, IndexError) as e:
                wid = ground_surface.get("{gml:id}", "unknown")
                print(f"Warning: bad coords on ground surface {wid}: {e}")
                ground_surface_count += 1
                continue

            # compute area from geom
            area = round(polygon_area_3d(geom), 2)
            total_ground_surface_area += area
            ground_surface_count += 1

            # Extract coordinates from gml:posList
            pos_list_elem = ground_surface.find(".//gml:posList", ns)
            if pos_list_elem is not None:
                try:
                    coords = [float(value) for value in pos_list_elem.text.split()]
                    if len(coords) % 3 == 0:  # Ensure we have (x, y, z) triples
                        ground_surface_shape.append([(coords[i], coords[i+1], coords[i+2]) for i in range(0, len(coords), 3)])
                        # Compute centroid (mean of x, y, z)
                        centroid = np.mean(ground_surface_shape[0], axis=0)
                        ground_surface_middle.append(centroid)
                except (ValueError, IndexError) as e:
                    print(f"Warning: Error processing ground surface coordinates: {e}")

        ground_surface_middle = ground_surface_middle[0] # Only one ground surface middle makes sense, there should usually only be one ground surface anyway

        # Iterate through all WallSurface elements in the building
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

            # 3) compute area & accumulate
            area = round(polygon_area_3d(geom), 2)
            total_roof_surface_area += area
            roof_surface_count      += 1
            # Find the posList inside the LinearRing
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
            # Compute pitch of the roof surface and add it to the list
            roof_surface_pitches.append(compute_roof_pitch(geometry, area))

        totalRP = 0
        for i in range(len(roof_surface_pitches)):
            totalRP += roof_surface_pitches[i][0] * roof_surface_pitches[i][1]

        avg_roof_pitch = totalRP / total_roof_surface_area
        
        # Get values if they exist
        height_roof = height_roof_elem.text if height_roof_elem is not None else "Not found"
        height_ground = height_ground_elem.text if height_ground_elem is not None else "Not found"
        height_roof_lowerend = height_roof_lowerend_elem.text if height_roof_lowerend_elem is not None else "Not found"
        roof_type = roof_type_elem.text if roof_type_elem is not None else "Not found"
        measured_height = measured_height_elem.text if measured_height_elem is not None else "Not found"
        storeys = int(storeys_elem.text) if storeys_elem is not None else "Not found"

        # Convert numerical values safely
        try:
            height_roof = float(height_roof) if height_roof != "Not found" else None
            height_ground = float(height_ground) if height_ground != "Not found" else None
            height_roof_lowerend = float(height_roof_lowerend) if height_roof_lowerend != "Not found" else None
            calculated_height = height_roof - height_ground if height_roof is not None and height_ground is not None else "Not calculated"
            total_wall_surface_area = round(float(total_wall_surface_area),2) if total_wall_surface_area != 0.0 else None
            total_ground_surface_area = round(float(total_ground_surface_area),2) if total_ground_surface_area != 0.0 else None
            total_roof_surface_area = round(float(total_roof_surface_area),2) if total_roof_surface_area != 0.0 else None
        except ValueError:
            calculated_height = "Not calculated"

        # Calculate Bruttogrundflaeche (BGF)
        if storeys == "Not found":
            bgf = round(int(float(measured_height)/3.5) * total_ground_surface_area, 2) if total_ground_surface_area is not None else None
            storeys = float(measured_height)/3.5
            hint = "BGF und Stockwerkanzahl geschätzt, keine Angabe zur Stockwerkanzahl verfügbar"
        else:
            bgf = round(total_ground_surface_area*storeys, 2) if total_ground_surface_area is not None else None
            hint = "-"

        # Get roof type name
        roof_type_name = roof_numbers.get(int(roof_type), "Unknown") if roof_type.isdigit() else "Unknown"

        # Handle exceptions if data is missing - may be the case for some states or buildings
        if height_ground is None:
            height_ground = 0

        # "Repair" the geometry, in case it is not watertight. Not yet optimized, also repairs neighbouring buildings when checking for attached walls.
        repaired_geom = repair_geometry(wall_surface_geometries, roof_surface_geometries, ground_surface_shape, ground_surface_middle)
                    # --- Calculate facade areas by cardinal direction ---

        # Repaired Geometry lead to more issues than it solves, so it is not being used right now (except for triangulating the geometry)
        # wall_surface_geometries = repaired_geom["wall_surface_geometries"]
        # roof_surface_geometries = repaired_geom["roof_surface_geometries"]
        # ground_surface_shape = repaired_geom["ground_surface_shape"]
        triangulated_geom = repaired_geom["triangulation"]
        mesh = repaired_geom["mesh"]

        # Detection of attached houses
        footprints = create_ground_surface_list(xml_root, ns)
        # Pass the original target_building_id (could be single or list)
        current_building_id = building.get("{http://www.opengis.net/gml}id")
        subtracted_walls_result = subtract_attached_walls(wall_surface_geometries, xml_root, ns, coords, current_building_id, footprints)
        wall_geometries_external = subtracted_walls_result["Wall_geometries_external"]
        neighbour_lod2_ids = subtracted_walls_result["neighbour_lod2_ids"] # add neighbouring LOD2 ids, later we may want to visualize these
        neighbour_geometries = subtracted_walls_result["neighbour_geometries"]
        surrounding_buildings_lod2_ids = subtracted_walls_result["surrounding_buildings_lod2_ids"]
        surrounding_buildings_geometries = subtracted_walls_result["surrounding_buildings_geometries"]

        # Calculate facade area for each of the 8 cardinal directions (N, NE, E, SE, S, SW, W, NW)
        if len(mesh.faces) > 0:
            # Calculate face areas and normals for the external walls - as they might not enclose a volume (attached wallls substracted), use the complete mesh as reference volume.
            face_areas, face_normals, total_facade_area = calculate_external_wall_properties(wall_geometries_external, mesh)
            if face_areas.size > 0:
                facade_areas_by_dir, avg_normal_by_direction, geometries_by_direction = facade_areas_by_direction(face_normals, face_areas, wall_geometries_external)
                facade_refpoints = get_middle_points(avg_normal_by_direction, facade_areas_by_dir, ground_surface_middle, mesh.vertices) # reference points for photo markers
            else:
                # Handle case with no external walls
                facade_areas_by_dir = {d: 0.0 for d in ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]}
                avg_normal_by_direction = {d: np.array([0,0,0]) for d in ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]}
                geometries_by_direction = {d: [] for d in ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]}
                facade_refpoints = {}
                print("WARNING: No external wall geometries found or processed.")

        # Return all the results. More results can be enabled again by uncommenting if needed.
        # But take care when enabling more results - names have to match the database or have to be excluded from being uploaded to the database.
        return {
            search_type: search_value,
            "Height_NN": height_ground,
            "coordinates": coords,
            #"Hoehe Dach": height_roof,
            "Eave_height": height_roof_lowerend-height_ground if height_roof_lowerend is not None and height_ground is not None else None, # return 0 if eave height not available
            #"Berechnete Hoehe Gebaeude": calculated_height,
            "Roof_type_nr": roof_type,
            "Roof_type_name": roof_type_name,
            "Roof_pitch_avg": avg_roof_pitch,
            "Height": measured_height,
            "Storeys": storeys,
            "Ground_area": total_ground_surface_area,
            #"Gefundene Grundflächen": ground_surface_count,
            "Ground_area_geometry": ground_surface_shape,
            "Ground_area_middle": ground_surface_middle,
            "Wall_surface_tot": total_facade_area,
            "Roof_area": total_roof_surface_area,
            "Amount_roof_surfaces": roof_surface_count,
            "Roof_geometries": roof_surface_geometries,
            "Wall_geometries": wall_surface_geometries,
            "Wall_geometries_external": wall_geometries_external,
            "Wall_centers": facade_refpoints,
            "Facade_area_N": facade_areas_by_dir["N"],
            "Facade_area_NE": facade_areas_by_dir["NE"],
            "Facade_area_E": facade_areas_by_dir["E"],
            "Facade_area_SE": facade_areas_by_dir["SE"],
            "Facade_area_S": facade_areas_by_dir["S"],
            "Facade_area_SW": facade_areas_by_dir["SW"],
            "Facade_area_W": facade_areas_by_dir["W"],
            "Facade_area_NW": facade_areas_by_dir["NW"],
            "facade_N": geometries_by_direction["N"],
            "facade_NE": geometries_by_direction["NE"],
            "facade_E": geometries_by_direction["E"],
            "facade_SE": geometries_by_direction["SE"],
            "facade_S": geometries_by_direction["S"],
            "facade_SW": geometries_by_direction["SW"],
            "facade_W": geometries_by_direction["W"],
            "facade_NW": geometries_by_direction["NW"],
            "BGF": bgf,
            "Hint": hint,
            "Triangulated_Geometry": triangulated_geom, 
            "Mesh": mesh,
            "neighbour_lod2_ids": neighbour_lod2_ids,
            "neighbour_geometries": neighbour_geometries,
            "surrounding_buildings_lod2_ids": surrounding_buildings_lod2_ids,
            "surrounding_buildings_geometries": surrounding_buildings_geometries
        }

    # First, try searching by building ID(s)
    if building_ids:
        # Find all matching buildings
        matched_buildings = []
        for building in xml_root.findall(".//bldg:Building", ns):
            building_id = building.get("{http://www.opengis.net/gml}id")
            if building_id in building_ids:
                matched_buildings.append(building)
        
        if not matched_buildings:
            return {"Error": "Building(s) not found by ID"}
        
        # If single building, return as before
        if len(matched_buildings) == 1:
            return get_building_data(matched_buildings[0], building_ids[0], "Building ID", roof_numbers)
        
        # Multiple buildings: aggregate data
        aggregated_data = None
        for idx, building in enumerate(matched_buildings):
            building_data = get_building_data(building, building_ids[idx], "Building ID", roof_numbers)
            
            if aggregated_data is None:
                # First building: initialize with its data
                aggregated_data = building_data.copy()
                # Convert single values to lists where appropriate for aggregation
            else:
                # Aggregate geometries (append to lists)
                aggregated_data["Wall_geometries"].extend(building_data["Wall_geometries"])
                aggregated_data["Wall_geometries_external"].extend(building_data["Wall_geometries_external"])
                aggregated_data["Roof_geometries"].extend(building_data["Roof_geometries"])
                aggregated_data["Ground_area_geometry"].extend(building_data["Ground_area_geometry"])
                
                # Extend directional facade geometries
                for direction in ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]:
                    aggregated_data[f"facade_{direction}"].extend(building_data[f"facade_{direction}"])
                
                # Sum up areas
                aggregated_data["Ground_area"] += building_data["Ground_area"]
                aggregated_data["Wall_surface_tot"] += building_data["Wall_surface_tot"]
                aggregated_data["Roof_area"] += building_data["Roof_area"]
                aggregated_data["BGF"] += building_data["BGF"]
                aggregated_data["Amount_roof_surfaces"] += building_data["Amount_roof_surfaces"]
                
                # Sum up directional facade areas
                for direction in ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]:
                    aggregated_data[f"Facade_area_{direction}"] += building_data[f"Facade_area_{direction}"]
                
                # Aggregate neighbor data
                aggregated_data["neighbour_lod2_ids"].extend(building_data["neighbour_lod2_ids"])
                aggregated_data["neighbour_geometries"].extend(building_data["neighbour_geometries"])
                aggregated_data["surrounding_buildings_lod2_ids"].extend(building_data["surrounding_buildings_lod2_ids"])
                aggregated_data["surrounding_buildings_geometries"].extend(building_data["surrounding_buildings_geometries"])
        
        # Update search value to reflect multiple buildings
        aggregated_data["Building ID"] = building_ids
        return aggregated_data

    # If this fails, try searching by address - address is not always given or may be ambiguous, so this is a fallback
    if target_address:
        for building in xml_root.findall(".//bldg:Building", ns):
            address_elem = building.find(".//xAL:ThoroughfareName", ns)
            if address_elem is not None and address_elem.text == target_address:
                print("No building ID identified, found by address")
                return get_building_data(building, target_address, "Address", roof_numbers)

    # If neither is found, return an error message
    return {"Error": "Building not found by Address or ID"}