import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { BuildingData } from '../components/BuildingViewer/types';
import { getBuildingData } from '../components/database/getBuildingData';
import { fetchVisualizationData as fetchVisData, submitAddress } from '../components/helpers/api';
import { mapExistingDataToState } from '../components/helpers/data';
import eventBus from '../components/helpers/eventBus';

interface WallInfo {
  wallIndex: number;
  area: number;
  maxHeight: number;
  width: number;
  direction?: string;
  vertices?: any[];
}

export const useToolLogic = () => {
  const { session, isSessionUpgrade } = useAuth();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [coordinates, setCoordinates] = useState<[number, number] | null>(null);
  const [clickedCoordinates, setClickedCoordinates] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(false);
  const [visualizationData, setVisualizationData] = useState<BuildingData | null>(null);
  const [lod2Id, setLod2Id] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    street: "",
    number: "",
    city: "",
    state: "",
    country: "Deutschland"
  });
  const [preservedstate, setPreservedstate] = useState<any>(null);
  const [loadingVisualization, setLoadingVisualization] = useState(false);
  const [wallsInfo, setWallsInfo] = useState<WallInfo[]>([]);
  const [pricePerSqm, setPricePerSqm] = useState<number>(0);
  const [safetyMargin, setSafetyMargin] = useState<number>(0);
  const [additionalCosts, setAdditionalCosts] = useState<number>(0);
  const [groundPerimeter, setGroundPerimeter] = useState<number>(0);

  const totalSlides = 4;

  useEffect(() => {
    const handleWallInfo = (event: Event) => {
      const customEvent = event as CustomEvent<{ walls: WallInfo[], groundPerimeter: number }>;
      if (customEvent.detail?.walls) {
        setWallsInfo(customEvent.detail.walls);
      }
      if (customEvent.detail?.groundPerimeter !== undefined) {
        setGroundPerimeter(customEvent.detail.groundPerimeter);
      }
    };

    eventBus.on('wall-info-update', handleWallInfo as EventListener);

    return () => {
      eventBus.off('wall-info-update', handleWallInfo as EventListener);
    };
  }, []);

  // This function checks if the building data already exists in the database (using the LOD2 Id as identifier) and restores it if it does
  // Then sets it in the slide forms
  const checkAndRestoreExistingData = async (currentLod2Id: string) => {
    if (!session?.access_token) return;
    try {
      const existingData = await getBuildingData(currentLod2Id, session.access_token);
      if (existingData) {
        const { updatedFormData } = mapExistingDataToState(existingData);
        
        if (Object.keys(updatedFormData).length > 0) {
          setFormData(prev => ({ ...prev, ...updatedFormData }));
        }
      }
    } catch (error) {
      console.error('Error checking for existing building data:', error);
    }
  };

  // This function fetches the visualization data from the database (using the LOD2 Id as identifier)
  const fetchVisualizationData = async (currentLod2Id: string) => {
    if (!session?.access_token) return;
    try {
      const visualizationResult = await fetchVisData(currentLod2Id, session.access_token);
      if (visualizationResult) {
        setVisualizationData(visualizationResult);
      }
    } catch (error) {
      console.error('Error fetching visualization data from database:', error);
    }
  };

  useEffect(() => {
    // This function checks if a LOD2 ID is stored locally and if so, fetches the building data and visualization data from the database
    const savedLod2Id = localStorage.getItem('currentLod2Id');
    if (savedLod2Id && !lod2Id) {
      setLod2Id(savedLod2Id);
      setTimeout(() => {
        if (session?.access_token) {
          checkAndRestoreExistingData(savedLod2Id);
          fetchVisualizationData(savedLod2Id);
        }
      }, 100);
    }
  }, []);

  // used for preserving the un-signed-in user id to correctly transfer data to the signed-in user in the database
  useEffect(() => {
    if (session?.user?.id) {
      localStorage.setItem('previousUserId', session.user.id);
    }
  }, [session]);

  useEffect(() => {
    localStorage.setItem('currentSlide', currentSlide.toString());
  }, [currentSlide]);

  useEffect(() => {
    if (lod2Id) {
      localStorage.setItem('currentLod2Id', lod2Id);
    }
  }, [lod2Id]);

  useEffect(() => {
    if (lod2Id && session?.access_token && currentSlide >= 0) {
      checkAndRestoreExistingData(lod2Id);
    }
  }, [lod2Id, session?.access_token, currentSlide]);

  // Used when session is upgraded from no signed-in to signed in. In this case, transfer the data to the signed-in user
  useEffect(() => {
    if (isSessionUpgrade && session) {
      setPreservedstate({
        currentSlide,
        formData,
        coordinates,
        clickedCoordinates,
        visualizationData,
        lod2Id,
      });
      setTimeout(() => setPreservedstate(null), 100);
    }
  }, [isSessionUpgrade, session]);

  // Used when session is downgraded from signed-in to no signed-in. In this case, transfer the data to the no signed-in user
  useEffect(() => {
    if (preservedstate && session && !isSessionUpgrade) {
      const previousUserId = localStorage.getItem('previousUserId');
      if (previousUserId && session.user.id !== previousUserId) {
        if (preservedstate.currentSlide !== undefined) setCurrentSlide(preservedstate.currentSlide);
        if (preservedstate.formData) setFormData(preservedstate.formData);
        if (preservedstate.coordinates) setCoordinates(preservedstate.coordinates);
        if (preservedstate.clickedCoordinates) setClickedCoordinates(preservedstate.clickedCoordinates);
        if (preservedstate.visualizationData) setVisualizationData(preservedstate.visualizationData);
        if (preservedstate.lod2Id) setLod2Id(preservedstate.lod2Id);
      }
      localStorage.setItem('previousUserId', session.user.id);
    }
  }, [preservedstate, session, isSessionUpgrade]);

  // Used when session is downgraded from signed-in to no signed-in. In this case, transfer the data to the no signed-in user.
  useEffect(() => {
    if (session && !isSessionUpgrade) {
      const savedLod2Id = localStorage.getItem('currentLod2Id');
      if (savedLod2Id && !lod2Id) {
        setLod2Id(savedLod2Id);
        setTimeout(() => {
          if (session?.access_token) {
            checkAndRestoreExistingData(savedLod2Id);
            fetchVisualizationData(savedLod2Id);
          }
        }, 200);
      }
    }
  }, [session, isSessionUpgrade, lod2Id]);

  useEffect(() => {
    if (lod2Id && session?.access_token && !isSessionUpgrade) {
      checkAndRestoreExistingData(lod2Id);
      fetchVisualizationData(lod2Id);
    }
  }, [session?.access_token]);

    // Auto-submit address after authentication if there's pending address data
    useEffect(() => {
    const pendingAddressDataString = localStorage.getItem('pendingAddressData');
    
    if (pendingAddressDataString && session && !session.user.is_anonymous && session.access_token && currentSlide === 0 && !loading && !lod2Id) {
      const processPendingAddress = async () => {
        try {
          const pendingData = JSON.parse(pendingAddressDataString);
          console.log('Processing pending address data:', pendingData);
          
          // Move to slide 1 immediately so user sees loading animation there
          setCurrentSlide(1);
          
          // Set loading states
          setLoading(true);
          setLoadingVisualization(true);
          
          // Restore form data
          setFormData(prev => ({
            ...prev,
            street: pendingData.street || prev.street,
            number: pendingData.number || prev.number,
            city: pendingData.city || prev.city,
            state: pendingData.state || prev.state,
            country: pendingData.country || prev.country
          }));
          
          if (pendingData.clickedCoordinates) {
            setClickedCoordinates(pendingData.clickedCoordinates);
          }
          
          // Prepare submission data
          const submissionData = {
            street: pendingData.street,
            number: pendingData.number,
            city: pendingData.city,
            state: pendingData.state,
            country: pendingData.country,
            useLaserData: false,
            ...(pendingData.clickedCoordinates && { clickedCoordinates: pendingData.clickedCoordinates })
          };
          
          // Submit address and get building data
          const responseData = await submitAddress(submissionData, session.access_token);
          setCoordinates(responseData.coordinates);
          
          if (responseData.ID_LOD2) {
            setLod2Id(responseData.ID_LOD2);
            /* 
               We fetch both building data and visualization data.
               We use the API function fetchVisData directly here to match the logic in the rest of the file
               calling the internal state updaters.
            */
            const [existingData, visualizationResult] = await Promise.all([
              getBuildingData(responseData.ID_LOD2, session.access_token),
              fetchVisData(responseData.ID_LOD2, session.access_token)
            ]);
            
            if (existingData) {
                const { updatedFormData } = mapExistingDataToState(existingData);
                if (Object.keys(updatedFormData).length > 0) {
                    setFormData(prev => ({ ...prev, ...updatedFormData }));
                }
            }

            if (visualizationResult) {
              setVisualizationData(visualizationResult);
            }
          }
          
          // Clear the pending data only after successful processing
          localStorage.removeItem('pendingAddressData');
          
          setLoading(false);
          setLoadingVisualization(false);
        } catch (error) {
          console.error('Error processing pending address data:', error);
          localStorage.removeItem('pendingAddressData');
          setLoading(false);
          setLoadingVisualization(false);
          // Stay on slide 1 even if there's an error, so user can see the error message
        }
      };
      
      processPendingAddress();
    }
  }, [session, currentSlide, loading, lod2Id]);

  const isFormValid = () => {
    return formData.street !== "" && formData.number !== "" && formData.city !== "" && formData.state !== "";
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
      setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Check for every slide if conditions are met to proceed to the next slide
  const canProceedFromSlide = (
    slideIndex: number, 
    selectedWallsCount: number = 0, 
    userRole: string | null = null,
    allFacadesReady: boolean = true
  ): boolean => {
    switch (slideIndex) {
      case 0: return isFormValid() && clickedCoordinates !== null;
      case 1: 
        if (userRole !== 'geruestbauer') return selectedWallsCount > 0;
        return true;
      case 2: 
        const base = lod2Id !== null && visualizationData !== null;
        if (!base) return false;
        if (userRole === 'geruestbauer') return selectedWallsCount > 0;
        return allFacadesReady;
      case 3: return lod2Id !== null && visualizationData !== null;
      default: return false;
    }
  };

  const handlePreviousSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleNextSlide = async () => {
    if (currentSlide < totalSlides - 1) {
      setCurrentSlide(currentSlide + 1);
    }
  };

  const handleSubmit = async () => {
    if (!isFormValid() || !session?.access_token) {
        return;
    }
    setLoading(true);
    setVisualizationData(null);
    setLoadingVisualization(true);
    setCurrentSlide(1);

    const useLaserDataInput = document.querySelector('input[name="useLaserData"]') as HTMLInputElement;
    const data = {
      ...formData,
      useLaserData: useLaserDataInput?.checked || false,
      ...(clickedCoordinates && { clickedCoordinates: clickedCoordinates })
    };

    try {
      const responseData = await submitAddress(data, session.access_token);
      setCoordinates(responseData.coordinates);

      if (responseData.ID_LOD2) {
        setLod2Id(responseData.ID_LOD2);
        const [existingData, visualizationResult] = await Promise.all([
          getBuildingData(responseData.ID_LOD2, session.access_token),
          fetchVisData(responseData.ID_LOD2, session.access_token)
        ]);
        
        if (existingData) {
          const { updatedFormData } = mapExistingDataToState(existingData);
          if (Object.keys(updatedFormData).length > 0) setFormData(prev => ({ ...prev, ...updatedFormData }));

          if (useLaserDataInput && existingData.useLaserData !== undefined) useLaserDataInput.checked = existingData.useLaserData;
        }

        if (visualizationResult) {
          setVisualizationData(visualizationResult);
        }
      }
    } catch (error) {
      console.error('Error processing request:', error);
    } finally {
      setLoading(false);
      setLoadingVisualization(false);
    }
  };

  const handleBuildingExpansion = async (selectedLOD2Ids: string[]) => {
    if (!session?.access_token || selectedLOD2Ids.length === 0) {
      return;
    }
    setLoading(true);
    setVisualizationData(null);
    setLoadingVisualization(true);
    // Reload slide 1 flow
    setCurrentSlide(1);

    const data = {
      ...formData,
      useLaserData: false,
      ...(clickedCoordinates && { clickedCoordinates: clickedCoordinates }),
      ID_LOD2_list: selectedLOD2Ids
    };

    console.log('New building selection api call with data:', data);

    try {
      const responseData = await submitAddress(data, session.access_token);
      if (responseData.coordinates) {
        setCoordinates(responseData.coordinates);
      }

      // Explicitly use the first element of the selection list to drive the new visualization state
      // This ensures we reload the slide with the new primary ID from the selection
      const newLod2Id = selectedLOD2Ids[0]; 
      setLod2Id(newLod2Id);

      const [existingData, visualizationResult] = await Promise.all([
        getBuildingData(newLod2Id, session.access_token),
        fetchVisData(newLod2Id, session.access_token)
      ]);
      
      if (existingData) {
        const { updatedFormData } = mapExistingDataToState(existingData);
        if (Object.keys(updatedFormData).length > 0) setFormData(prev => ({ ...prev, ...updatedFormData }));
      }

      if (visualizationResult) {
        setVisualizationData(visualizationResult);
      }
    } catch (error) {
      console.error('Error expanding building selection:', error);
    } finally {
      setLoading(false);
      setLoadingVisualization(false);
    }
  };

  // Return the state and functions to the ToolPage component. Is called by tool.page.tsx
  return {
    session,
    currentSlide,
    setCurrentSlide,
    coordinates,
    setCoordinates,
    clickedCoordinates,
    loading,
    setLoading,
    visualizationData,
    setVisualizationData,
    lod2Id,
    setLod2Id,
    formData,
    loadingVisualization,
    setLoadingVisualization,
    totalSlides,
    handleInputChange,
    canProceedFromSlide,
    handlePreviousSlide,
    handleNextSlide,
    handleSubmit,
    handleBuildingExpansion,
    setClickedCoordinates,
    wallsInfo,
    pricePerSqm,
    setPricePerSqm,
    safetyMargin,
    setSafetyMargin,
    additionalCosts,
    setAdditionalCosts,
    groundPerimeter,
  };
};
