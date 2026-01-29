// Unified interface for all Aufmass request data
export interface AufmassAnfrage {
  ID_LOD2: string;
  user_id: string;
  facade_paint: boolean;
  facade_plaster: boolean;
  windows: boolean;
  color_name?: string | null;
  name: string;
  email: string;
  phone: string;
  ki_aufmass: boolean;
  vor_ort_aufmass: boolean;
  cost_estimate_lower?: number | null;
  cost_estimate_upper?: number | null;
  address?: string | null;
  wall_area_tot?: number | null;
  facade_area_tot?: number | null;
  window_area_tot?: number | null;
}

// Helper to create an empty AufmassAnfrage with required fields
export const createEmptyAufmassAnfrage = (lod2Id: string, userId: string): AufmassAnfrage => ({
  ID_LOD2: lod2Id,
  user_id: userId,
  facade_paint: false,
  facade_plaster: false,
  windows: false,
  color_name: null,
  name: '',
  email: '',
  phone: '',
  ki_aufmass: false,
  vor_ort_aufmass: false,
  cost_estimate_lower: null,
  cost_estimate_upper: null,
  address: null,
  wall_area_tot: null,
  facade_area_tot: null,
  window_area_tot: null,
});

