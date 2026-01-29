# Accesses the pre-downloaded LOD2 files for Bremen
# Bremen only has one big batch download. This, of course, has to be downloaded only once.
# To Do: Have a look every 12 months or so if there is a more recent file available: https://www.metaver.de/trefferanzeige?docuuid=226971C2-6677-4B79-95F3-C5311F1275C8 
# Last version: 01/2026
import os
import time
import requests

def download_LOD2(utm_easting, utm_northing):
    coord1 = int(str(int(utm_easting))[:3])
    coord2 = int(str(int(utm_northing))[:4])
    if coord1 % 2: coord1 -= 1
    if coord2 % 2: coord2 -= 1

    # Build URL
    filename = f"LoD2_32_{coord1}_{coord2}_2_HB.gml"

    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_path  = os.path.join(script_dir, "LOD2", filename)
    
    print("Downloaded:", file_path)

    # Return the path to the .gml file
    return file_path
