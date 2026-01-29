import { supabase } from '@/app/lib/supabaseClient';

/**
 * Deletes a facade image from both Supabase Storage and the database.
 * 
 * @param lod2Id The building's LOD2 ID
 * @param facadeId The facade index/ID
 * @param tags The tags to match (defaults to ['photo'])
 * @returns Object indicating success or error
 */
export const deleteFacadeImage = async (
  lod2Id: string, 
  facadeId: string, 
  tags: string[] = ['photo']
): Promise<{ success: boolean; error?: any }> => {
  try {
    console.log('[DeleteImage] Attempting to delete image:', { lod2Id, facadeId, tags });

    // 1. Get the storage_path from the database first
    const { data: imageData, error: fetchError } = await supabase
      .from('facade_image')
      .select('storage_path')
      .eq('ID_LOD2', lod2Id)
      .eq('facade_id', facadeId)
      .contains('tags', tags)
      .maybeSingle();

    if (fetchError) {
      console.error('[DeleteImage] Error fetching image metadata:', fetchError);
      return { success: false, error: fetchError };
    }

    if (!imageData) {
      console.warn('[DeleteImage] No image found to delete for:', { lod2Id, facadeId, tags });
      return { success: true }; // Consider it successful if it's already gone
    }

    const { storage_path } = imageData;

    // 2. Delete from Supabase Storage if storage_path exists
    if (storage_path) {
      console.log('[DeleteImage] Deleting from storage bucket:', storage_path);
      const { error: storageError } = await supabase.storage
        .from('facade_images')
        .remove([storage_path]);

      if (storageError) {
        console.error('[DeleteImage] Error deleting from storage:', storageError);
        // We continue to try and delete from DB anyway, to avoid orphaned records
        // but we'll return the error later if needed.
      }
    }

    // 3. Delete from the database
    console.log('[DeleteImage] Deleting record from database table');
    const { error: deleteError } = await supabase
      .from('facade_image')
      .delete()
      .eq('ID_LOD2', lod2Id)
      .eq('facade_id', facadeId)
      .contains('tags', tags);

    if (deleteError) {
      console.error('[DeleteImage] Error deleting from database:', deleteError);
      return { success: false, error: deleteError };
    }

    console.log('[DeleteImage] Image successfully deleted');
    return { success: true };
  } catch (error) {
    console.error('[DeleteImage] Unexpected error:', error);
    return { success: false, error };
  }
};
