# Downloads LOD2 file for SchleswigHolstein
import os
import time
import requests


def download_LOD2(utm_easting, utm_northing):
    coord1 = int(str(int(utm_easting))[:3])
    coord2 = int(str(int(utm_northing))[:4])

    coord1Round = int((coord1) // 10 * 10)
    coord2Round = int((coord2) // 10 * 10)

    # Build URL
    downloadurl = f"https://geodaten.schleswig-holstein.de/gaialight-sh/_apps/dladownload/massen.php?file=LoD2_32_{coord1}_{coord2}_1_SH.xml&id=4&live=2024&km=32{coord1Round}_{coord2Round}"
    filename = f"SchleswigHolstein_{coord1}_{coord2}.xml"

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

    # Return the path to the .xml file
    return file_path
