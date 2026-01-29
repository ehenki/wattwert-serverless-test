'use client';
import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import SmartAddressForm from '../components/SmartAddressForm';
import MapContainer from '../components/MapContainer';
import BuildingViewerContainer from '../components/BuildingViewerContainer';
import WallSelectionSlide from '../components/slides/WallSelectionSlide';
import WindowShareSlide from '../components/slides/WindowShareSlide';
import GeruestSelectionSlide from '../components/slides/GeruestSelectionSlide';
import GeruestCalculationSlide, { GeruestData } from '../components/slides/GeruestCalculationSlide';
import PriceCalculation from '../components/slides/PriceCalculation';
import SlideNavigation from '../components/slides/SlideNavigation';
import LoadingScreen from '../components/ui/LoadingScreen';
import PauschalResults from '../components/slides/PauschalResults';
import { useToolLogic } from '../hooks/useToolLogic';
import { useState } from 'react';
import { WhitelabelData } from '../components/database/getWhitelabelData';
import { useAuth } from "@/contexts/AuthContext";
import { getUserOverview } from '../components/database/getUserData';
import { getAllWalls } from '../components/helpers/buildingDataUtils';
import { uploadFacadeData, Facade } from '../components/database/FacadeUpload';
import { startAufmass } from '../components/helpers/api';
import { uploadAufmassAnfrage } from '../components/database/uploadAufmassData';
import { AufmassAnfrage } from '../types/AufmassAnfrage';
import { getBuildingIDsFromGeom } from '../components/database/getBuildingIDsFromGeom';

// We are using the useToolLogic hook to manage the state and logic of the tool
// It stores current states of the slide forms
interface ParsedAddress {
  postcode?: string;
  street?: string;
  houseNumber?: string;
  city?: string;
  state?: string;
  country: string;
  completeness: 'postcode' | 'street' | 'complete' | 'none';
}

export default function ToolPage() {
  const { session, loading: authLoading } = useAuth();
  const [whitelabelData, setWhitelabelData] = useState<WhitelabelData | null>(null);
  const [selectedWalls, setSelectedWalls] = useState<number[]>([]);
  const [windowShare, setWindowShare] = useState<number | null>(null);
  const [directionWindowShares, setDirectionWindowShares] = useState<Record<string, number>>({});
  const [geruestData, setGeruestData] = useState<GeruestData>({ width: 80, eave_height_difference: 50 });
  const [userRole, setUserRole] = useState<string | null>(null);
  const [allFacadesReady, setAllFacadesReady] = useState<boolean>(true);
  const [selectedNeighbours, setSelectedNeighbours] = useState<number[]>([]);
  const [selectedSurroundingBuildings, setSelectedSurroundingBuildings] = useState<number[]>([]);
  const [neighbourIDs, setNeighbourIDs] = useState<string[]>([]);
  const [surroundingIDs, setSurroundingIDs] = useState<string[]>([]);
  const [selectedLOD2Ids, setSelectedLOD2Ids] = useState<string[]>([]);
  const [mainBuildingSelected, setMainBuildingSelected] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && session && !session.user.is_anonymous && session.user.id) {
      // Check if user profile exists and fetch user role
      getUserOverview(session.user.id).then(data => {
        if (data?.user_role) {
          setUserRole(data.user_role);
        } else {
          // No user profile exists, redirect to role selection
          router.push('/role');
        }
      });
    }
  }, [session, authLoading, router]);

  // Only show loading screen while checking auth status
  if (authLoading) {
    return <LoadingScreen />;
  }

  useEffect(() => {
    const storedData = localStorage.getItem('whitelabel_data');
    if (storedData) {
      try {
        const data: WhitelabelData = JSON.parse(storedData);
        setWhitelabelData(data);
        
        // Apply whitelabel colors if available
        const root = document.documentElement;
        if (data.color_primary) {
          root.style.setProperty('--base-col1', data.color_primary);
          // We might want to calculate a hover version or leave it as default/derived
        }
        if (data.color_secondary) {
          root.style.setProperty('--base-col2', data.color_secondary);
        }
      } catch (e) {
        console.error("Failed to parse whitelabel data", e);
      }
    }
  }, []);

  const [parsedAddress, setParsedAddress] = useState<ParsedAddress | null>(null);
  const [clearSuggestionSignal, setClearSuggestionSignal] = useState<number>(0);
  const [clickedAddressFromMap, setClickedAddressFromMap] = useState<{ street: string; number: string; city: string; state: string; country: string; fullAddress: string } | null>(null);

  const {
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
  } = useToolLogic();

  // Clear neighbours and surrounding buildings selection when entering slide 1
  useEffect(() => {
    if (currentSlide === 1) {
      setSelectedNeighbours([]);
      setSelectedSurroundingBuildings([]);
      setMainBuildingSelected(false);
    }
  }, [currentSlide]);

  // Fetch IDs for matching neighbours/surrounding buildings
  useEffect(() => {
    if (lod2Id && session?.access_token) {
        getBuildingIDsFromGeom(lod2Id, session.access_token).then(data => {
            if (data) {
                console.log("Fetched Geometry IDs for matching:", data);
                setNeighbourIDs(data.neighbour_lod2_ids || []);
                setSurroundingIDs(data.surrounding_buildings_lod2_ids || []);
            }
        });
    }
  }, [lod2Id, session]);

  // Update selected_LOD2_ids based on selection
  useEffect(() => {
      console.log('--- Matching Selection to LOD2 IDs ---');
      
      const selectedNeighbourIdsList = selectedNeighbours
        .map(index => neighbourIDs[index])
        .filter(Boolean); // removes undefined/null/empty strings

      const selectedSurroundingIdsList = selectedSurroundingBuildings
        .map(index => surroundingIDs[index])
        .filter(Boolean);

      const allSelectedIds = [...selectedNeighbourIdsList, ...selectedSurroundingIdsList];

      if (mainBuildingSelected && lod2Id) {
        // Add main building to the beginning of the list if selected
        allSelectedIds.unshift(lod2Id);
      }
      
      console.log(`Matching Neighbours: Indices [${selectedNeighbours.join(', ')}] -> IDs`, selectedNeighbourIdsList);
      console.log(`Matching Surrounding: Indices [${selectedSurroundingBuildings.join(', ')}] -> IDs`, selectedSurroundingIdsList);
      console.log("Combined Selected LOD2 IDs:", allSelectedIds);
      
      setSelectedLOD2Ids(allSelectedIds);

  }, [selectedNeighbours, selectedSurroundingBuildings, neighbourIDs, surroundingIDs, mainBuildingSelected, lod2Id]);

  // Calculate total wall area for PriceCalculation using direction-specific window shares
  const selectedWallsInfo = wallsInfo.filter(wall => selectedWalls.includes(wall.wallIndex));
  
  const totalArea = selectedWallsInfo.reduce((sum, wall) => sum + wall.area, 0);
  
  // Calculate total window area using direction-specific shares
  const totalWindowArea = selectedWallsInfo.reduce((sum, wall) => {
    const share = wall.direction && directionWindowShares[wall.direction] !== undefined
      ? directionWindowShares[wall.direction]
      : (windowShare || 15);
    return sum + (wall.area * share / 100);
  }, 0);
  
  const totalWallArea = totalArea - totalWindowArea;

  const maxHeightOverall = selectedWallsInfo.reduce((max, wall) => Math.max(max, wall.maxHeight), 0);

  const totalPrice = totalWallArea * pricePerSqm * (1 + safetyMargin / 100) + additionalCosts;
  const addressString = `${formData.street} ${formData.number}, ${formData.city}`;

  const canProceed = canProceedFromSlide(currentSlide, selectedWalls.length, userRole, allFacadesReady);

  const handleNextWithUpload = async () => {
    // Check if we are on the wall selection slide (slide 2)
    if ((userRole === "geruestbauer" && currentSlide === 2) || (userRole !== "geruestbauer" && currentSlide === 1)) {
      if (visualizationData && session?.access_token && lod2Id) {
        try {
            const allWalls = getAllWalls(visualizationData);
            
            // Filter only selected walls
            const selectedAugmentedWalls = allWalls.filter(w => selectedWalls.includes(w.originalIndex));

            // Group by direction/facadeId
            const groupedWalls = selectedAugmentedWalls.reduce((acc, wall) => {
                const key = wall.facadeId;
                if (!acc[key]) {
                    acc[key] = {
                        facadeId: wall.facadeId,
                        direction: wall.direction,
                        walls: []
                    };
                }
                acc[key].walls.push(wall.wall);
                return acc;
            }, {} as Record<number, { facadeId: number, direction: string, walls: any[] }>);

            // Upload each group
            const uploadPromises = Object.values(groupedWalls).map(group => {
                // Calculate total area for this facade from selected walls
                const facadeArea = selectedAugmentedWalls
                  .filter(w => w.facadeId === group.facadeId)
                  .reduce((sum, w) => {
                    const wallInfo = wallsInfo.find(wi => wi.wallIndex === w.originalIndex);
                    return sum + (wallInfo?.area || 0);
                  }, 0);

                const facade: Facade = {
                    ID_LOD2: lod2Id,
                    facade_id: String(group.facadeId),
                    direction: group.direction,
                    area: facadeArea,
                    image_processed: false,
                    surface_3d: group.walls.map(w => w.vertices.map((v: any) => [v.x, v.y, v.z])),
                    user_id: session.user.id
                };
                return uploadFacadeData(facade, session.access_token!);
            });

            await Promise.all(uploadPromises);
            console.log('Facades uploaded successfully');

            // For non-geruestbauer users, call start_aufmass after uploading facades
            // Run in background without waiting for completion
            if (userRole !== "geruestbauer") {
              startAufmass(lod2Id, session.access_token!)
                .then(() => console.log('Aufmass started successfully'))
                .catch((error) => console.error('Error starting aufmass:', error));
            }

        } catch (error) {
            console.error("Error uploading facades:", error);
        }
      }
    }

    // Upload aufmass inquiry when moving from slide 2 to 3
    if (currentSlide === 2 && lod2Id && session?.user?.id && session?.access_token) {
      const aufmassAnfrage: AufmassAnfrage = {
        ID_LOD2: lod2Id,
        user_id: session.user.id,
        address: addressString,
        wall_area_tot: totalWallArea,
        facade_area_tot: totalArea,
        window_area_tot: totalWindowArea,
        // Default values for other required fields
        facade_paint: userRole !== 'geruestbauer',
        facade_plaster: false,
        windows: false,
        name: '',
        email: '',
        phone: '',
        ki_aufmass: false,
        vor_ort_aufmass: false,
      };
      
      uploadAufmassAnfrage(aufmassAnfrage, session.access_token)
        .then(res => {
          if (res.success) console.log('Aufmass inquiry uploaded successfully');
          else console.error('Failed to upload aufmass inquiry:', res.error);
        })
        .catch(err => console.error('Error calling uploadAufmassAnfrage:', err));
    }
    
    // Handle slide navigation
    handleNextSlide();
  };

  const isFormValid = () => {
    return formData.street !== "" &&
           formData.number !== "" &&
           formData.city !== "" &&
           formData.state !== "";
  };

  const renderSlideContent = () => {
    switch (currentSlide) {
      case 0:
        return null; // Address form is now rendered as overlay on the map

      case 1:
        const wallCentersData = visualizationData?.wallCenters
          ?.map((center, index) => ({ center, originalIndex: index }))
          .filter(item => !(item.center.x === 1 && item.center.y === 1 && item.center.z === 1)) || [];
        if (userRole === 'geruestbauer') {
          return (
            <GeruestCalculationSlide
              data={geruestData}
              onChange={setGeruestData}
            />
          );
        }
        return (
          <WallSelectionSlide
            selectedWalls={selectedWalls}
            onWallSelectionChange={setSelectedWalls}
            windowShare={windowShare || 15}
            directionWindowShares={directionWindowShares}
            onDirectionWindowSharesChange={setDirectionWindowShares}
            lod2Id={lod2Id}
            formData={formData}
            wallCentersData={wallCentersData}
          />
        );

      case 2:
        if (userRole === 'geruestbauer') {
          return (
            <GeruestSelectionSlide
              selectedWalls={selectedWalls}
              onWallSelectionChange={setSelectedWalls}
              windowShare={windowShare || 15}
            />
          );
        }
        return (
          <WindowShareSlide
            selectedWallsInfo={selectedWallsInfo}
            directionWindowShares={directionWindowShares}
            onDirectionWindowSharesChange={setDirectionWindowShares}
            lod2Id={lod2Id || undefined}
            accessToken={session?.access_token || ''}
            onAllFacadesReady={setAllFacadesReady}
          />
        )
        
      case 3:
        const pdfProps = {
          walls: selectedWallsInfo,
          windowShare: windowShare || 15,
          selectedCount: selectedWalls.length,
          maxHeight: maxHeightOverall,
          groundPerimeter: groundPerimeter,
          totalArea: totalArea,
          totalWindowArea: totalWindowArea,
          totalWallArea: totalWallArea,
          pricePerSqm: pricePerSqm,
          safetyMargin: safetyMargin,
          additionalCosts: additionalCosts,
          totalPrice: totalPrice,
          logoUrl: whitelabelData?.logo_url,
          address: addressString,
        };
        return (
          <PriceCalculation
            totalWallArea={totalWallArea}
            pricePerSqm={pricePerSqm}
            onPricePerSqmChange={setPricePerSqm}
            safetyMargin={safetyMargin}
            onSafetyMarginChange={setSafetyMargin}
            additionalCosts={additionalCosts}
            onAdditionalCostsChange={setAdditionalCosts}
            userId={session?.user?.id || ''}
            accessToken={session?.access_token || ''}
            userRole={userRole}
            pdfProps={pdfProps}
          />
        );
      default:
        return null;
    }
  };

  const renderRightPanel = () => {
    if (currentSlide === 0) {
      const mapAddress = isFormValid() ? {
        Street: formData.street,
        House_number: formData.number,
        City: formData.city,
        State: formData.state,
        Country: formData.country
      } : undefined;

      const handleStart = () => {
        if (!canProceedFromSlide(0)) {
          return;
        }
        
        // Check if user is authenticated
        if (!session || session.user.is_anonymous) {
          // Store address data in localStorage before redirecting to signup
          const addressData = {
            street: formData.street,
            number: formData.number,
            city: formData.city,
            state: formData.state,
            country: formData.country,
            clickedCoordinates: clickedCoordinates
          };
          localStorage.setItem('pendingAddressData', JSON.stringify(addressData));
          
          // Redirect to signup page
          router.push('/signup');
        } else {
          // User is authenticated, proceed with address submission
          if (handleSubmit) {
            handleSubmit();
          }
        }
      };

      return (
        <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
          <SmartAddressForm
            onAddressChange={setParsedAddress}
            onAddressParsed={(addressData) => {
              // Convert parsed address data to form data format
              handleInputChange({ target: { name: 'street', value: addressData.street } } as any);
              handleInputChange({ target: { name: 'number', value: addressData.number } } as any);
              handleInputChange({ target: { name: 'city', value: addressData.city } } as any);
              handleInputChange({ target: { name: 'state', value: addressData.state } } as any);
              handleInputChange({ target: { name: 'country', value: addressData.country } } as any);
            }}
            clearSignal={clearSuggestionSignal}
            onStart={handleStart}
            canStart={canProceedFromSlide(0)}
            loadingStart={loading}
            clickedAddress={clickedAddressFromMap}
          />
        <div className="map-wrapper-slide-0" style={{ flex: 1, display: 'flex' }}>
          <MapContainer
            coordinates={coordinates || undefined}
            address={mapAddress}
              parsedAddress={parsedAddress || undefined}
              onCoordinateClick={(coords) => {
                setClickedCoordinates(coords);
                setClearSuggestionSignal((v) => v + 1);
              }}
              onBuildingMarked={() => setClearSuggestionSignal((v) => v + 1)}
              onManualMapClick={(address) => {
                setClickedAddressFromMap(address);
              }}
            />
        </div>
          
        </div>
      );
    } else if (currentSlide === 3) {
      return (
        <PauschalResults
          wallsInfo={wallsInfo}
          selectedWalls={selectedWalls}
          windowShare={windowShare || 15}
          directionWindowShares={directionWindowShares}
          groundPerimeter={groundPerimeter}
          totalArea={totalArea}
          totalWindowArea={totalWindowArea}
          totalWallArea={totalWallArea}
          maxHeightOverall={maxHeightOverall}
          totalPrice={totalPrice}
          pricePerSqm={pricePerSqm}
          safetyMargin={safetyMargin}
          additionalCosts={additionalCosts}
          logoUrl={whitelabelData?.logo_url}
          address={addressString}
          userRole={userRole}
        />
      );
    } else {
      return (
        <div className="ww-viewer-container" style={{
          backgroundColor: 'var(--foreground)',
          borderRadius: 8,
          overflow: 'hidden',
          flex: 1,
          display: 'flex',
          height: '100%',
          position: 'relative',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ccc',
          border: 'none'
        }}>
          {loadingVisualization ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '20px'
            }}>
              <video
                autoPlay
                loop
                muted
                playsInline
                style={{
                  width: 120,
                  height: 120,
                  objectFit: 'contain',
                  pointerEvents: 'none',
                  background: 'transparent'
                }}
              >
                <source src="/HouseAnimation.webm" type="video/webm" />
              </video>
              <div style={{ fontSize: '1.1em', color: '#ccc' }}>
                Lade Gebäudemodell...
              </div>
            </div>
          ) : visualizationData ? (
            <BuildingViewerContainer
              visualizationData={visualizationData}
              currentSlide={currentSlide}
              selectedWalls={selectedWalls}
              geruestWidth={geruestData.width}
              eaveHeightDifference={geruestData.eave_height_difference}
              userRole={userRole}
              lod2Id={lod2Id}
              wallsCount={wallsInfo.length}
              onSelectAllClick={() => {
                if (selectedWalls.length === wallsInfo.length) {
                  setSelectedWalls([]);
                } else {
                  setSelectedWalls(wallsInfo.map(wall => wall.wallIndex));
                }
              }}
              onWallClick={(wallIndex) => {
                setSelectedWalls(prev => 
                  prev.includes(wallIndex) 
                    ? prev.filter(w => w !== wallIndex)
                    : [...prev, wallIndex]
                );
              }}
              selectedNeighbours={selectedNeighbours}
              selectedSurroundingBuildings={selectedSurroundingBuildings}
              onNeighbourClick={(index) => {
                  setSelectedNeighbours(prev => {
                    const newState = prev.includes(index) 
                      ? prev.filter(i => i !== index)
                      : [...prev, index];
                    console.log("Selected Neighbours:", newState);
                    return newState;
                  });
              }}
              onSurroundingBuildingClick={(index) => {
                  setSelectedSurroundingBuildings(prev => {
                    const newState = prev.includes(index) 
                      ? prev.filter(i => i !== index)
                      : [...prev, index];
                    console.log("Selected Surrounding Buildings:", newState);
                    return newState;
                  });
              }}
              isMainBuildingSelected={mainBuildingSelected}
              onMainBuildingClick={() => setMainBuildingSelected(prev => !prev)}
              onUpdateSelection={() => {
                console.log("Expanding selection with LOD2 IDs:", selectedLOD2Ids);
                handleBuildingExpansion(selectedLOD2Ids);
                // Clear selections after triggering expansion
                setSelectedNeighbours([]);
                setSelectedSurroundingBuildings([]);
                setMainBuildingSelected(false);
              }}
            />
          ) : (
            <div>Ihr Gebäude konnte nicht geladen werden. Überprüfen Sie, ob auf der Karte tatsächlich ein Gebäude markiert ist und beachten Sie den Hinweis im Adressfeld, falls Ihre Region noch nicht verfügbar ist.</div>
          )}
        </div>
      );
    }
  };

  return (
    <>
      <style jsx>{`
        @media (max-width: 768px) {
          .two-column-container {
            flex-direction: column !important;
            height: 100% !important; /* Ensure it uses parent height */
          }
          .left-column, .right-column {
            max-width: 100% !important;
            min-height: 0 !important; /* Allow shrinking */
          }
          /* Swap order on mobile: visualization on top, forms on bottom */
          .left-column {
            order: 2 !important;
            flex: 1 !important; /* Bottom part fills available space */
          }
          .right-column {
            order: 1 !important;
            flex: none !important; /* Top part has fixed height */
            height: 30vh !important; /* Reduced height for visualization */
          }
         /* Ensure inner scroll area in left column can scroll while fitting viewport */
         .left-column > div:first-child { /* content scroll area */
           overflow: auto !important;
         }

         /* Limit map height on slide 0 to 75% of screen height */
         :global(.map-wrapper-slide-0) {
           height: 75vh !important;
           flex: none !important; /* Disable flex-grow on mobile */
           max-height: 75vh !important;
         }
         
         /* Override MapContainer flex behavior on mobile */
         :global(.map-wrapper-slide-0) > div {
           flex: none !important;
           height: 100% !important;
         }

         /* Allow mapbox container to shrink on small screens */
         :global(.map-container) {
           min-height: 0 !important;
         }

         /* Fix navigation bar to bottom on mobile */
         .left-column > div:last-child {
           position: fixed !important;
           bottom: 0 !important;
           left: 0 !important;
           right: 0 !important;
           z-index: 1000 !important;
           background: var(--foreground) !important;
           box-shadow: 0 -2px 10px rgba(0,0,0,0.1) !important;
           margin: 0 !important;
           border-radius: 0 !important;
         }

         /* Add padding to content area to account for fixed navigation */
         .left-column > div:first-child {
           padding-bottom: 120px !important; /* Space for fixed navigation */
         }
        }
      `}</style>
      <main 
        style={{ 
          height: "100vh", 
          display: "flex", 
          flexDirection: "column",
          backgroundColor: "var(--background)",
          overflow: "hidden"
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && canProceed && currentSlide !== totalSlides - 1) {
            e.preventDefault();
            if (currentSlide === 0 && handleSubmit) {
              handleSubmit();
            }
            handleNextWithUpload();
          }
        }}
        tabIndex={0} // Make the main element focusable to receive keyboard events
      >
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          padding: "10px 20px 0 20px",
          flexShrink: 0
        }}>
          <button
            onClick={() => {
              if (whitelabelData?.slug) {
                router.push(`/?p=${whitelabelData.slug}`);
              } else {
                router.push('/');
              }
            }}
            style={{
              backgroundColor: "var(--base-col1)",
              color: "white",
              borderColor: "var(--bordercolor)",
              borderWidth: "1px",
              padding: "8px 16px",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Zur Startseite
          </button>
          <div style={{ position: 'relative', minHeight: '30px' }}>
            <img 
              src={whitelabelData?.logo_url || "/wattwert.ico"} 
              alt={whitelabelData?.name || "Wattwert Logo"} 
              style={{ height: '40px' }} 
            />
          </div>
          {/* Removed sign-in/out UI; always anonymous */}
        </div>

        <div className={currentSlide === 0 ? '' : 'two-column-container'} style={{
          flex: 1,
          display: "flex",
          padding: currentSlide === 0 ? "10px 20px 10px 20px" : "10px 20px 10px 20px",
          gap: currentSlide === 0 ? "0" : "20px",
          overflow: "hidden"
        }}>
          {currentSlide === 0 ? (
            // Full-width layout for slide 0
            <div style={{ 
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              position: "relative"
            }}>
              {renderRightPanel()}
              {/* No footer navigation on slide 0 */}
            </div>
          ) : (
            // Two-column layout for other slides
            <>
          <div className="left-column" style={{ 
            flex: 1,
            maxWidth: '33.33%',
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}>
            <div style={{ 
              flex: 1,
              overflow: "auto"
            }}>
              {renderSlideContent()}
            </div>

            <div style={{ flexShrink: 0 }}>
              <SlideNavigation
                currentSlide={currentSlide}
                totalSlides={totalSlides}
                displayTotalSlides={totalSlides}
                onPrevious={handlePreviousSlide}
                onNext={handleNextWithUpload}
                onSubmit={handleSubmit}
                canProceed={canProceed}
                loading={currentSlide === 0 ? loading : false}
                walls={selectedWallsInfo}
                windowShare={windowShare || 15}
                directionWindowShares={directionWindowShares}
                selectedCount={selectedWalls.length}
                maxHeightOverall={maxHeightOverall}
                groundPerimeter={groundPerimeter}
                totalArea={totalArea}
                totalWindowArea={totalWindowArea}
                totalWallArea={totalWallArea}
                pricePerSqm={pricePerSqm}
                safetyMargin={safetyMargin}
                additionalCosts={additionalCosts}
                totalPrice={totalPrice}
                logoUrl={whitelabelData?.logo_url}
                address={addressString}
                userId={session?.user?.id}
                accessToken={session?.access_token}
                userRole={userRole}
              />
            </div>
          </div>

          <div className="right-column" style={{ 
                flex: 2,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}>
            {renderRightPanel()}
          </div>
            </>
          )}
        </div>
      </main>
    </>
  );
}
