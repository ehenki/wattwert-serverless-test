import { supabase } from '@/app/lib/supabaseClient';
import { AufmassAnfrage } from '@/app/types/AufmassAnfrage';
import { updateUserBuildingCount } from './uploadUserData';

/**
 * Upload complete Aufmass request data to the database
 * This replaces the previous individual upload functions
 */
export const uploadAufmassAnfrage = async (
  aufmassData: AufmassAnfrage,
  accessToken: string
): Promise<{ success: boolean; error?: any }> => {
  if (!aufmassData.ID_LOD2 || !accessToken || !aufmassData.user_id) {
    console.error('LOD2 ID, session token, or user ID is missing.');
    return { success: false, error: 'Missing required parameters' };
  }

  try {
    // Check if entry already exists
    const { data: existing, error: fetchError } = await supabase
      .from('aufmass_anfragen')
      .select('ID_LOD2')
      .eq('ID_LOD2', aufmassData.ID_LOD2)
      .maybeSingle();

    if (fetchError) {
      console.error('Error checking aufmass entry:', fetchError);
      return { success: false, error: fetchError };
    }

    // Prepare data for upsert
    const dataToUpsert = {
      ID_LOD2: aufmassData.ID_LOD2,
      user_id: aufmassData.user_id,
      facade_paint: aufmassData.facade_paint,
      facade_plaster: aufmassData.facade_plaster,
      windows: aufmassData.windows,
      color_name: aufmassData.color_name,
      name: aufmassData.name,
      email: aufmassData.email,
      phone: aufmassData.phone,
      ki_aufmass: aufmassData.ki_aufmass,
      vor_ort_aufmass: aufmassData.vor_ort_aufmass,
      cost_estimate_lower: aufmassData.cost_estimate_lower,
      cost_estimate_upper: aufmassData.cost_estimate_upper,
      address: aufmassData.address,
      wall_area_tot: aufmassData.wall_area_tot,
      facade_area_tot: aufmassData.facade_area_tot,
      window_area_tot: aufmassData.window_area_tot,
    };

    if (existing) {
      // Update existing entry
      const { error } = await supabase
        .from('aufmass_anfragen')
        .update(dataToUpsert)
        .eq('ID_LOD2', aufmassData.ID_LOD2);

      if (error) {
        console.error('Error updating aufmass entry:', error);
        return { success: false, error };
      }
    } else {
      // Insert new entry
      const { error } = await supabase
        .from('aufmass_anfragen')
        .insert(dataToUpsert);

      if (error) {
        console.error('Error inserting aufmass entry:', error);
        return { success: false, error };
      }
      
      // Update the user's active building count when a new entry is created
      await updateUserBuildingCount(aufmassData.user_id);
    }

    console.log('Aufmass data uploaded successfully!');
    return { success: true };
  } catch (error) {
    console.error('Error in uploadAufmassAnfrage:', error);
    return { success: false, error };
  }
};

