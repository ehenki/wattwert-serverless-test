
import { BuildingData } from '../BuildingViewer/types';
import config from '@/config';

// This function fetches the visualization data from the database (using the LOD2 Id as identifier) via an api call to the backend
// The backend fetches the geometry data from the database and converts it into a format that can be used by the frontend (three.js visualization framework)
export const fetchVisualizationData = async (lod2Id: string, accessToken: string): Promise<BuildingData | null> => {
  try {
    const geomResponse = await fetch(`${config.apiUrl}/api/geom-to-threejs?ID_LOD2=${encodeURIComponent(lod2Id)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    if (geomResponse.ok) {
      return await geomResponse.json();
    } else {
      const errorData = await geomResponse.json();
      console.error('Error fetching visualization data:', errorData);
      return null;
    }
  } catch (error) {
    console.error('Error fetching visualization data from database:', error);
    return null;
  }
};

export const submitAddress = async (data: any, accessToken: string) => {
  const response = await fetch(`${config.apiUrl}/api/address`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    },
    body: JSON.stringify(data),
  });
  return await response.json();
};

export const startAufmass = async (lod2Id: string, accessToken: string): Promise<void> => {
  try {
    const response = await fetch(`${config.apiUrl}/api/start_aufmass`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({ ID_LOD2: lod2Id }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Start aufmass request failed');
    }
  } catch (error) {
    console.error('Error calling start_aufmass:', error);
    throw error;
  }
};