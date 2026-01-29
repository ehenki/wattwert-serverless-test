import os
import time
import requests
import zipfile

def download_laser(utm_easting, utm_northing):
    # 1) Compute the grid coordinates (rounded to even)
    coord1 = int(str(int(utm_easting))[:3])
    coord2 = int(str(int(utm_northing))[:4])
    if coord1 % 2: coord1 -= 1
    if coord2 % 2: coord2 -= 1

    # 2) Build Sachsen-specific download URL and filename
    downloadurl = (
        f"https://geocloud.landesvermessung.sachsen.de/index.php/s/rqcqdt8QMcLFUvC/download?path=/&files[]=lsc_33{coord1}_{coord2}_2_sn_laz.zip"
    )
    filename = f"sachsen_{coord1}_{coord2}.zip"

    # 3) File path inside Laser folder next to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    zipfile_path  = os.path.join(script_dir, "Laser", filename)
    Laser_path  = os.path.join(script_dir, "Laser")
    print("URL:", downloadurl, "\nWill save as:", zipfile_path)

    # 4) Re-use if file is less than 1 year old
    one_year = 365 * 24 * 3600
    if os.path.exists(zipfile_path):
        age = time.time() - os.path.getmtime(zipfile_path)
        if age < one_year:
            print(f"Reusing {filename} (age {age/86400:.1f} days)")
            return _unpack_sachsen_laz(zipfile_path, Laser_path)
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

    # 6) Extract and return path to .laz
    return _unpack_sachsen_laz(zipfile_path, Laser_path)

def _unpack_sachsen_laz(zip_path, out_dir):
    """Extract first .laz from a Sachsen ZIP archive to out_dir."""
    with zipfile.ZipFile(zip_path, "r") as z:
        for member in z.namelist():
            if member.lower().endswith(".laz"):
                laz_name = os.path.basename(member)
                laz_path = os.path.join(out_dir, laz_name)
                with z.open(member) as src, open(laz_path, "wb") as dst:
                    dst.write(src.read())
                print("Extracted .laz to:", laz_path)
                return laz_path

    raise FileNotFoundError(f"No .laz found inside {zip_path!r}")
