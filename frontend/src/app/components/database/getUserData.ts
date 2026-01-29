import { supabase } from '@/app/lib/supabaseClient';

export interface UserOverviewData {
  user_id: string;
  email: string;
  phone?: string;
  name?: string;
  free_buildings: number;
  active_buildings: number;
  user_role?: string;
}

export const getUserOverview = async (userId: string): Promise<UserOverviewData | null> => {
  if (!userId) {
    console.error("User ID is missing. Cannot get user overview.");
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('aufmass_users_overview')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') { // PGRST116 is the error code for "no rows returned"
        console.error("Error fetching user overview:", error);
      }
      return null;
    }

    return data as UserOverviewData;
  } catch (error) {
    console.error("Error in getUserOverview:", error);
    return null;
  }
};

