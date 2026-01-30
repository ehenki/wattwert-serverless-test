from fastapi import FastAPI, File, UploadFile, Form, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx
import os
from Supabase_database.handlers import update_building_data
from aufmass_core.aufmass_main import aufmass_main


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
    title="Backend Geruest API",
    debug=os.getenv('DEBUG', 'False').lower() == 'true'
)

BACKEND_URL = os.getenv('BACKEND_LOD2_URL', 'http://localhost:8000')

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

@app.post("/api/address")
async def process_address(
    request: AddressRequest,
    authorization: str | None = Header(None),
):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing or invalid token")

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{BACKEND_URL}/api/address",
                json=request.model_dump(),
                headers={"Authorization": authorization},
                timeout=60.0
            )
            # Propagate status code and content
            if response.status_code >= 400:
                try:
                    error_detail = response.json().get('detail', response.text)
                except:
                    error_detail = response.text
                raise HTTPException(status_code=response.status_code, detail=error_detail)
            
            return response.json()
        except httpx.RequestError as exc:
             raise HTTPException(status_code=503, detail=f"Backend service unreachable: {exc}")

@app.post("/api/geom-to-threejs")
async def geom_to_threejs(
    ID_LOD2: str,
    authorization: str | None = Header(None),
):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing or invalid token")
        
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{BACKEND_URL}/api/geom-to-threejs",
                params={"ID_LOD2": ID_LOD2},
                headers={"Authorization": authorization},
                timeout=60.0
            )
            if response.status_code != 200:
                try:
                    detail = response.json().get("detail", response.text)
                except:
                    detail = response.text
                raise HTTPException(status_code=response.status_code, detail=detail)
            return response.json()
        except httpx.RequestError as exc:
             raise HTTPException(status_code=503, detail=f"Backend service unreachable: {exc}")

class SegmentationRequest(BaseModel):
    ID_LOD2: str

class AufmassRequest(BaseModel):
    ID_LOD2: str

@app.post("/api/start_aufmass")
async def start_aufmass(
    request: AufmassRequest,
    authorization: str | None = Header(None),
):
    # Ensure caller is authenticated
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Could not start Aufmass: Missing or invalid token")
    access_token = authorization.split(" ", 1)[1]
    aufmass_main(request.ID_LOD2, access_token) # Main module for running the entire Aufmass process
    # aufmass_testmodule(request.ID_LOD2, access_token) # Test module for testing one single module from the aufmass_core package
    return


if __name__ == "__main__": # Start with: uvicorn main:app --reload --port 8003
    import uvicorn
    uvicorn.run(
        "main:app",
        host=os.getenv('HOST', '0.0.0.0'),
        port=int(os.getenv('PORT_GERUEST', 8003)),
        reload=os.getenv('DEBUG', 'False').lower() == 'true'
    )