import { supabase } from '@/app/lib/supabaseClient';

export interface BuildingGeometryIDs {
  neighbour_lod2_ids: string[] | null;
  surrounding_buildings_lod2_ids: string[] | null;
}

/**
 * Get IDs of neighbours and surrounding buildings from the buildings_geometry table
 * @param lod2Id - The LOD2 building ID
 * @param accessToken - The user's access token for authentication
 * @returns Promise<BuildingGeometryIDs | null>
 */
export const getBuildingIDsFromGeom = async (lod2Id: string, accessToken: string): Promise<BuildingGeometryIDs | null> => {
  if (!lod2Id || !accessToken) {
    console.error("LOD2 ID or access token is missing");
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('buildings_geometry')
      .select('neighbour_lod2_ids, surrounding_buildings_lod2_ids')
      .eq('ID_LOD2', lod2Id)
      .single();

    if (error) {
      console.error("Error fetching building geometry IDs:", error);
      return null;
    }

    if (data) {
      return data as BuildingGeometryIDs;
    }

    return null;
  } catch (error) {
    console.error("Error in getBuildingIDsFromGeom:", error);
    return null;
  }
};
