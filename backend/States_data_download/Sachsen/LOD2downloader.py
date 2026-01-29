import os
import time
import requests
import zipfile
import tempfile

def download_LOD2(utm_easting, utm_northing):
    # 1) Compute the grid coordinates (rounded to even)
    coord1 = int(str(int(utm_easting))[:3])
    coord2 = int(str(int(utm_northing))[:4])
    if coord1 % 2: coord1 -= 1
    if coord2 % 2: coord2 -= 1

    # 2) Build Sachsen-specific download URL and filename
    downloadurl = (
        f"https://geocloud.landesvermessung.sachsen.de/public.php/dav/files/AyJqXpJAZJXomCb/?accept=zip&files=[%22lod2_33{coord1}_{coord2}_2_sn_citygml.zip%22]"
    )
    filename = f"sachsen_{coord1}_{coord2}.zip"

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
            return _unpack_sachsen_gml(zipfile_path, LOD2_path)
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
    return _unpack_sachsen_gml(zipfile_path, LOD2_path)

def _unpack_sachsen_gml(zip_path, out_dir):
    """Extract first .gml from a Sachsen ZIP archive to out_dir."""
    with zipfile.ZipFile(zip_path, "r") as z:
        for member in z.namelist():
            if member.lower().endswith(".gml"):
                gml_name = os.path.basename(member)
                gml_path = os.path.join(out_dir, gml_name)
                with z.open(member) as src, open(gml_path, "wb") as dst:
                    dst.write(src.read())
                print("Extracted .gml to:", gml_path)
                return gml_path
            elif member.lower().endswith(".zip"):
                with tempfile.TemporaryDirectory() as temp_dir:
                    nested_zip_path = os.path.join(temp_dir, os.path.basename(member))
                    with z.open(member) as src, open(nested_zip_path, "wb") as dst:
                        dst.write(src.read())
                    print(f"Extracted nested zip to: {nested_zip_path}")
                    try:
                        gml_file_path = _unpack_sachsen_gml(nested_zip_path, out_dir)
                        if gml_file_path:
                            return gml_file_path
                    except FileNotFoundError:
                        pass

    raise FileNotFoundError(f"No .gml found inside {zip_path!r} or its nested zip files")
