def identify_obscuring_elements(ID_LOD2: str, facade_id: str, access_token: str):
    '''
    Implementation not planned for the first version.
    Identifies the obscuring elements on the facade.
    Uses ID_LOD2 and facade_id to obtain the rectified image from the database (tag: "rectified").
    Creates a mask of the obscuring elements and uploads it to the segmentation_mask database table (tag: "obscuring", possibly more detailed tags like "tree", "car", "sign").
    Returns nothing, but updates the database.
    '''
    return