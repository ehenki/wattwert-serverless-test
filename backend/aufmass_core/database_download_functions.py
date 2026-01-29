import json
import os
import mimetypes
from dataclasses import asdict
from typing import Any
from Supabase_database.client import get_user_client
from Supabase_database.handlers import NumpyEncoder
from aufmass_core.datastructure.aufmassClasses import *

def _get_aufmass_objects(ID_LOD2: str, table_name: str, ids: dict = None, tags: list = None, access_token: str = None) -> list[Any]:
    """
    Function to retrieve aufmass objects from the database.
    
    Args:
        ID_LOD2: str
        table_name: str
        ids: dict (optional) - specific IDs to filter by (e.g., {'facade_id': '1'})
        tags: list (optional) - filter by tags (must contain all provided tags)
        access_token: str
    Returns:
        list[dict] - List of database records matching the criteria
    """
    # We rely on RLS to filter by user_id, so we don't need to manually extract it.
    if not access_token:
        print("Error: No access token provided")
        return []

    client = get_user_client(access_token)
    
    try:
        # Build query - Removed .eq("user_id", user_id) as RLS handles this
        query = client.table(table_name).select("*").eq("ID_LOD2", ID_LOD2)
        
        # Apply optional ID filters
        if ids:
            for key, value in ids.items():
                if value is not None:
                    query = query.eq(key, value)
        
        # Apply optional tags filter
        if tags and len(tags) > 0:
            query = query.contains("tags", tags)
        
        response = query.execute()
        return response.data if response.data else []
        
    except Exception as e:
        print(f"Error retrieving objects from {table_name}: {e}")
        return []

def _get_facade_image(ID_LOD2: str, facade_id: str, tags: list, access_token: str) -> dict | None:
    """
    Retrieves the image referenced in the facade_image table with matching ID_LOD2, facade_id and tags.
    Returns the first match or None if not found.
    """
    ids = {"facade_id": facade_id}
    results = _get_aufmass_objects(ID_LOD2, "facade_image", ids=ids, tags=tags, access_token=access_token)
    
    if not results or len(results) == 0:
        return None
    
    image_dict = results[0]
    
    # Download the image from storage using authenticated client
    storage_path = image_dict.get('storage_path')
    if not storage_path:
        raise ValueError(f"No storage path found for image {image_dict.get('id')}")
    try:
        client = get_user_client(access_token)
        image_content = client.storage.from_("facade_images").download(storage_path)
        return image_content
    except Exception as e:
        print(f"Error downloading image from {storage_path}: {e}")
        return None
