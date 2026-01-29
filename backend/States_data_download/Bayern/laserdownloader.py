import os
import requests
import time

def download_laser(utm_easting, utm_northing):
    coord1 = int(str(utm_easting)[:3])
    coord2 = int(str(utm_northing)[:4])

    downloadurl = f"https://geodaten.bayern.de/odd_data/laser/{coord1}_{coord2}.laz"
    print(downloadurl)
    filename = os.path.basename(downloadurl)

    # Get the directory where the script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_path  = os.path.join(script_dir, "Laser", filename)

    # Check if the file exists and is not older than 1 year
    if os.path.exists(file_path):
        file_age = time.time() - os.path.getmtime(file_path)
        one_year_seconds = 365 * 24 * 60 * 60  # One year in seconds
        
        if file_age < one_year_seconds:
            print(f"Laser file already exists and is not older than one year, no download necessary: {file_path}")
            return file_path
        else:
            print(f"Laser file exists but is older than one year, downloading a new version...")
            # Download the file
            response = requests.get(downloadurl, stream=True)
            if response.status_code == 200:
                with open(file_path, 'wb') as file:
                    for chunk in response.iter_content(chunk_size=1024):
                        file.write(chunk)
                print(f"File downloaded successfully: {file_path}")
                return file_path
            else: 
                print("Couldn't download new file, using old one instead")
                return file_path
    else:
        print("Laser file not yet retrieved, downloading...")
        # Download the file
        response = requests.get(downloadurl, stream=True)
        if response.status_code == 200:
            with open(file_path, 'wb') as file:
                for chunk in response.iter_content(chunk_size=1024):
                    file.write(chunk)
            print(f"Laser file downloaded successfully: {file_path}")
            return file_path
        else:
            print(f"Failed to download Laser file. HTTP Status Code: {response.status_code}")
            return "Error: Could not download Laser file"