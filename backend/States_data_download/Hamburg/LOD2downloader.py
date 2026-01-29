# Downloads LOD2 file for Hamburg
# This takes a while, as, unlike the other states, Hamburg only has one big batch download. This, of course, has to be downloaded only once.
# To Do: Have a look every 12 months or so if there is a more recent file available: https://metaver.de/trefferanzeige?docuuid=2C1F2EEC-CF9F-4D8B-ACAC-79D8C1334D5E#detail_links
# Last version: 2023
import os
import time
import requests

def download_LOD2(utm_easting, utm_northing):
    coord1 = int(str(int(utm_easting))[:3])
    coord2 = int(str(int(utm_northing))[:4])

    # Build URL
    filename = f"LoD2_32_{coord1}_{coord2}_1_HH.xml"

    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_path  = os.path.join(script_dir, "LOD2", filename)
    
    print("Downloaded:", file_path)

    # Return the path to the .gml file
    return file_path
