import { supabase } from '@/app/lib/supabaseClient';
import { Facade } from './FacadeUpload';

/**
 * Retrieves facade data from the database for a specific ID_LOD2 and facade_id.
 * RLS is handled by the supabase client (session-based).
 */
export const getFacadeData = async (
  ID_LOD2: string,
  facade_id: string,
  accessToken: string
): Promise<{ success: boolean; data?: Facade | null; error?: any }> => {
  if (!ID_LOD2 || !facade_id || !accessToken) {
    console.error('ID_LOD2, facade_id, or access token is missing.');
    return { success: false, error: 'Missing required parameters' };
  }

  try {
    // Fetch the facade data. Using limit(1) to handle potential duplicates
    // as seen in FacadeUpload.ts pattern.
    const { data, error } = await supabase
      .from('facade')
      .select('*')
      .eq('ID_LOD2', ID_LOD2)
      .eq('facade_id', facade_id)
      .limit(1);

    if (error) {
      console.error('Error fetching facade data:', error);
      return { success: false, error };
    }

    const facade = data && data.length > 0 ? (data[0] as Facade) : null;

    return { success: true, data: facade };
  } catch (error) {
    console.error('Error in getFacadeData:', error);
    return { success: false, error };
  }
};
