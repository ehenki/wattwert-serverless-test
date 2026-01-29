import { supabase } from '@/app/lib/supabaseClient';

// Type definitions based on backend/aufmass_core/datastructure/aufmassClasses.py
type Point2D = [number, number]; // [x, y]
type Point3D = [number, number, number]; // [x, y, z]
type Polygon2D = Point2D[];
type Polygon3D = Point3D[];

export interface Facade {
  ID_LOD2: string;
  facade_id: string;
  wwr?: number | null;
  area?: number | null;
  window_count?: number | null;
  scale_factor?: number | null;
  image_processed?: boolean;
  surface_2d?: Polygon2D[] | null;
  surface_3d?: Polygon3D[] | null;
  material_ids?: number[] | null;
  material_fractions?: number[] | null;
  max_height?: number | null;
  eave_length?: number | null;
  direction?: string | null;
  user_id: string;
}

/**
 * Upload facade data to the database
 * This function handles both inserting new facade entries and updating existing ones
 */
export const uploadFacadeData = async (
  facadeData: Facade,
  accessToken: string
): Promise<{ success: boolean; error?: any }> => {
  if (!facadeData.ID_LOD2 || !facadeData.facade_id || !accessToken || !facadeData.user_id) {
    console.error('ID_LOD2, facade_id, access token, or user_id is missing.');
    return { success: false, error: 'Missing required parameters' };
  }

  try {
    // Check if any entries already exist for this specific building and facade
    // Using select().limit(1) instead of maybeSingle() to handle cases where 
    // previous buggy inserts might have created multiple entries
    const { data: existingRecords, error: fetchError } = await supabase
      .from('facade')
      .select('facade_id')
      .eq('ID_LOD2', facadeData.ID_LOD2)
      .eq('facade_id', facadeData.facade_id)
      .limit(1);

    if (fetchError) {
      console.error('Error checking facade entry:', fetchError);
      return { success: false, error: fetchError };
    }

    const hasExisting = existingRecords && existingRecords.length > 0;

    // Prepare data for upload
    const dataToUpsert = {
      ID_LOD2: facadeData.ID_LOD2,
      facade_id: facadeData.facade_id,
      area: facadeData.area,
      scale_factor: facadeData.scale_factor,
      image_processed: facadeData.image_processed ?? false,
      surface_2d: facadeData.surface_2d,
      surface_3d: facadeData.surface_3d,
      material_ids: facadeData.material_ids,
      material_fractions: facadeData.material_fractions,
      max_height: facadeData.max_height,
      eave_length: facadeData.eave_length,
      direction: facadeData.direction
      // user_id is handled by database default auth.uid()
    };

    if (hasExisting) {
      // Update existing entries using both IDs as filters
      // This will update ALL matching entries if duplicates exist
      const { error } = await supabase
        .from('facade')
        .update(dataToUpsert)
        .eq('ID_LOD2', facadeData.ID_LOD2)
        .eq('facade_id', facadeData.facade_id);

      if (error) {
        console.error('Error updating facade entry:', error);
        return { success: false, error };
      }
    } else {
      // Insert new entry
      const { error } = await supabase
        .from('facade')
        .insert(dataToUpsert);

      if (error) {
        console.error('Error inserting facade entry:', error);
        return { success: false, error };
      }
    }

    console.log('Facade data uploaded successfully!');
    return { success: true };
  } catch (error) {
    console.error('Error in uploadFacadeData:', error);
    return { success: false, error };
  }
};