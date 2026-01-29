# Downloads LOD2 file for Hessen - right now the entire dataset has to be pre-downloaded into the Hessen/LOD2 folder - this function only accesses the files.
import os
import requests
from datetime import datetime

def download_LOD2(utm_easting, utm_northing):
    coord1 = int(str(int(utm_easting))[:3])
    coord2 = int(str(int(utm_northing))[:4])

    # Build URL
    filename = f"LOD2_{coord1}_{coord2}.gml"

    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_path  = os.path.join(script_dir, "LOD2", filename)
    
    print("Downloaded:", file_path)

    # Return the path to the .gml file
    return file_path