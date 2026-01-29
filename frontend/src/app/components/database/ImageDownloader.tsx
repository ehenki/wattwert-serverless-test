import { supabase } from '@/app/lib/supabaseClient';

/**
 * Fetches facade images for a given building (LOD2 ID).
 * Returns a record mapping facade_id to image URL.
 * Only returns images with 'photo' tag.
 */
export const fetchBuildingImages = async (lod2Id: string): Promise<Record<string, string>> => {
  try {
    console.log('[ImageDownloader] Fetching facade images for LOD2 ID:', lod2Id);
    
    const { data: imageData, error: imageError } = await supabase
      .from('facade_image')
      .select('facade_id, storage_path, public_url')
      .eq('ID_LOD2', lod2Id)
      .contains('tags', ['photo']);

    if (imageError) {
      console.error('[ImageDownloader] Error selecting from facade_image:', imageError);
      throw imageError;
    }

    console.log('[ImageDownloader] Query result rows:', imageData?.length ?? 0, imageData);

    if (!imageData || imageData.length === 0) {
      return {};
    }

    const imageUrls: Record<string, string> = {};
    
    for (const image of imageData) {
      if (image.public_url) {
        // Use public URL if available (it's already publicly accessible)
        imageUrls[image.facade_id] = image.public_url;
        console.log('[ImageDownloader] Using public URL for facade_id:', image.facade_id, image.public_url);
      } else if (image.storage_path) {
        // Fallback to signed URL if only storage_path is available
        console.log('[ImageDownloader] Creating signed URL for path:', image.storage_path, 'facade_id:', image.facade_id);
        const { data, error } = await supabase.storage
          .from('facade_images')
          .createSignedUrl(image.storage_path, 3600); // Signed URL valid for 1 hour

        if (error) {
          console.error(`[ImageDownloader] Error creating signed URL for ${image.storage_path}:`, error);
          continue;
        }
        
        if (data?.signedUrl) {
          imageUrls[image.facade_id] = data.signedUrl;
          console.log('[ImageDownloader] Signed URL created for facade_id:', image.facade_id, data.signedUrl);
        } else {
          console.warn('[ImageDownloader] Missing signedUrl for', image);
        }
      } else {
        console.warn('[ImageDownloader] Missing both public_url and storage_path for image row:', image);
      }
    }

    console.log('[ImageDownloader] Final image URL map:', imageUrls);
    return imageUrls;
  } catch (error) {
    console.error('[ImageDownloader] Unexpected error fetching facade images:', error);
    return {};
  }
};

/**
 * Checks if a facade has a segmentation overlay being processed.
 * Returns a record mapping facade_id to boolean (true if segmentation_overlay tag exists).
 */
export const checkFacadeSegmentationStatus = async (lod2Id: string): Promise<Record<string, boolean>> => {
  try {
    console.log('[ImageDownloader] Checking segmentation status for LOD2 ID:', lod2Id);
    
    const { data: imageData, error: imageError } = await supabase
      .from('facade_image')
      .select('facade_id')
      .eq('ID_LOD2', lod2Id)
      .contains('tags', ['segmentation_overlay']);

    if (imageError) {
      console.error('[ImageDownloader] Error checking segmentation status:', imageError);
      throw imageError;
    }

    console.log('[ImageDownloader] Segmentation status query result rows:', imageData?.length ?? 0);

    const segmentationStatus: Record<string, boolean> = {};
    
    if (imageData && imageData.length > 0) {
      for (const image of imageData) {
        segmentationStatus[image.facade_id] = true;
        console.log('[ImageDownloader] Facade ID being processed:', image.facade_id);
      }
    }

    console.log('[ImageDownloader] Final segmentation status map:', segmentationStatus);
    return segmentationStatus;
  } catch (error) {
    console.error('[ImageDownloader] Unexpected error checking segmentation status:', error);
    return {};
  }
};

/**
 *  * Checks if a facade has a photo uploaded.
 * Returns a record mapping facade_id to boolean (true if photo tag exists).
 */
export const checkFacadePhotoStatus = async (lod2Id: string): Promise<Record<string, boolean>> => {
  try {
    console.log('[ImageDownloader] Checking photo status for LOD2 ID:', lod2Id);
    
    const { data: imageData, error: imageError } = await supabase
      .from('facade_image')
      .select('facade_id')
      .eq('ID_LOD2', lod2Id)
      .contains('tags', ['photo']);

    if (imageError) {
      console.error('[ImageDownloader] Error checking photo status:', imageError);
      throw imageError;
    }

    console.log('[ImageDownloader] Photo status query result rows:', imageData?.length ?? 0);
    const photoStatus: Record<string, boolean> = {};
    
    if (imageData && imageData.length > 0) {
      for (const image of imageData) {
        photoStatus[image.facade_id] = true;
        console.log('[ImageDownloader] Facade ID being processed:', image.facade_id);
      }
    }

    console.log('[ImageDownloader] Final photo status map:', photoStatus);
    return photoStatus;
  } catch (error) {
    console.error('[ImageDownloader] Unexpected error checking photo status:', error);
    return {};
  }
};

/**
 * Fetches the segmentation overlay image for a specific facade.
 * Returns the URL string or null if not found.
 */
export const fetchSegmentationOverlayImage = async (lod2Id: string, facadeId: string): Promise<string | null> => {
  try {
    console.log('[ImageDownloader] Fetching segmentation overlay for LOD2 ID:', lod2Id, 'Facade ID:', facadeId);
    
    const { data: rows, error: rowError } = await supabase
      .from('facade_image')
      .select('storage_path, public_url')
      .eq('ID_LOD2', lod2Id)
      .eq('facade_id', parseInt(facadeId))
      .contains('tags', ['segmentation_overlay'])
      .limit(1);

    if (rowError) {
      console.error('[ImageDownloader] Error querying segmentation overlay:', rowError);
      return null;
    }

    if (!rows || rows.length === 0) {
      console.log('[ImageDownloader] No segmentation overlay found for facade:', facadeId);
      return null;
    }

    const image = rows[0];
    console.log('[ImageDownloader] Found segmentation overlay:', image);

    // Always use signed URLs for segmentation overlays to avoid 400 errors with public URLs
    if (image.storage_path) {
      console.log('[ImageDownloader] Creating signed URL for storage_path:', image.storage_path);
      const { data, error } = await supabase.storage
        .from('facade_images')
        .createSignedUrl(image.storage_path, 3600);

      if (error) {
        console.error(`[ImageDownloader] Error creating signed URL for ${image.storage_path}:`, error);
        return null;
      }
      
      if (data?.signedUrl) {
        console.log('[ImageDownloader] Signed URL created:', data.signedUrl);
        return data.signedUrl;
      }
    }
    
    console.warn('[ImageDownloader] No valid storage_path found for segmentation overlay');
    return null;
  } catch (error) {
    console.error('[ImageDownloader] Unexpected error fetching segmentation overlay:', error);
    return null;
  }
};