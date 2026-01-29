'use client';
import React, { useEffect, useState } from 'react';
import eventBus from '../helpers/eventBus';
import WallTable from './slide_elements/WallTable';
import UploadedImagesDisplay from './slide_elements/UploadedImagesDisplay';
import Tooltip from '../ui/Tooltip';
import styles from './Tooltip.module.css';
import ImageUpload from '../database/ImageUpload';
import { fetchBuildingImages } from '../database/ImageDownloader';
import { getCardinalDirection } from '../../helpers/directionUtils';

interface WallInfo {
  wallIndex: number;
  area: number;
  maxHeight: number;
  direction?: string;
  vertices?: any[];
}

interface WallSelectionSlideProps {
  selectedWalls: number[];
  onWallSelectionChange: (selectedWalls: number[]) => void;
  windowShare: number;
  directionWindowShares: Record<string, number>;
  onDirectionWindowSharesChange: (shares: Record<string, number>) => void;
  lod2Id: string | null;
  formData: {
    street: string;
    number: string;
    city: string;
    state: string;
  };
  wallCentersData: { center: { x: number, y: number, z: number }, originalIndex: number }[];
}

export default function WallSelectionSlide({ 
  selectedWalls, 
  onWallSelectionChange,
  windowShare,
  directionWindowShares,
  onDirectionWindowSharesChange,
  lod2Id,
  formData,
  wallCentersData
}: WallSelectionSlideProps) {
  const [wallsInfo, setWallsInfo] = useState<WallInfo[]>([]);
  const [groundPerimeter, setGroundPerimeter] = useState<number>(0);
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    // Load existing images
    const loadImages = async () => {
      if (lod2Id) {
        const urls = await fetchBuildingImages(lod2Id);
        setImagePreviews(urls);
      }
    };
    loadImages();
  }, [lod2Id]);

  useEffect(() => {
    // Load existing images
    const loadImages = async () => {
      if (lod2Id) {
        const urls = await fetchBuildingImages(lod2Id);
        setImagePreviews(urls);
      }
    };
    loadImages();
  }, [lod2Id]);

  useEffect(() => {
    // Listen for wall info updates from the 3D viewer
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

    // Request initial wall info
    eventBus.dispatch('request-wall-info', {});

    return () => {
      eventBus.off('wall-info-update', handleWallInfo as EventListener);
    };
  }, []);

  useEffect(() => {
    // Listen for facade image uploads to refresh the image list
    const handleImageUpload = (event: Event) => {
      const loadImages = async () => {
        if (lod2Id) {
          const urls = await fetchBuildingImages(lod2Id);
          setImagePreviews(urls);
        }
      };
      loadImages();
    };

    eventBus.on('facade-image-uploaded', handleImageUpload as EventListener);

    return () => {
      eventBus.off('facade-image-uploaded', handleImageUpload as EventListener);
    };
  }, [lod2Id]);

  const handleWallToggle = (wallIndex: number) => {
    const isSelecting = !selectedWalls.includes(wallIndex);
    const newSelection = isSelecting
      ? [...selectedWalls, wallIndex]
      : selectedWalls.filter(w => w !== wallIndex);
    
    if (isSelecting) {
      const wall = wallsInfo.find(w => w.wallIndex === wallIndex);
    }

    onWallSelectionChange(newSelection);
  };

  const handleSelectAll = () => {
    if (selectedWalls.length === wallsInfo.length) {
      // If all are selected, deselect all
      onWallSelectionChange([]);
    } else {
      // Select all walls
      onWallSelectionChange(wallsInfo.map(wall => wall.wallIndex));
    }
  };

  const handleImageSelect = (file: File, number: number) => {
    console.log(`Selected file for wall ${number}:`, file.name);
  };

  const isFormValid = () => {
    return formData.street && formData.number && formData.city && formData.state;
  };

  const getAddressString = () => {
    if (!isFormValid()) return "Bild hochladen";
    return `${formData.street} ${formData.number}, ${formData.city}, ${formData.state}`;
  };

  // Get unique directions from selected walls
  const selectedWallsInfo = wallsInfo.filter(wall => selectedWalls.includes(wall.wallIndex));
  const uniqueDirections = Array.from(new Set(selectedWallsInfo.map(wall => wall.direction).filter(Boolean))) as string[];
  
  // Initialize direction window shares with default 15% for new directions
  useEffect(() => {
    const newShares = { ...directionWindowShares };
    let hasChanges = false;
    
    uniqueDirections.forEach(direction => {
      if (!(direction in newShares)) {
        newShares[direction] = 15;
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      onDirectionWindowSharesChange(newShares);
    }
  }, [uniqueDirections.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDirectionWindowShareChange = (direction: string, value: number) => {
    onDirectionWindowSharesChange({
      ...directionWindowShares,
      [direction]: value
    });
  };

  // Calculate totals with direction-specific window shares
  const totalArea = selectedWallsInfo.reduce((sum, wall) => sum + wall.area, 0);
  
  const totalWindowArea = selectedWallsInfo.reduce((sum, wall) => {
    const share = directionWindowShares[wall.direction || ''] || 15;
    return sum + (wall.area * share / 100);
  }, 0);
  
  const totalWallArea = totalArea - totalWindowArea;

  const maxHeightOverall = selectedWallsInfo.reduce((max, wall) => Math.max(max, wall.maxHeight), 0);

  return (
    <>
      {/* Hidden Image Upload Components - Only activated via 3D view buttons */}
      <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        {wallCentersData.map((item, idx) => (
          <ImageUpload
            key={idx}
            onImageSelect={(file) => handleImageSelect(file, idx + 1)}
            number={getCardinalDirection(item.originalIndex)}
            originalIndex={item.originalIndex}
            title={getAddressString()}
            ID_LOD2={lod2Id || undefined}
            initialPreviewUrl={imagePreviews[(item.originalIndex + 1).toString()]}
          />
        ))}
      </div>

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

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        padding: '20px',
        backgroundColor: 'var(--foreground)',
        borderRadius: 8,
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, color: 'var(--fontcolor)', fontSize: 24 }}>Wandauswahl & Fotoupload</h2>
        </div>
      <p style={{ margin: 0, color: 'var(--fontcolor)', fontSize: 14 }}>
        Klicken Sie auf eine Wand im 3D-Modell, um sie auszuwählen.
        <Tooltip content="Unsere interaktiven 3D-Modelle werden aus sog. LOD2-Daten bezogen, die auf Laserdaten der jeweiligen Bundesländer basieren." position="right">
          <span className={styles.tooltipIcon}>?</span>
        </Tooltip>
        <br />
        Laden Sie anschließend Fotos der Fassaden hoch, falls verfügbar.
        <Tooltip content="Unsere Bilderkennung identifiziert aus Fassadenbildern automatisch Bestandteile der Fassade. Am besten funktionieren Fotos, die frontal aus der jeweiligen Himmelsrichtung von der Fassade aufgenommen werden." position="right">
          <span className={styles.tooltipIcon}>?</span>
        </Tooltip>
      </p>

      {/* Direction-specific window share inputs */}
      {/* Moved to WindowShareSlide.tsx */}

      {wallsInfo.length === 0 ? (
          <div style={{ color: '#999', fontSize: 14, fontStyle: 'italic' }}>
            Lade Wandinformationen...
          </div>
        ) : selectedWallsInfo.length === 0 ? (
          <div style={{ color: '#999', fontSize: 14, fontStyle: 'italic' }}>
            Keine Wände ausgewählt. Klicken Sie auf eine Wand im 3D-Modell, um sie auszuwählen.
          </div>
        ) : (
          <UploadedImagesDisplay 
            selectedWalls={selectedWallsInfo}
            imageUrls={imagePreviews}
            lod2Id={lod2Id}
          />
        )}
      </div>
    </>
  );
}
