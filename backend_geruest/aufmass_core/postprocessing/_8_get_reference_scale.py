def get_reference_scale(ID_LOD2: str, facade_id: str, access_token: str):
    '''
    Determines the reference scale for the facade.
    Uses ID_LOD2 and facade_id to obtain the segmented facade mask from the database (tag: "wall" or similar).
    Gets the eave_height (and potentially other reference lengths) from the facade object and calculates the reference scale in meters per pixel.
    Uploads the reference scale to the facade object ("scale_factor").
    Returns nothing, but updates the database.
    '''
    return