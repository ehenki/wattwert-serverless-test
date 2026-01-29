# Handles all database interactions for the aufmass core.
# For a look at the database structure and classes, look at the aufmassClasses.py in the datastructure folder.
import jwt
import json
import os
import mimetypes
from dataclasses import asdict
from typing import Any
from Supabase_database.client import get_user_client
from Supabase_database.handlers import NumpyEncoder
from aufmass_core.datastructure.aufmassClasses import *

def _extract_user_id_insecure(token: str) -> str:
    """
    WARNING: This function extracts the user_id without verifying the signature.
    It should ONLY be used for generating file paths where the actual write operation
    is guarded by RLS policies that verify the token independently.
    NEVER use this ID for authorization checks or database inserts.
    """
    try:
        payload = jwt.decode(token, options={"verify_signature": False})
        user_id = payload.get('sub')
        
        # Fallback to environment variable for Service Role tokens
        if not user_id:
            user_id = os.getenv('SUPABASE_USER_ID')
        
        return user_id
    except Exception as e:
        print(f"Error decoding JWT: {e}")
        # Try environment variable as fallback
        return os.getenv('SUPABASE_USER_ID')

def _insert_aufmass_object(obj: Any, access_token: str = None):
    """
    Required: The object to insert has to have a TABLE_NAME attribute, which is the name of the database table to insert the data into. 
    Fits for all classes in the aufmassClasses.py file (except Gebaeude)
    Generic insert function for aufmass dataclasses.
    Gets the correct database table name from the object and upserts (insert or update) the data into the corresponding table.
    Updates existing records if ID_LOD2 and all '*_id' fields match.
    """
    if not access_token:
        print("WARNING: No access token provided. Operation might fail due to RLS.")
        
    data = asdict(obj)
    # Get table name from the object (and remove it from the data dictionary before uploading)
    table_name = data.pop('TABLE_NAME', None)
    if not table_name:
        print(f"Error: Object {type(obj)} has no TABLE_NAME")
        return

    # We do NOT set user_id manually. The database sets it via 'default auth.uid()'.
    # If the object has a 'user_id' field that is None/Empty, we explicitly remove it 
    # to let the database default take over.
    if 'user_id' in data:
        del data['user_id']
    
    # Identify unique identifiers for this object type. Always include ID_LOD2 and any field ending in '_id' (like facade_id, opening_id, etc.)
    unique_keys = ['ID_LOD2']

    # Include tags in unique keys if present, so different tags create new entries
    if 'tags' in data:
        unique_keys.append('tags')

    for key in data.keys():
        if key.endswith('_id'):
             unique_keys.append(key)

    # Serialize lists/dicts to JSON strings for DB compatibility
    for key, value in data.items():
        if isinstance(value, (list, tuple, dict)):
            # If it's a list of strings (like tags), Supabase expects a PostgreSQL array literal like {item1,item2} or a JSON string if the column is JSONB.
            # Check if this is likely a text array (like tags)
            if isinstance(value, list) and all(isinstance(x, str) for x in value):
                pass
            elif isinstance(value, (dict, list)): # Only dump complex structures or dicts intended for JSONB
                data[key] = json.dumps(value, cls=NumpyEncoder)

    client = get_user_client(access_token)
    try:
        # Build query to check for existing record
        query = client.table(table_name).select("id")
        for key in unique_keys:
            if key in data and data[key] is not None:
                # For tags (array field), use contains instead of eq
                if key == 'tags':
                    query = query.contains(key, data[key])
                else:
                    query = query.eq(key, data[key])
        
        result = query.execute()
        
        if result.data and len(result.data) > 0:
            # Update existing record
            existing_id = result.data[0]['id']
            # We update everything provided except 'id' (which isn't in data anyway)
            client.table(table_name).update(data).eq('id', existing_id).execute()
            print(f"Successfully updated record in {table_name} with id {existing_id}")
        else:
            # Insert new record
            client.table(table_name).insert(data).execute()
            print(f"Successfully inserted into {table_name}")
            
    except Exception as e:
        print(f"Error upserting into {table_name}: {e}")
        raise e  # Re-raise exception to prevent silent failures in the pipeline

def _upload_facade_image(obj: FacadeImage, file_path_or_bytes: str | bytes, access_token: str = None, content_type: str = None):
    """
    Uploads an image to the 'facade_images' bucket and creates a corresponding database entry.
    If storage_path is not set in the FacadeImage object, it will be automatically generated.
    """
    client = get_user_client(access_token)
    
    # If storage_path is not set, generate it
    # We use the insecure extraction ONLY for path generation.
    # Security relies on Storage RLS rejecting the write if the path's user_id doesn't match the token.
    if not obj.storage_path:
        user_id = _extract_user_id_insecure(access_token)
        
        if not user_id:
             # Fallback: If we really can't get it, we can't generate the standard path.
             print("Error: Could not determine user_id for storage path generation")
             return

        # Generate storage path based on tags to differentiate between different processing stages
        tag_suffix = "_".join(obj.tags) if obj.tags else "image"
        obj.storage_path = f"{user_id}/{obj.ID_LOD2}/{obj.facade_id}_{tag_suffix}.jpg"
    
    # Handle file input (path or bytes)
    file_content = None
    # Use provided content_type or default to octet-stream
    final_content_type = content_type or 'application/octet-stream'
    
    if isinstance(file_path_or_bytes, str):
        if not os.path.exists(file_path_or_bytes):
            print(f"Error: File not found at {file_path_or_bytes}")
            return
        if not content_type:
            final_content_type = mimetypes.guess_type(file_path_or_bytes)[0] or 'application/octet-stream'
        with open(file_path_or_bytes, "rb") as f:
            file_content = f.read()
    else:
        file_content = file_path_or_bytes
        # If no content_type provided, try to guess from storage_path
        if not content_type and hasattr(obj, 'storage_path') and obj.storage_path:
             guessed_type = mimetypes.guess_type(obj.storage_path)[0]
             if guessed_type:
                 final_content_type = guessed_type
    
    # Update size_bytes if not set
    if not obj.size_bytes and file_content:
        obj.size_bytes = len(file_content)

    try:
        # Upload to Storage
        client.storage.from_("facade_images").upload(
            file=file_content,
            path=obj.storage_path,
            file_options={"content-type": final_content_type, "upsert": "true"},
        )
        print(f"Successfully uploaded image to storage: {obj.storage_path}")
        
        # Get public URL
        public_url = client.storage.from_("facade_images").get_public_url(obj.storage_path)
        obj.public_url = public_url # Update object with real public URL

        # Insert DB Entry
        _insert_aufmass_object(obj, access_token)
        
    except Exception as e:
        print(f"Error uploading image: {e}")

def _delete_aufmass_object(object_id: str, table_name: str, access_token: str) -> None:
    """
    Deletes an object from the specified table by its ID.
    """
    client = get_user_client(access_token)

    # Bestimmen des Primärschlüssels basierend auf dem Tabellennamen
    id_column = "id" # Default
    if table_name == "facade":
        id_column = "facade_id"
    elif table_name == "facade_image":
        id_column = "image_id"
    elif table_name == "segmentation_mask":
        id_column = "mask_id"
    # Weitere Tabellen hier ergänzen falls nötig

    try:
        response = client.table(table_name).delete().eq(id_column, object_id).execute()
        # print(f"Deleted object {object_id} from {table_name}.")
    except Exception as e:
        print(f"Error deleting from {table_name}: {e}")
