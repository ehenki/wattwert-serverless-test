'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { getCardinalDirection } from '../../helpers/directionUtils';
import { wallCenterIndexToFacadeId } from '../../helpers/directionUtils';
import { checkFacadeSegmentationStatus, checkFacadePhotoStatus, fetchBuildingImages } from '../database/ImageDownloader';
import { getFacadeData } from '../database/getFacadeData';
import FacadeWidget from './slide_elements/FacadeWidget';
import Tooltip from '../ui/Tooltip';
import styles from './Tooltip.module.css';

interface WindowShareSlideProps {
  selectedWallsInfo: Array<{
    wallIndex: number;
    area: number;
    maxHeight: number;
    direction?: string;
  }>;
  directionWindowShares: Record<string, number>;
  onDirectionWindowSharesChange: (shares: Record<string, number>) => void;
  lod2Id?: string;
  accessToken?: string;
  onAllFacadesReady?: (ready: boolean) => void;
}

export default function WindowShareSlide({ 
  selectedWallsInfo,
  directionWindowShares,
  onDirectionWindowSharesChange,
  lod2Id,
  accessToken,
  onAllFacadesReady
}: WindowShareSlideProps) {
  const [processingFacades, setProcessingFacades] = useState<Record<string, boolean>>({});
  const [segmentedFacades, setSegmentedFacades] = useState<Record<string, boolean>>({});
  const [windowCounts, setWindowCounts] = useState<Record<string, number>>({});
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  // Get unique directions from selected walls
  const uniqueDirections = useMemo(() => 
    Array.from(new Set(selectedWallsInfo.map(wall => wall.direction).filter(Boolean))) as string[]
  , [selectedWallsInfo]);

  // Load photo status on mount and when lod2Id changes
  useEffect(() => {
    if (lod2Id) {
      
      // Fetch photo status
      checkFacadePhotoStatus(lod2Id)
        .then(status => {
          setProcessingFacades(status);
          console.log('[WindowShareSlide] Photo status loaded:', status);
        })
        .catch(error => {
          console.error('[WindowShareSlide] Error loading photo status:', error);
          setProcessingFacades({});
        })
        .finally(() => setIsLoadingStatus(false));
      
      // Fetch image URLs
      fetchBuildingImages(lod2Id)
        .then(urls => {
          setImageUrls(urls);
          console.log('[WindowShareSlide] Image URLs loaded:', urls);
        })
        .catch(error => {
          console.error('[WindowShareSlide] Error loading image URLs:', error);
          setImageUrls({});
        })
        .finally(() => setIsLoadingStatus(false));
    }
  }, [lod2Id]);

  // Poll segmentation status every 2 seconds when photos are being processed
  useEffect(() => {
    if (!lod2Id) return;

    // Initial check
    checkFacadeSegmentationStatus(lod2Id)
      .then(status => {
        setSegmentedFacades(status);
        console.log('[WindowShareSlide] Segmentation status loaded:', status);
      })
      .catch(error => {
        console.error('[WindowShareSlide] Error loading segmentation status:', error);
      });

    // Set up interval for polling
    const intervalId = setInterval(() => {
      checkFacadeSegmentationStatus(lod2Id)
        .then(status => {
          setSegmentedFacades(status);
          console.log('[WindowShareSlide] Segmentation status polled:', status);
        })
        .catch(error => {
          console.error('[WindowShareSlide] Error polling segmentation status:', error);
        });
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(intervalId);
  }, [lod2Id]);

  // Fetch WWR when a facade becomes segmented and then every 20 seconds
  useEffect(() => {
    if (!lod2Id || !accessToken) return;

    const fetchWWRForSegmented = async () => {
      let hasChanges = false;
      const updatedShares = { ...directionWindowShares };
      const updatedCounts = { ...windowCounts };

      for (const direction of uniqueDirections) {
        const facadeId = getFacadeIdForDirection(direction);
        if (segmentedFacades[facadeId]) {
          console.log(`[WindowShareSlide] Fetching/Refreshing WWR for ${direction} (facade_id: ${facadeId})...`);
          const result = await getFacadeData(lod2Id, facadeId, accessToken);
          
          if (result.success && result.data) {
            // Update WWR
            if (result.data.wwr !== undefined && result.data.wwr !== null) {
              const wwrPercentage = Math.round(result.data.wwr * 100);
              
              if (updatedShares[direction] !== wwrPercentage) {
                console.log(`[WindowShareSlide] WWR updated for ${direction}: ${wwrPercentage}%`);
                updatedShares[direction] = wwrPercentage;
                hasChanges = true;
              }
            }
            
            // Update window count
            if (result.data.window_count !== undefined && result.data.window_count !== null) {
              if (updatedCounts[direction] !== result.data.window_count) {
                console.log(`[WindowShareSlide] Window count updated for ${direction}: ${result.data.window_count}`);
                updatedCounts[direction] = result.data.window_count;
                hasChanges = true;
              }
            }
          }
        }
      }

      if (hasChanges) {
        onDirectionWindowSharesChange(updatedShares);
        setWindowCounts(updatedCounts);
      }
    };

    // Immediate fetch when segmentedFacades changes
    fetchWWRForSegmented();

    // Set up 5 second interval for recurring updates
    const intervalId = setInterval(fetchWWRForSegmented, 5000);

    return () => clearInterval(intervalId);
  }, [segmentedFacades, lod2Id, accessToken, uniqueDirections]);

  // Check if all facades are ready (not in processing state)
  useEffect(() => {
    if (!onAllFacadesReady) return;

    const allReady = uniqueDirections.every(direction => {
      const facadeId = getFacadeIdForDirection(direction);
      const isProcessing = processingFacades[facadeId];
      const isSegmented = segmentedFacades[facadeId];
      
      // Ready if either: not processing at all (manual), or segmented (completed)
      return !isProcessing || isSegmented;
    });

    onAllFacadesReady(allReady);
  }, [processingFacades, segmentedFacades, uniqueDirections, onAllFacadesReady]);

  const handleDirectionWindowShareChange = (direction: string, value: number) => {
    onDirectionWindowSharesChange({
      ...directionWindowShares,
      [direction]: value
    });
  };

  // Helper function to get facade_id for a direction
  const getFacadeIdForDirection = (direction: string): string => {
    const directionIndex = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].indexOf(direction);
    return String(wallCenterIndexToFacadeId(directionIndex));
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      padding: '20px',
      backgroundColor: 'var(--foreground)',
      borderRadius: 8,
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    }}>
      <h2 style={{ margin: 0, color: 'var(--fontcolor)', fontSize: 24 }}>Fensterflächenanteil pro Himmelsrichtung</h2>
      
      <style>{`
        input[type="number"] {
          -moz-appearance: textfield !important;
        }
        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button {
          -webkit-appearance: none !important;
          margin: 0 !important;
          display: none !important;
        }
      `}</style>

      <p style={{ margin: 0, color: 'var(--fontcolor)', fontSize: 14 }}>
        Wenn Sie Bilder für die Fassaden hochgeladen haben, wird hier der Fensterflächenanteil automatisch ermittelt. 
        Andernfalls können Sie den Fensterflächenanteil manuell anpassen.
        <Tooltip content="Der Fensterflächenanteil wird verwendet, um die tatsächliche Wandfläche (ohne Fenster) zu berechnen." position="left">
          <span className={styles.tooltipIcon}>?</span>
        </Tooltip>
      </p>

      <div style={{ 
        display: 'flex',
        flexDirection: 'column',
        gap: 12
      }}>
        {uniqueDirections.sort().map(direction => {
          const facadeId = getFacadeIdForDirection(direction);
          const isProcessing = processingFacades[facadeId];
          const isSegmented = segmentedFacades[facadeId];
          
          // Determine mode
          let mode: 'manual' | 'processing' | 'completed' = 'manual';
          if (isSegmented) {
            mode = 'completed';
          } else if (isProcessing) {
            mode = 'processing';
          }

          return (
            <FacadeWidget
              key={direction}
              direction={direction}
              mode={mode}
              windowShare={directionWindowShares[direction] !== undefined ? directionWindowShares[direction] : 15}
              windowCount={windowCounts[direction]}
              imageUrl={imageUrls[facadeId]}
              facadeId={facadeId}
              lod2Id={lod2Id}
              onWindowShareChange={(value) => handleDirectionWindowShareChange(direction, value)}
            />
          );
        })}
      </div>
    </div>
  );
}

