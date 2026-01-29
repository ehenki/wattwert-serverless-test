import { supabase } from '@/app/lib/supabaseClient';

export interface WhitelabelData {
    slug: string;
    name: string;
    email?: string;
    tel?: string;
    logo_name?: string;
    photo_name?: string;
    logo_url?: string;
    photo_url?: string;
    is_partner?: boolean;
    partner_type?: string;
    address?: string;
    location?: string; // coordinates_N, coordinates_E, potentially change to JSON later
    rating?: number;
    rating_source?: string;
    consent_whitelabel?: boolean;
    remarks?: string;
    color_primary?: string;
    color_secondary?: string;
    company_id?: string;
    anstrich_kosten_m2?: number | null;
    putz_kosten_m2?: number | null;
    daemmung_kosten_m2?: number | null;
    infotext?: string;
  // Add other fields as needed
}

/**
 * Get whitelabel data using the slug. RLS allows read for all users, no authentication required. Users can not write to this table.
 * @param slug - The slug of the webpage
 * @returns Promise<WhitelabelData | null> - The whitelabel data or null if not found
 */
export const getWhitelabelData = async (slug: string): Promise<WhitelabelData | null> => {
  if (!slug) {
    console.error("Cannot retrieve whitelabel data:Slug is missing!");
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('partner-aufmass-whitelabel')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned 
        console.log(`No existing data found for slug: ${slug}`);
        return null;
      }
      console.error("Error fetching whitelabel data:", error);
      return null;
    }

    if (data) {
      let logo_url: string | undefined;
      let photo_url: string | undefined;

      if (data.logo_name) {
        const { data: logoData } = supabase.storage
          .from('whitelabel_logos')
          .getPublicUrl(data.logo_name);
        logo_url = logoData.publicUrl;
      }

      if (data.photo_name) {
        const { data: photoData } = supabase.storage
          .from('whitelabel_photos')
          .getPublicUrl(data.photo_name);
        photo_url = photoData.publicUrl;
      }

      const result: WhitelabelData = {
        ...data,
        logo_url,
        photo_url,
      };

      console.log('Retrieved existing whitelabel data:', result);
      return result;
    }

    return null;
  } catch (error) {
    console.error("Error in getWhitelabelData:", error);
    return null;
  }
};