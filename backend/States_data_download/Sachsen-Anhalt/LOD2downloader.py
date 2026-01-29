# Accesses LOD2 files for Sachsen-Anhalt - pre-downloaded into the Sachsen-Anhalt/LOD2 folder
import os
from datetime import datetime

def download_LOD2(utm_easting, utm_northing):
    coord1 = int(str(int(utm_easting))[:3])
    coord2 = int(str(int(utm_northing))[:4])
    if coord1 % 2: coord1 -= 1
    if coord2 % 2: coord2 -= 1

    # Build URL
    filename = f"LoD2_32{coord1}{coord2}.gml"

    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_path  = os.path.join(script_dir, "LOD2", filename)
    
    print("Downloaded:", file_path)

    # Return the path to the .gml file
    return file_path