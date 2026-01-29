from Supabase_database.functions.image_retriever import get_building_images_with_signed_urls
from Supabase_database.handlers import get_building_data
from Supabase_database.functions.image_uploader import upload_image_and_save_to_db
from wattwert_only_mtl.scripts.infer import run_inference_on_image
from Supabase_database.handlers import update_building_data
import os

"""
For early prototype only.
Will be replaced by the new segmentation model.
"""

def get_window_to_wall(image_path: str, number: int, access_token: str, LOD2_ID: str) -> float:
    try:
        result = run_inference_on_image(image_path, number=number)
        print(f"WWR analysis result: {result}")
        
        # Upload prediction images to database if they were generated
        if 'element_prediction_path' in result and 'material_prediction_path' in result:
            try:
                # Upload element prediction image
                elem_upload_result = upload_image_and_save_to_db(
                    file_path=result['element_prediction_path'],
                    title=f"Element prediction, image {number}, ID: {LOD2_ID}",
                    description=f"{number}-el",
                    ID_LOD2=LOD2_ID,
                    tags=["prediction", "element", "ai_generated"],
                    access_token=access_token
                )
                print(f"Uploaded element prediction")
                
                # Upload material prediction image
                mat_upload_result = upload_image_and_save_to_db(
                    file_path=result['material_prediction_path'],
                    title=f"Material prediction, image {number}, ID: {LOD2_ID}",
                    description=f"{number}-mat",
                    ID_LOD2=LOD2_ID,
                    tags=["prediction", "material", "ai_generated"],
                    access_token=access_token
                )
                print(f"Uploaded material prediction")
                
                # Clean up temporary files
                os.unlink(result['element_prediction_path'])
                os.unlink(result['material_prediction_path'])
                print("Cleaned up temporary prediction image files")
                
            except Exception as upload_error:
                print(f"Error uploading prediction images: {upload_error}")
        
        return result['window_to_wall_ratio']
    except Exception as e:
        print(f"Error running inference on {image_path}: {e}")
        return 0.15  # Fallback to default value

def segment_all(LOD2_ID: str, access_token: str) -> dict:
    # Access images from database with user token and LOD2 ID, get their paths and calculate the total window to wall ratio as well as the total wall and window areas
    default_wwr = 0.15
    wall_area_tot = 0
    window_area_tot = 0
    facade_area_tot = 0
    wall_areas = []
    window_areas = []
    
    # Get building data from database to retrieve wall areas
    building_data = get_building_data(LOD2_ID, access_token)
    if not building_data:
        return {
            "error": "Building data not found",
            "window_to_wall_ratio_average": 0, 
            "wall_area_total": 0, 
            "window_area_total": 0,
            "images_processed": 0
        }
    # Extract wall areas from building data
    facade_areas = {
        "facade_area_N": building_data.get("Facade_area_N") or 0,
        "facade_area_NE": building_data.get("Facade_area_NE") or 0,
        "facade_area_E": building_data.get("Facade_area_E") or 0,
        "facade_area_SE": building_data.get("Facade_area_SE") or 0,
        "facade_area_S": building_data.get("Facade_area_S") or 0,
        "facade_area_SW": building_data.get("Facade_area_SW") or 0,
        "facade_area_W": building_data.get("Facade_area_W") or 0,
        "facade_area_NW": building_data.get("Facade_area_NW") or 0
    }
    
    # Get building images with signed URLs for secure access
    image_records = get_building_images_with_signed_urls(
        access_token=access_token, 
        ID_LOD2=LOD2_ID,
        tag="photo", # only get photos, don't accídentally process already processed images
        expires_in=7200  # 2 hours to allow for processing time
    )
    
    # Extract wall area values from the dictionary
    facade_area_values = list(facade_areas.values())
    wwr_values = [default_wwr] * 8  # initialize with default window-to-wall ratio values for 8 facades
    
    for i, image_record in enumerate(image_records):
        if i < len(facade_area_values):
            wall_area = facade_area_values[i]
            # Use signed_url for secure access with proper authentication
            signed_url = image_record.get('signed_url', '')
            if not signed_url:
                print(f"Warning: No signed URL available for image, skipping...")
                continue
            # Last part of the signed url is the file name, which is the image number. Exclude token from URL when getting the number.
            image_nr = signed_url.split('/')[-1].split('.')[0].split('?')[0]
            # if image_nr is not a number (should not happen), give warning and assign i+1
            if not image_nr.isdigit():
                print(f"WARNING: Image number {image_nr} is not a number, assigning {i+1}")
                image_nr = i+1
            print(f"Processing image {image_nr}") 
            image_nr = int(image_nr)
            wwr_values[image_nr-1] = get_window_to_wall(signed_url, image_nr, access_token, LOD2_ID)
    
    for i in range(len(wwr_values)):
        if wwr_values[i] == default_wwr:
            print(f"Could not process Window-to-Wall ratio for wall {i+1}, likely no photo was provided. Using default value.")
        wall_areas.append(facade_area_values[i] * (1 - wwr_values[i]))
        window_areas.append(facade_area_values[i] * wwr_values[i])
        wall_area_tot += wall_areas[i]
        window_area_tot += window_areas[i]
        facade_area_tot += facade_area_values[i]

    avg_window_to_wall_ratio = window_area_tot / facade_area_tot if facade_area_tot > 0 else 0

    update_building_data(LOD2_ID, access_token, {
        "Window_area_N": window_areas[0],
        "Window_area_NE": window_areas[1],
        "Window_area_E": window_areas[2],
        "Window_area_SE": window_areas[3],
        "Window_area_S": window_areas[4],
        "Window_area_SW": window_areas[5],
        "Window_area_W": window_areas[6],
        "Window_area_NW": window_areas[7],
        "Wall_area_N": wall_areas[0],
        "Wall_area_NE": wall_areas[1],
        "Wall_area_E": wall_areas[2],
        "Wall_area_SE": wall_areas[3],
        "Wall_area_S": wall_areas[4],
        "Wall_area_SW": wall_areas[5],
        "Wall_area_W": wall_areas[6],
        "Wall_area_NW": wall_areas[7],
    })
    
    return {
        "window_to_wall_ratio_average": avg_window_to_wall_ratio, 
        "wall_area_total": wall_area_tot, 
        "window_area_total": window_area_tot,
        "images_processed": len(image_records),
        "wall_areas": wall_areas,
        "window_areas": window_areas,
    }

