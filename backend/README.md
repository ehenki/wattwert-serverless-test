# Backend - Python & Supabase
## Structure
The backend is based on python. The main.py script is responsible for the fastapi communication with the frontend (could be renamed accordingly at some point). Handling.py is then called by main.py and handles all the helper functions to download the correct LOD2 & Laser files, determine the buildings & extract data from the files. Later on, it will additionally coordinate the AI Image Processing functions.

### Helper functions

helpers/ contains all python functions that deal with LOD2 and Laser data. addressf.py (short for addressfunctions) handles everything to do with downloading the correct files & determining the correct coordinates & building. geomf.py contains all functions that deal with extracting geometric data from LOD2 (.gml or .xml) files. laserf.py does the same for Laser (.laz or .las) files. attachedWalls.py handles attached houses (Reihenhäuser), it does however still need to be optimized to yield more consisten results.

### State folders

There is a dedicated folder for each state (Bundesland) that contains adapted LOD2 and Laser download functions and folders to hold the data. A file is only freshly download if it does not already exist or has not been updated in a year. The folder contents of the LOD2/ and Laser/ folders are not synchronized in git to reduce project size. This structure may possibly be migrated to Supabase in the future, but works for now.

### visualization

The visualization/ folder only contains python functions that deal with converting the data. The function(s) called directly by main.py, take the pre-processed geometric data as input and converts it into a format that can be used by the frontend (three.js visualization framework).

### Supabase Database
This folder contains functions that are necessary to handle the communication of the python backend with supabase. As all building data needs to be passed from the frontend to the backend anyways, this is handled in the backend. Personal data (e.g. user authentication) is not handled here, but in the frontend.
