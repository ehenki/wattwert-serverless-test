import supabase
from ..client import get_user_client

# -------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------

def get_building_images(
    *,
    access_token: str,
    ID_LOD2: str | None = None,
    tag: str | None = None,
    limit: int = 20,
):
    """
    Get images from the database with optional filtering
    
    Args:
        access_token (str): JWT obtained from the frontend (`supabase.auth.getSession()`).
        ID_LOD2 (str, optional): Filter by building ID
        tag (str, optional): Filter by tag
        limit (int, optional): Maximum number of results to return
        
    Returns:
        list: List of image records
    """
    if access_token:
        supabase_client = get_user_client(access_token)
    else:
        raise ValueError("Access token is required to access images!")

    query = supabase_client.table("building_images").select("*")
    
    # Apply filters if provided
    if ID_LOD2:
        query = query.eq("ID_LOD2", ID_LOD2)
    
    if tag:
        # Filter for records where the tags array contains the specified tag
        query = query.contains("tags", [tag])
    
    # Order by creation date (newest first) and limit results
    response = (
        query.order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    
    if hasattr(response, 'error') and response.error:
        print(f"Error querying database: {response.error}") 
        return []
    
    return response.data

def get_building_images_with_signed_urls(
    *,
    access_token: str,
    ID_LOD2: str | None = None,
    tag: str | None = None,
    limit: int = 20,
    expires_in: int = 3600  # URL expires in 1 hour by default
):
    """
    Get images from the database with signed URLs for direct access
    
    Args:
        access_token (str): JWT obtained from the frontend (`supabase.auth.getSession()`).
        ID_LOD2 (str, optional): Filter by building ID
        tag (str, optional): Filter by tag
        limit (int, optional): Maximum number of results to return
        expires_in (int, optional): URL expiration time in seconds
        
    Returns:
        list: List of image records with signed URLs
    """
    if access_token:
        supabase_client = get_user_client(access_token)
    else:
        raise ValueError("Access token is required to access images!")

    # Get the image records first, filter by tag
    image_records = get_building_images(
        access_token=access_token,
        ID_LOD2=ID_LOD2,
        tag=tag,
        limit=limit
    )
    
    # Generate signed URLs for each image
    for record in image_records:
        storage_path = record.get('storage_path')
        if storage_path:
            try:
                # Generate a signed URL for the image
                signed_url_response = supabase_client.storage.from_('buildingimages1').create_signed_url(
                    storage_path, 
                    expires_in
                )
                
                if signed_url_response and 'signedURL' in signed_url_response:
                    record['signed_url'] = signed_url_response['signedURL']
                    print(f"Generated signed URL for {storage_path}")
                else:
                    print(f"Failed to generate signed URL for {storage_path}")
                    record['signed_url'] = None
                    
            except Exception as e:
                print(f"Error generating signed URL for {storage_path}: {e}")
                record['signed_url'] = None
    
    return image_records

# -------------------------------------------------------------------
# Example usage (requires a valid JWT) – for manual testing only
# -------------------------------------------------------------------

if __name__ == "__main__":
    import os, json

    token = os.getenv("SUPABASE_TEST_JWT")
    if not token:
        raise RuntimeError("Set SUPABASE_TEST_JWT env var to test this script.")

    # Get all images for a specific building
    building_images = get_building_images(access_token=token, ID_LOD2="building-123")
    print(json.dumps(building_images, indent=2))