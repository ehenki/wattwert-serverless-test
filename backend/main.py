from fastapi import FastAPI, File, UploadFile, Form, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from handling import start_process
from visualization.house_viz import convert_to_threejs_format, convert_to_threejs_from_database
import os
from supabase import create_client, Client
from datetime import datetime
from Supabase_database.handlers import insert_LOD2_data, insert_geom_data
from helpers.addressf import get_coords
from Supabase_database.functions.image_uploader import upload_image_and_save_to_db
from Supabase_database.handlers import get_user_client
from Supabase_database.handlers import update_building_data


try:
    from dotenv import load_dotenv
except ImportError:
    # Fallback if dotenv is not installed
    def load_dotenv(*args, **kwargs) -> bool:
        print("Warning: python-dotenv not installed. Using default values.")
        return False

# Load environment variables
load_dotenv()

app = FastAPI(
    title="LOD2 Laser States API",
    debug=os.getenv('DEBUG', 'False').lower() == 'true'
)

# Add CORS middleware
# Allow both localhost and 127.0.0.1 for development
default_origins = ['http://localhost:3000', 'http://127.0.0.1:3000']
allowed_origins = os.getenv('ALLOWED_ORIGINS', ','.join(default_origins)).split(',')
# Remove empty strings from split
allowed_origins = [origin.strip() for origin in allowed_origins if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok"}

class AddressRequest(BaseModel):
    street: str
    number: str
    city: str
    state: str
    country: str
    useLaserData: bool = False
    clickedCoordinates: list[float] | None = None  # [longitude, latitude]
    ID_LOD2_list: list[str] | None = None

def return_address(street: str, number: str, city: str, state: str, country: str, use_laser: bool, clicked_coords: list[float] | None = None, ID_LOD2_list: list[str] | None = None):
    # Pass clicked coordinates to start_process
    if clicked_coords:
        result = start_process(clicked_coords, street, number, city, state, country, use_laser, ID_LOD2_list)
    else:
        # Get coordinates from address if not clicked
        coords = get_coords(state, f"{street} {number}, {city}, {country}")
        if coords:
            result = start_process([coords[0], coords[1]], street, number, city, state, country, use_laser, ID_LOD2_list)
        else:
            return None
    return result

@app.post("/api/address")
async def process_address(
    request: AddressRequest,
    authorization: str | None = Header(None),
):
    """Process an address lookup and persist the resulting building row.

    The caller **must** include an ``Authorization: Bearer <token>`` header so
    that the insert runs under that user's privileges (RLS enforced).
    """

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")

    access_token = authorization.split(" ", 1)[1]

    result = return_address(
        request.street,
        request.number,
        request.city,
        request.state,
        request.country,
        request.useLaserData,
        request.clickedCoordinates,
        request.ID_LOD2_list
    )

    if result:
        # Insert data with user-scoped privileges
        insert_LOD2_data(result, access_token)
        geom_data = {
            "ID_LOD2": result["ID_LOD2"],
            "Wall_geometries": result["Wall_geometries"],
            "Wall_geometries_external": result["Wall_geometries_external"],
            "Roof_geometries": result["Roof_geometries"],
            "Ground_area_geometry": result["Ground_area_geometry"],
            "Ground_area_middle": result["Ground_area_middle"],
            "Wall_centers": result["Wall_centers"],
            "facade_N": result["facade_N"],
            "facade_NE": result["facade_NE"],
            "facade_E": result["facade_E"],
            "facade_SE": result["facade_SE"],
            "facade_S": result["facade_S"],
            "facade_SW": result["facade_SW"],
            "facade_W": result["facade_W"],
            "facade_NW": result["facade_NW"],
            "Extrusion_tops": result["Extrusion_tops"],
            "Extrusion_walls": result["Extrusion_walls"],
            "Points_single": result["Points_single"],
            "Points_multi": result["Points_multi"],
            "Points_roof_extrusions": result["Points_roof_extrusions"],
            "neighbour_geometries": result["neighbour_geometries"],
            "neighbour_lod2_ids": result["neighbour_lod2_ids"],
            "surrounding_buildings_geometries": result["surrounding_buildings_geometries"],
            "surrounding_buildings_lod2_ids": result["surrounding_buildings_lod2_ids"]
        }
        # Insert geometry data into database, will later be read using the api/geom-to-threejs route from the frontend
        insert_geom_data(geom_data, access_token)
    
    if result is not None:
        return {
            "message": result["Display_text"],
            "ID_LOD2": result["ID_LOD2"],
        }
    else:
        return {
            "message": "No result found",
            "ID_LOD2": None,
        }

# This function gets the geometry from the database & converts it to ThreeJS format, then delivers it back to the frontend
# Why is this happening in the backend? More possibilities for correcting the geometry, easier processing overall with python, make frontend lighter & simpler
@app.post("/api/geom-to-threejs")
async def geom_to_threejs(
    ID_LOD2: str,
    authorization: str | None = Header(None),
):
    # Ensure caller is authenticated
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    access_token = authorization.split(" ", 1)[1]
    return convert_to_threejs_from_database(ID_LOD2, access_token)

@app.post("/api/buildingdetails")
async def buildingdetails(
    data:dict,
    authorization: str | None = Header(None),
):
    # Ensure caller is authenticated
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid token")
    access_token = authorization.split(" ", 1)[1]
    ID_LOD2 = data["ID_LOD2"]
    update_building_data(ID_LOD2, access_token, data)
    return

if __name__ == "__main__": # Start with uvicorn main:app --reload
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv('HOST', '0.0.0.0'),
        port=int(os.getenv('PORT', 8000)),
        reload=os.getenv('DEBUG', 'False').lower() == 'true'
    )