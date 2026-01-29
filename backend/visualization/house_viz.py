import numpy as np
from Supabase_database.handlers import get_geom_data


def convert_to_threejs_format(wall_surfaces, roof_surfaces=None, ground_surfaces=None, Points_single=None, Points_multi=None, Points_roof_extrusions=None, 
Extrusion_tops=None, Extrusion_walls=None, Wall_centers=None, neighbour_geometries=None, surrounding_buildings_geometries=None,
facade_N=None, facade_NE=None, facade_E=None, facade_SE=None, facade_S=None, facade_SW=None, facade_W=None, facade_NW=None):
    flipY = -1 # If this is -1, the y-axis is flipped in the three.js visualization, which represents actual geometry
    def convert_vertices_to_xyz(vertices):
        return [{"x": float(v[0]), "y": float(v[1] * flipY), "z": float(v[2])} for v in vertices]

    def convert_points_to_xyz(points):
        if points is None:
            return []
        if isinstance(points, np.ndarray):
            points = points.tolist()
        return [{"x": float(p[0]), "y": float(p[1] * flipY), "z": float(p[2])} for p in points]

    def convert_wall_centers_to_xyz(wall_centers):
        if wall_centers is None:
            return []
        # Handle empty entries in the wall centers by replacing them with dummy value "1,1,1". Should rarely happen if building models are intact.
        return [{"x": float(center[0]), "y": float(center[1] * flipY), "z": float(center[2])} if center is not None and len(center) > 0 else {"x": 1, "y": 1, "z": 1} for center in wall_centers]

    return {
        "walls": [{"vertices": convert_vertices_to_xyz(surface)} for surface in wall_surfaces] if wall_surfaces else [],
        "roofs": [{"vertices": convert_vertices_to_xyz(surface)} for surface in roof_surfaces] if roof_surfaces else [],
        "ground": [{"vertices": convert_vertices_to_xyz(surface)} for surface in ground_surfaces] if ground_surfaces else [],
        "wallCenters": convert_wall_centers_to_xyz(Wall_centers),
        "points": {
            "single": convert_points_to_xyz(Points_single),
            "multi": convert_points_to_xyz(Points_multi),
            "roofExtrusions": [convert_points_to_xyz(cluster) for cluster in Points_roof_extrusions] if Points_roof_extrusions else []
        },
        "extrusions": {
            "tops": [{"vertices": convert_vertices_to_xyz(surface)} for surface in Extrusion_tops] if Extrusion_tops else [],
            "walls": [[{"vertices": convert_vertices_to_xyz(wall)} for wall in element] for element in Extrusion_walls] if Extrusion_walls else []
        },
        "facade_N": [{"vertices": convert_vertices_to_xyz(surface)} for surface in facade_N] if facade_N else [],
        "facade_NE": [{"vertices": convert_vertices_to_xyz(surface)} for surface in facade_NE] if facade_NE else [],
        "facade_E": [{"vertices": convert_vertices_to_xyz(surface)} for surface in facade_E] if facade_E else [],
        "facade_SE": [{"vertices": convert_vertices_to_xyz(surface)} for surface in facade_SE] if facade_SE else [],
        "facade_S": [{"vertices": convert_vertices_to_xyz(surface)} for surface in facade_S] if facade_S else [],
        "facade_SW": [{"vertices": convert_vertices_to_xyz(surface)} for surface in facade_SW] if facade_SW else [],
        "facade_W": [{"vertices": convert_vertices_to_xyz(surface)} for surface in facade_W] if facade_W else [],
        "facade_NW": [{"vertices": convert_vertices_to_xyz(surface)} for surface in facade_NW] if facade_NW else [],
        "neighbours": [{"vertices": convert_vertices_to_xyz(surface)} for building in neighbour_geometries for surface in building] if neighbour_geometries else [],
        "surroundingBuildings": [{"vertices": convert_vertices_to_xyz(surface)} for building in surrounding_buildings_geometries for surface in building] if surrounding_buildings_geometries else []
    }

def convert_to_threejs_from_database(ID_LOD2, access_token):
    geom_data = get_geom_data(ID_LOD2, access_token)

    # Helper function to safely parse geometry data
    def parse_geometry_data(data):
        if data is None:
            return []
        if isinstance(data, str):
            try:
                import ast
                parsed = ast.literal_eval(data)
                # Handle nested structures - if it's a string that was parsed but still contains strings, parse again
                if isinstance(parsed, list) and len(parsed) > 0:
                    if isinstance(parsed[0], str):
                        # Try parsing each string element
                        result = []
                        for item in parsed:
                            if isinstance(item, str):
                                try:
                                    result.append(ast.literal_eval(item))
                                except:
                                    try:
                                        import json
                                        result.append(json.loads(item))
                                    except:
                                        result.append(item)
                            else:
                                result.append(item)
                        return result
                return parsed
            except:
                try:
                    import json
                    return json.loads(data)
                except:
                    return []
        return data

    wall_surfaces = parse_geometry_data(geom_data.get("Wall_geometries_external", [])) # Do not use the original Wall_geometries, use the external ones instead for visualization
    roof_surfaces = parse_geometry_data(geom_data.get("Roof_geometries", []))
    ground_surfaces = parse_geometry_data(geom_data.get("Ground_area_geometry", []))
    Points_single = parse_geometry_data(geom_data.get("Points_single", []))
    Points_multi = parse_geometry_data(geom_data.get("Points_multi", []))
    Points_roof_extrusions = parse_geometry_data(geom_data.get("Points_roof_extrusions", []))
    Extrusion_tops = parse_geometry_data(geom_data.get("Extrusion_tops", []))
    Extrusion_walls = parse_geometry_data(geom_data.get("Extrusion_walls", []))
    Wall_centers = parse_geometry_data(geom_data.get("Wall_centers", []))
    neighbour_geometries = parse_geometry_data(geom_data.get("neighbour_geometries", []))
    surrounding_buildings_geometries = parse_geometry_data(geom_data.get("surrounding_buildings_geometries", []))
    facade_N = parse_geometry_data(geom_data.get("facade_N", []))
    facade_NE = parse_geometry_data(geom_data.get("facade_NE", []))
    facade_E = parse_geometry_data(geom_data.get("facade_E", []))
    facade_SE = parse_geometry_data(geom_data.get("facade_SE", []))
    facade_S = parse_geometry_data(geom_data.get("facade_S", []))
    facade_SW = parse_geometry_data(geom_data.get("facade_SW", []))
    facade_W = parse_geometry_data(geom_data.get("facade_W", []))
    facade_NW = parse_geometry_data(geom_data.get("facade_NW", []))

    # Additional validation and cleanup
    def validate_geometry_list(data):
        if not isinstance(data, list):
            return []
        return data

    wall_surfaces = validate_geometry_list(wall_surfaces)
    roof_surfaces = validate_geometry_list(roof_surfaces)
    ground_surfaces = validate_geometry_list(ground_surfaces)
    Points_single = validate_geometry_list(Points_single)
    Points_multi = validate_geometry_list(Points_multi)
    Points_roof_extrusions = validate_geometry_list(Points_roof_extrusions)
    Extrusion_tops = validate_geometry_list(Extrusion_tops)
    Extrusion_walls = validate_geometry_list(Extrusion_walls)
    Wall_centers = validate_geometry_list(Wall_centers)
    neighbour_geometries = validate_geometry_list(neighbour_geometries)
    surrounding_buildings_geometries = validate_geometry_list(surrounding_buildings_geometries)
    facade_N = validate_geometry_list(facade_N)
    facade_NE = validate_geometry_list(facade_NE)
    facade_E = validate_geometry_list(facade_E)
    facade_SE = validate_geometry_list(facade_SE)
    facade_S = validate_geometry_list(facade_S)
    facade_SW = validate_geometry_list(facade_SW)
    facade_W = validate_geometry_list(facade_W)
    facade_NW = validate_geometry_list(facade_NW)

    return convert_to_threejs_format(wall_surfaces, roof_surfaces, ground_surfaces, Points_single, Points_multi, Points_roof_extrusions, 
    Extrusion_tops, Extrusion_walls, Wall_centers, neighbour_geometries, surrounding_buildings_geometries, facade_N, facade_NE, facade_E, facade_SE, facade_S, facade_SW, facade_W, facade_NW)