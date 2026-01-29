import { supabase } from '@/app/lib/supabaseClient';

interface RatingData {
  user_id: string;
  rating: number;
  note: string;
  user_role?: string | null;
}

export const uploadRating = async (
  ratingData: RatingData,
  accessToken: string
): Promise<{ success: boolean; error?: any }> => {
  if (!ratingData.user_id || !accessToken) {
    console.error('User ID or session token is missing.');
    return { success: false, error: 'Missing required parameters' };
  }

  try {
    const dataToInsert = {
      // user_id is handled by database default auth.uid()
      application: 'Schnellaufmaß',
      rating: ratingData.rating,
      note: ratingData.note,
      user_role: ratingData.user_role || null,
    };

    const { error } = await supabase
      .from('ratings')
      .insert(dataToInsert);

    if (error) {
      console.error('Error inserting rating:', error);
      return { success: false, error };
    }

    console.log('Rating data uploaded successfully!');
    return { success: true };
  } catch (error) {
    console.error('Error in uploadRating:', error);
    return { success: false, error };
  }
};
