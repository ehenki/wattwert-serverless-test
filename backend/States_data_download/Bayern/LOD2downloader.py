# Downloads LOD2 file for Bayern
import os
import time
import requests

def download_LOD2(utm_easting, utm_northing):
    coord1 = int(str(int(utm_easting))[:3])
    coord2 = int(str(int(utm_northing))[:4])
    if coord1 % 2: coord1 -= 1
    if coord2 % 2: coord2 -= 1

    # Build URL
    downloadurl = f"https://download1.bayernwolke.de/a/lod2/citygml/{coord1}_{coord2}.gml"
    filename = f"bayern_{coord1}_{coord2}.gml"

    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_path  = os.path.join(script_dir, "LOD2", filename)
    print("URL:", downloadurl, "\nWill save as:", file_path)

    # Re-use if younger than 1 year
    one_year = 365 * 24 * 3600
    if os.path.exists(file_path):
        age = time.time() - os.path.getmtime(file_path)
        if age < one_year:
            print(f"Reusing {filename} (age {age/86400:.1f} days)")
            return file_path
        else:
            print(f"{filename} is older than one year — re-downloading.")

    # Download
    resp = requests.get(downloadurl, stream=True)
    resp.raise_for_status()
    with open(file_path, "wb") as fp:
        for chunk in resp.iter_content(1024):
            fp.write(chunk)
    print("Downloaded:", file_path)

    # Return the path to the .gml file
    return file_path
