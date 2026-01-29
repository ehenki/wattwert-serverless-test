import { supabase } from '@/app/lib/supabaseClient';

export const createUserOverview = async (userId: string, email: string, userRole?: string) => {
  if (!userId || !email) {
    console.error("User ID or email is missing. Cannot create user overview.");
    return { success: false, error: "Missing required parameters" };
  }

  try {
    const { error } = await supabase
      .from('aufmass_users_overview')
      .insert({
        // user_id is handled by database default auth.uid()
        email: email,
        active_buildings: 0,
        free_buildings: 3,
        user_role: userRole || null,
      });

    if (error) {
      console.error("Error creating user overview:", error);
      return { success: false, error };
    } else {
      console.log("User overview created successfully!");
      return { success: true };
    }
  } catch (error) {
    console.error("Error in createUserOverview:", error);
    return { success: false, error };
  }
};

export const ensureUserOverview = async (userId: string, email: string) => {
  if (!userId || !email) {
    console.error("User ID or email is missing. Cannot ensure user overview.");
    return { success: false, error: "Missing required parameters" };
  }

  try {
    // Check if user overview already exists
    const { data: existingData, error: fetchError } = await supabase
      .from('aufmass_users_overview')
      .select('user_id')
      .eq('user_id', userId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error("Error checking existing user overview:", fetchError);
      return { success: false, error: fetchError };
    }

    // If user overview doesn't exist, create it
    if (!existingData) {
      console.log("User overview not found, creating new entry...");
      return await createUserOverview(userId, email);
    } else {
      console.log("User overview already exists.");
      return { success: true };
    }
  } catch (error) {
    console.error("Error in ensureUserOverview:", error);
    return { success: false, error };
  }
};

export const updateUserBuildingCount = async (userId: string) => {
  if (!userId) {
    console.error("User ID is missing. Cannot update building count.");
    return { success: false, error: "Missing user ID" };
  }

  try {
    // Get current building count
    const { data, error: fetchError } = await supabase
      .from('aufmass_users_overview')
      .select('active_buildings')
      .eq('user_id', userId)
      .single();

    if (fetchError) {
      console.error("Error fetching building count:", fetchError);
      return { success: false, error: fetchError };
    }

    const currentCount = data.active_buildings || 0;

    // Increment and update
    const { error: updateError } = await supabase
      .from('aufmass_users_overview')
      .update({ active_buildings: currentCount + 1 })
      .eq('user_id', userId);

    if (updateError) {
      console.error("Error updating building count:", updateError);
      return { success: false, error: updateError };
    }

    console.log(`Updated building count for user ${userId} to ${currentCount + 1}`);
    return { success: true };
  } catch (error) {
    console.error("Error in updateUserBuildingCount:", error);
    return { success: false, error };
  }
};

