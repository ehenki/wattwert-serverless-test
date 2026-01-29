# Downloads LOD2 file for Rheinland-Pfalz
import os
import time
import requests
import tempfile
import shutil
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from requests.exceptions import SSLError

def download_LOD2(utm_easting, utm_northing):
    coord1 = int(str(int(utm_easting))[:3])
    coord2 = int(str(int(utm_northing))[:4])
    if coord1 % 2: coord1 -= 1
    if coord2 % 2: coord2 -= 1
    # Build URL
    downloadurl = f"https://geobasis-rlp.de/data/geb3dlo/current/gml/LoD2_32_{coord1}_{coord2}_2_RP.gml"
    filename = f"Rheinland-Pfalz_{coord1}_{coord2}.gml"

    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_dir   = os.path.join(script_dir, "LOD2")
    file_path  = os.path.join(file_dir, filename)
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

    # Ensure target directory exists
    os.makedirs(file_dir, exist_ok=True)

    # Prefer OS trust store if available (helps with corporate/intermediate CAs on Windows/macOS)
    used_truststore = False
    try:
        import truststore  # type: ignore
        truststore.inject_into_ssl()
        used_truststore = True
        print("Using OS certificate store via truststore")
    except Exception:
        used_truststore = False

    # Download with robust SSL verification using certifi (if available) and retries
    session = requests.Session()
    retries = Retry(total=5, backoff_factor=0.5, status_forcelist=[429, 500, 502, 503, 504])
    session.mount("https://", HTTPAdapter(max_retries=retries))

    # Resolve CA bundle
    try:
        import certifi  # type: ignore
        ca_bundle = certifi.where()
    except Exception:
        ca_bundle = True  # fall back to system CAs

    # If a custom intermediate/root chain is provided, merge it with certifi bundle
    try:
        custom_ca_candidates = [
            os.path.join(file_dir, "..", "certs", "geobasis_rlp_chain.pem"),
            os.path.join(script_dir, "certs", "geobasis_rlp_chain.pem"),
        ]
        custom_ca_file = next((p for p in custom_ca_candidates if os.path.isfile(os.path.normpath(p))), None)
        if custom_ca_file:
            # Create a temporary merged bundle
            temp_bundle = tempfile.NamedTemporaryFile(delete=False, suffix="_rlp_ca.pem")
            try:
                # Start from certifi/system bundle if available, else empty
                if isinstance(ca_bundle, str) and os.path.isfile(ca_bundle):
                    with open(ca_bundle, "rb") as src:
                        shutil.copyfileobj(src, temp_bundle)
                # Append custom
                with open(custom_ca_file, "rb") as src:
                    temp_bundle.write(b"\n")
                    shutil.copyfileobj(src, temp_bundle)
                temp_bundle.flush()
                ca_bundle = temp_bundle.name
                print("Using custom CA chain:", os.path.normpath(custom_ca_file))
            finally:
                temp_bundle.close()
    except Exception as e:
        print("Warning: could not prepare custom CA bundle:", e)

    try:
        # Optional insecure override (LAST RESORT). Set ALLOW_INSECURE_GEO_RLP=1 to bypass verification.
        insecure = os.getenv("ALLOW_INSECURE_GEO_RLP") == "1"
        verify_param = False if insecure else (True if used_truststore else ca_bundle)
        if insecure:
            print("WARNING: Insecure TLS verification disabled for geobasis-rlp.de. Use only if you trust the network.")

        resp = session.get(downloadurl, stream=True, timeout=30, verify=verify_param)
        resp.raise_for_status()
        with open(file_path, "wb") as fp:
            for chunk in resp.iter_content(1024):
                if chunk:
                    fp.write(chunk)
        print("Downloaded:", file_path)
    except SSLError as e:
        print("SSL error while downloading. Try: 'pip install -U certifi' or provide a PEM chain at 'backend/Rheinland-Pfalz/certs/geobasis_rlp_chain.pem' and retry. You may temporarily set ALLOW_INSECURE_GEO_RLP=1 to bypass (not recommended).", e)
        raise

    # Return the path to the .gml file
    return file_path
