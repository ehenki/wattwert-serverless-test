import os
import time
import requests
import zipfile

def download_LOD2(utm_easting, utm_northing):
    print("Coordinates:", utm_easting, utm_northing)
    # 1) Compute the grid coordinates (rounded to even)
    coord1 = int(str(int(utm_easting))[:3])
    coord2 = int(str(int(utm_northing))[:4])
    # 2) Build Berlin-specific download URL and filename
    downloadurl = (
        "https://gdi.berlin.de/data/a_lod2/atom/LOD2_"
        f"{coord1}_{coord2}.zip"
    )
    filename = f"berlin_{coord1}_{coord2}.zip"

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
            return _unpack_berlin_gml(zipfile_path, LOD2_path)
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

    # 6) Extract and return path to .xml
    return _unpack_berlin_gml(zipfile_path, LOD2_path)

def _unpack_berlin_gml(zip_path, out_dir):
    """Extract first .xml from a Berlin ZIP archive to out_dir."""
    with zipfile.ZipFile(zip_path, "r") as z:
        for member in z.namelist():
            if member.lower().endswith(".xml"):
                xml_name = os.path.basename(member)
                xml_path = os.path.join(out_dir, xml_name)
                with z.open(member) as src, open(xml_path, "wb") as dst:
                    dst.write(src.read())
                print("Extracted .xml to:", xml_path)
                return xml_path

    raise FileNotFoundError(f"No .xml found inside {zip_path!r}")
