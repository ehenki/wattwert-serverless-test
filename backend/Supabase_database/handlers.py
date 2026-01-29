import jwt
import json
import numpy as np
from typing import Dict, List, Any, Optional
from datetime import datetime

from .client import get_user_client

class NumpyEncoder(json.JSONEncoder):
    """ Special json encoder for numpy types """
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        return json.JSONEncoder.default(self, obj)

# ---------------------------------------------------------------------------
# User-token functions (RLS enforced)
# ---------------------------------------------------------------------------

def get_building_data(ID_LOD2: str, access_token: str):
    """Get building data from table buildings_data by ID_LOD2 using the caller's JWT so RLS applies."""
    user_supabase = get_user_client(access_token)
    
    # We do not need to manually filter by user_id here because RLS on the database
    # will automatically filter results to only those owned by the authenticated user.
    # The 'using (user_id = auth.uid())' policy handles this securely.
    
    try:
        response = user_supabase.table("buildings_data").select("*").eq("ID_LOD2", ID_LOD2).execute()
        
        if response.data and len(response.data) > 0:
            return response.data[0]  # Return the first matching record
        else:
            # Note: This might mean the record doesn't exist OR the user doesn't have permission
            print(f"No building data found for ID_LOD2: {ID_LOD2}")
            return None
    except Exception as e:
        print(f"Error retrieving building data: {e}")
        return None

def insert_address(address_data: dict, access_token: str):
    """Insert an address row using the caller's JWT so RLS applies."""
    user_supabase = get_user_client(access_token)
    try:
        user_supabase.table("buildings_data").insert(address_data).execute()
    except Exception as e:
        print(f"Error inserting address into buildings_data: {e}")

def update_building_data(LOD2_ID: str, access_token: str, data:dict):
    # Insert data into existing row in buildings_data table. Row is uniquely identified by ID_LOD2.
    user_supabase = get_user_client(access_token)
    try:
        user_supabase.table("buildings_data").update(data).eq("ID_LOD2", LOD2_ID).execute()
        print(f"Building data successfully updated in database")
    except Exception as e:
        print(f"Error inserting data into buildings_data: {e}")

def insert_LOD2_data(LOD2_data: dict, access_token: str):
    """Insert or update cleaned LOD2 data under the privileges of the end-user."""
    # Get user info from the JWT to set ownership
    user_supabase = get_user_client(access_token)

    # Exclude everything not needed by the frontend (and therefore not accepted by the database), such as visualization data, which is uploaded to another table
    excluded_keys = {
        "coordinates",
        "Building ID",
        "Ground_area_middle",
        "Address",
        "Display_text",
        "Wall_geometries",
        "Wall_geometries_external",
        "facade_N",
        "facade_NE",
        "facade_E",
        "facade_SE",
        "facade_S",
        "facade_SW",
        "facade_W",
        "facade_NW",
        "Roof_geometries",
        "Ground_area_geometry",
        "Amount_roof_surfaces",
        "Height_NN",
        "Hint",
        "Extrusion_tops",
        "Extrusion_walls",
        "Points_single",
        "Points_multi",
        "Points_roof_extrusions",
        "Wall_centers",
        "Facade_area_centers",
        "Facade_area_tot",
        "Triangulated_Geometry",
        "Mesh",
        "neighbour_geometries",
        "surrounding_buildings_geometries",
        "surrounding_buildings_lod2_ids",
    }

    cleaned = {k: v for k, v in LOD2_data.items() if k not in excluded_keys}

    # We do NOT manually decode the JWT or set user_id here.
    # The database has 'user_id' set to 'default auth.uid()', so it will automatically
    # grab the user ID from the authenticated session (via the access_token).
    
    try:
        # Check if record already exists for this ID_LOD2
        response = user_supabase.table("buildings_data").select("ID_LOD2").eq("ID_LOD2", cleaned.get("ID_LOD2")).execute()

        if response.data and len(response.data) > 0:
            # Record exists, update it
            user_supabase.table("buildings_data").update(cleaned).eq("ID_LOD2", cleaned.get("ID_LOD2")).execute()
            print(f"LOD2 data successfully updated in database")
        else:
            # Record doesn't exist, insert it
            user_supabase.table("buildings_data").insert(cleaned).execute()
            print(f"LOD2 data successfully inserted to database")
    except Exception as e:
        print(f"Error upserting LOD2 data into buildings_data: {e}")

def insert_geom_data(geom_data: dict, access_token: str):
    # Insert or update geometry data - this function also turns lists and arrays into json data to be properly stored in the database
    # The input dict geom_data has to contain the ID_LOD2 of the building as a key
    user_supabase = get_user_client(access_token)
    # Convert all numpy types (arrays, floats, ints) to native Python types 
    # by round-tripping through JSON. We use json.loads() to get back Python objects
    # (dicts, lists) so that the Supabase client deals with them as JSON objects/arrays, not as stringified JSON.
    insert_data = json.loads(json.dumps(geom_data, cls=NumpyEncoder))

    try:
        # Check if record already exists for this ID_LOD2
        response = user_supabase.table("buildings_geometry").select("ID_LOD2").eq("ID_LOD2", insert_data.get("ID_LOD2")).execute()

        if response.data and len(response.data) > 0:
            # Record exists, update it
            user_supabase.table("buildings_geometry").update(insert_data).eq("ID_LOD2", insert_data.get("ID_LOD2")).execute()
            print(f"Geometry data successfully updated in database")
        else:
            # Record doesn't exist, insert it
            user_supabase.table("buildings_geometry").insert(insert_data).execute()
            print(f"Geometry data successfully inserted to database")
    except Exception as e:
        print(f"Error upserting geometry data into buildings_geometry: {e}")
    

def get_geom_data(ID_LOD2: str, access_token: str):
    """Get geometry data from table buildings_geometry by ID_LOD2 using the caller's JWT so RLS applies."""
    user_supabase = get_user_client(access_token)
    try:
        response = user_supabase.table("buildings_geometry").select("*").eq("ID_LOD2", ID_LOD2).execute()
        return response.data[0]
    except Exception as e:
        print(f"Error retrieving geometry data: {e}")
        return None