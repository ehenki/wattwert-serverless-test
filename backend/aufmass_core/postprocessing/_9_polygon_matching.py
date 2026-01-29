
def polygon_matching(ID_LOD2: str, facade_id: str, access_token: str):
    '''
    Matches polygons - for now only rectangles - to the masks (wall, window, door, etc.) belonging to the facade.
    Uses ID_LOD2 and facade_id to obtain the segmented facade masks from the database (table "segmentation_mask", tag: "wall", "window" or similar).
    Approximates each closed surface of each mask as a rectangle (later: generalized polygon) and saves it to the database table
    of the corresponding facade element object (table "opening", "wall_section", facade_attachment", ggf. with tags "window", "door", "balcony" etc.).
    Returns nothing, but updates the database.
    '''
    return