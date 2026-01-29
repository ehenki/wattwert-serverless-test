import { supabase } from '@/app/lib/supabaseClient';

export interface BuildingData {
  ID_LOD2: string;
  user_id: string;
  Street?: string;
  House_number?: string;
  City?: string;
  State?: string;
  Country?: string;
  useLaserData?: boolean;
  Wall_area_N?: number;
  Wall_area_NE?: number;
  Wall_area_E?: number;
  Wall_area_SE?: number;
  Wall_area_S?: number;
  Wall_area_SW?: number;
  Wall_area_W?: number;
  Wall_area_NW?: number;
  Window_area_N?: number;
  Window_area_NE?: number;
  Window_area_E?: number;
  Window_area_SE?: number;
  Window_area_S?: number;
  Window_area_SW?: number;
  Window_area_W?: number;
  Window_area_NW?: number;
  Facade_area_N?: number;
  Facade_area_NE?: number;
  Facade_area_E?: number;
  Facade_area_SE?: number;
  Facade_area_S?: number;
  Facade_area_SW?: number;
  Facade_area_W?: number;
  Facade_area_NW?: number;
  // Add other fields as needed
}

/**
 * Get building data from the database using ID_LOD2 and user_id for RLS compliance
 * @param lod2Id - The LOD2 building ID
 * @param accessToken - The user's access token for authentication
 * @returns Promise<BuildingData | null> - The building data or null if not found
 */
export const getBuildingData = async (lod2Id: string, accessToken: string): Promise<BuildingData | null> => {
  if (!lod2Id || !accessToken) {
    console.error("LOD2 ID or access token is missing");
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('buildings_data')
      .select('*')
      .eq('ID_LOD2', lod2Id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - this is normal for new buildings
        console.log(`No existing data found for LOD2 ID: ${lod2Id}`);
        return null;
      }
      console.error("Error fetching building data:", error);
      return null;
    }

    if (data) {
      console.log('Retrieved existing building data:', data);
      return data as BuildingData;
    }

    return null;
  } catch (error) {
    console.error("Error in getBuildingData:", error);
    return null;
  }
};
