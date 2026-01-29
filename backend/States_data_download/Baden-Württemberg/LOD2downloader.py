import os
import time
import requests
import zipfile

def download_LOD2(utm_easting, utm_northing):
    # 1) Compute the grid coordinates (rounded to even)
    coord1 = int(str(int(utm_easting))[:3])
    coord2 = int(str(int(utm_northing))[:4])
    coord1_uneven = coord1
    coord2_even = coord2
    if not coord1 % 2: coord1_uneven = coord1-1
    if coord2 % 2: coord2_even = coord2-1

    # 2) Build BW-specific download URL and filename
    downloadurl = (
        "https://opengeodata.lgl-bw.de/data/lod2/"
        f"LoD2_32_{coord1_uneven}_{coord2_even}_2_bw.zip"
    )
    filename = f"badenwuerttemberg_{coord1_uneven}_{coord2_even}.zip"

    # 3) File path inside LOD2 folder next to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    zipfile_path  = os.path.join(script_dir, "LOD2", filename)
    LOD2_path  = os.path.join(script_dir, "LOD2")
    print("URL:", downloadurl, "\nWill save as:", zipfile_path)

    # 4) Re-use if file is less than 1 year old
    one_year = 365 * 24 * 3600
    if os.path.exists(zipfile_path):
        age = time.time() - os.path.getmtime(zipfile_path)
        if age < one_year:
            print(f"Reusing {filename} (age {age/86400:.1f} days)")
            return _unpack_bw_gml(zipfile_path, LOD2_path, coord1, coord2)
        else:
            print(f"{filename} is older than one year—re-downloading.")

    # 5) Download
    os.makedirs(os.path.dirname(zipfile_path), exist_ok=True)
    resp = requests.get(downloadurl, stream=True)
    resp.raise_for_status()
    with open(zipfile_path, "wb") as fp:
        for chunk in resp.iter_content(1024):
            fp.write(chunk)
    print("Downloaded:", zipfile_path)

    # 6) Extract and return path to .gml
    return _unpack_bw_gml(zipfile_path, LOD2_path, coord1, coord2)

def _unpack_bw_gml(zip_path, out_dir, coord1, coord2):
    """Extract only the .gml with the exact expected name from a Baden-Württemberg ZIP archive."""
    expected_name = f"LoD2_32_{coord1}_{coord2}_1_BW.gml"

    with zipfile.ZipFile(zip_path, "r") as z:
        for member in z.namelist():
            if os.path.basename(member) == expected_name:
                gml_path = os.path.join(out_dir, expected_name)
                with z.open(member) as src, open(gml_path, "wb") as dst:
                    dst.write(src.read())
                print("Extracted .gml to:", gml_path)
                return gml_path

    raise FileNotFoundError(f"{expected_name} not found in {zip_path}")
