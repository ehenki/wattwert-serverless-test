import os
import mimetypes
from PIL import Image  # pip install pillow
import supabase
from dotenv import load_dotenv
import jwt
from ..client import get_user_client
from aufmass_core.datastructure.aufmassClasses import Facade, FacadeImage
from aufmass_core.database_upload_functions import _insert_aufmass_object, _upload_facade_image

# Obtain a per-call client inside the function

def get_image_dimensions(file_path):
    """Get the width and height of an image"""
    try:
        with Image.open(file_path) as img:
            return img.width, img.height
    except Exception as e:
        print(f"Error getting image dimensions: {e}")
        return None, None

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
        return user_id
    except Exception as e:
        print(f"Error decoding JWT: {e}")
        return None

def upload_image_and_save_to_db(
    file_path,
    title=None,
    description=None,
    ID_LOD2=None,
    tags=None,
    location=None,
    *,
    access_token: str,
):
    """
    Upload an image to Supabase Storage and save metadata to the database
    
    Args:
        file_path (str): Path to the local image file
        title (str, optional): Title for the image
        description (str, optional): Description of the image
        ID_LOD2 (str, optional): ID of the building this image belongs to
        tags (list, optional): List of tags for the image
        location (tuple, optional): Geographic coordinates (x, y)
        access_token (str, optional): User's access token for authentication
        
    Returns:
        dict: Response containing database record and storage info
    """
    if not access_token:
        raise ValueError("access_token is required")
    supabase_client = get_user_client(access_token)

    # We extract user_id insecurely ONLY for path generation.
    # The actual upload is protected by Storage RLS which verifies the token.
    user_id = _extract_user_id_insecure(access_token)
    
    if not user_id:
        raise ValueError("Could not determine user ID for path generation")

    # Get the filename from the path
    filename = os.path.basename(file_path)
    
    # Generate a storage path with ID_LOD2 if available. Uses description (= Image number) as filename. 
    # Falls back to filename if ID_LOD2 is not available (should not happen). However, the user would not be able to find it again in this case.
    storage_path = f"{user_id}/{ID_LOD2}/{description}" if ID_LOD2 else filename
    

    # Get file size
    file_size = os.path.getsize(file_path)
    # Set file size limit to 100MB
    if file_size > 100 * 1024 * 1024:
        raise ValueError("File size exceeds 100MB limit")
    
    # Limit to image file types
    if not file_path.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.tiff', '.tif', '.pdf')):
        raise ValueError("File is not an image")
    
    # Get content type
    content_type = mimetypes.guess_type(file_path)[0] or 'application/octet-stream'
    
    # Get image dimensions
    width, height = get_image_dimensions(file_path)
    
    # -------------------------------------------------------------------
    # Select Supabase client (user-scoped preferred)
    # -------------------------------------------------------------------
    if not access_token:
        raise ValueError("access_token is required")
    supabase_client = get_user_client(access_token)

    # Open the file in binary mode and upload
    with open(file_path, "rb") as f:
        file_content_memory = f.read()

    try:
        # Upload to the buildingimages1 bucket
        upload_response = (
            supabase_client.storage
            .from_("buildingimages1")
            .upload(
                file=file_content_memory,
                path=storage_path,
                file_options={"content-type": content_type, "upsert": "true"},
            )
        )
        print(f"Upload successful: {upload_response}")

        # Upload to facade_images bucket and create DB entries if ID_LOD2 and description (facade_id) are present
        if ID_LOD2 and description:
            try:
                facade_id = description
                facade_storage_path = f"{user_id}/{ID_LOD2}/{facade_id}"
                
                # Create FacadeImage object
                # Note: public_url is initially placeholder, will be updated by upload_image function
                facade_image_obj = FacadeImage(
                    title=title or os.path.splitext(filename)[0],
                    ID_LOD2=ID_LOD2,
                    facade_id=facade_id,
                    storage_path=facade_storage_path,
                    public_url="", 
                    size_bytes=file_size,
                    width=width,
                    height=height,
                    tags=tags or ["photo"]
                )
                
                # Use the new upload_image function from database_functions.py
                # Pass the in-memory content we read earlier and the content type we determined
                _upload_facade_image(facade_image_obj, file_content_memory, access_token, content_type=content_type)
                
                # Insert into facade table
                facade_obj = Facade(
                    ID_LOD2=ID_LOD2,
                    facade_id=facade_id
                )
                _insert_aufmass_object(facade_obj, access_token)

            except Exception as e:
                print(f"Error handling facade upload/db insertion: {e}")

    except Exception as e:
        print(f"Storage upload error: {str(e)}")
        raise Exception(f"Failed to upload file to storage: {str(e)}")
    
    try:
        # Get the public URL
        public_url = (
            supabase_client.storage.from_("buildingimages1").get_public_url(storage_path)
        )
    except Exception as e:
        print(f"Error getting public URL: {str(e)}")
        raise Exception(f"Failed to get public URL: {str(e)}")
    
    # Prepare database record
    image_data = {
        "title": title or os.path.splitext(filename)[0],
        "description": description,
        "ID_LOD2": ID_LOD2,
        "storage_path": storage_path,
        "public_url": public_url,
        "content_type": content_type,
        "size_bytes": file_size,
        "width": width,
        "height": height,
        "tags": tags
        # "user_id": user_id  <-- Removed manual user_id assignment. Let the DB default handle it.
    }
    
    # Add location if provided
    if location and len(location) == 2:
        image_data["location"] = f"({location[0]},{location[1]})"
    
    # Check if an entry with the same description and ID_LOD2 already exists
    existing_record = None
    if ID_LOD2 and description:
        try:
            existing_response = (
                supabase_client.table("building_images")
                .select("*")
                .eq("ID_LOD2", ID_LOD2)
                .eq("description", description)
                .execute()
            )
            
            if existing_response.data and len(existing_response.data) > 0:
                existing_record = existing_response.data[0]
                print(f"Found existing record with ID: {existing_record.get('id')}")
        except Exception as e:
            print(f"Error checking for existing record: {e}")
    
    # If existing record found, update it; otherwise insert new record
    if existing_record:
        try:
            # Remove the id field if it exists to avoid conflicts
            if 'id' in image_data:
                del image_data['id']
            
            db_response = (
                supabase_client.table("building_images")
                .update(image_data)
                .eq("id", existing_record["id"])  # type: ignore[index]
                .execute()
            )
            print(f"Updated existing record with ID: {existing_record['id']}")
        except Exception as e:
            print(f"Error updating existing record: {e}")
            return {
                "storage": {"path": storage_path, "public_url": public_url},
                "database_error": f"Failed to update existing record: {e}"
            }
    else:
        # Insert new record
        try:
            db_response = (
                supabase_client.table("building_images").insert(image_data).execute()
            )
            print("Inserted new record")
        except Exception as e:
            print(f"Error inserting new record: {e}")
            return {
                "storage": {"path": storage_path, "public_url": public_url},
                "database_error": f"Failed to insert new record: {e}"
            }
    
    # Check for database errors
    if not db_response.data:
        print(f"Error saving to database: No data returned")
        return {
            "storage": {"path": storage_path, "public_url": public_url},
            "database_error": "No data returned from database"
        }
    
    return {
        "storage": {"path": storage_path, "public_url": public_url},
        "database": db_response.data
    }

# Example usage
if __name__ == "__main__":
    # This is just example code - you would need a real access token to run it
    example_access_token = "your-access-token-here"  # Replace with actual token
    
    # Upload a single image with metadata
    result = upload_image_and_save_to_db(
        file_path="path/to/your/image.jpg",
        title="North Tower",
        description="North view of the main building",
        ID_LOD2="building-123",
        tags=["exterior", "north-facing", "tower"],
        location=(40.7128, -74.0060),  # Example coordinates
        access_token=example_access_token
    )
    
    if result:
        print(f"Image uploaded and saved to database: {result}")
    
    # Batch upload example
    def process_building_images(ID_LOD2, directory_path, base_description="", access_token=None):
        """Process all images for a specific building"""
        if not access_token:
            raise ValueError("access_token is required")
            
        results = []
        for filename in os.listdir(directory_path):
            if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
                file_path = os.path.join(directory_path, filename)
                title = os.path.splitext(filename)[0].replace("_", " ").title()
                
                result = upload_image_and_save_to_db(
                    file_path=file_path,
                    title=title,
                    description=f"{base_description} - {title}",
                    ID_LOD2=ID_LOD2,
                    tags=["building", ID_LOD2],
                    access_token=access_token
                )
                
                if result:
                    results.append(result)
        
        return results