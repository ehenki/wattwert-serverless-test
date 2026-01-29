'use client';
import React, { useEffect, useState } from 'react';
import eventBus from '../helpers/eventBus';
import GeruestTable from './slide_elements/GeruestTable';
import GeruestSummary from './slide_elements/GeruestSummary';
import Tooltip from '../ui/Tooltip';
import styles from './Tooltip.module.css';

interface WallInfo {
  wallIndex: number;
  area: number;
  maxHeight: number;
  width: number;
}

interface GeruestSelectionSlideProps {
  selectedWalls: number[];
  onWallSelectionChange: (selectedWalls: number[]) => void;
  windowShare: number;
}

export default function GeruestSelectionSlide({ 
  selectedWalls, 
  onWallSelectionChange,
  windowShare
}: GeruestSelectionSlideProps) {
  const [wallsInfo, setWallsInfo] = useState<WallInfo[]>([]);
  const [groundPerimeter, setGroundPerimeter] = useState<number>(0);

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

  const handleWallToggle = (wallIndex: number) => {
    const newSelection = selectedWalls.includes(wallIndex)
      ? selectedWalls.filter(w => w !== wallIndex)
      : [...selectedWalls, wallIndex];
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

  const totalArea = wallsInfo
    .filter(wall => selectedWalls.includes(wall.wallIndex))
    .reduce((sum, wall) => sum + wall.area, 0);

  // Calculate actual wall area (total area minus window share)
  const windowShareDecimal = windowShare / 100;
  const totalWallArea = totalArea * (1 - windowShareDecimal);
  const totalWindowArea = totalArea * windowShareDecimal;

  const maxHeightOverall = wallsInfo
    .filter(wall => selectedWalls.includes(wall.wallIndex))
    .reduce((max, wall) => Math.max(max, wall.maxHeight), 0);

  // Filter to only show selected walls
  const selectedWallsInfo = wallsInfo.filter(wall => selectedWalls.includes(wall.wallIndex));

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, color: 'var(--fontcolor)', fontSize: 24 }}>Gerüstdaten Auswahl</h2>
        {wallsInfo.length > 0 && (
          <button
            onClick={handleSelectAll}
            style={{
              padding: '8px 16px',
              backgroundColor: selectedWalls.length === wallsInfo.length ? '#f5f5f5' : 'var(--base-col1)',
              color: selectedWalls.length === wallsInfo.length ? '#333' : 'white',
              border: selectedWalls.length === wallsInfo.length ? '1px solid #ccc' : 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              if (selectedWalls.length === wallsInfo.length) {
                e.currentTarget.style.backgroundColor = '#e0e0e0';
              } else {
                e.currentTarget.style.opacity = '0.9';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedWalls.length === wallsInfo.length) {
                e.currentTarget.style.backgroundColor = '#f5f5f5';
              } else {
                e.currentTarget.style.opacity = '1';
              }
            }}
          >
            {selectedWalls.length === wallsInfo.length ? 'Alle abwählen' : 'Alle auswählen'}
          </button>
        )}
      </div>
      <p style={{ margin: 0, color: 'var(--fontcolor)', fontSize: 14 }}>
        Klicken Sie auf eine Wand im 3D-Modell, um sie auszuwählen und eine Repräsentation der Gerüst-Außenfläche zu erstellen.
        <Tooltip content="Unsere interaktiven 3D-Modelle werden aus sog. LOD2-Daten bezogen, die auf Laserdaten der jeweiligen Bundesländer basieren." position="top">
          <span className={styles.tooltipIcon}>?</span>
        </Tooltip>
      </p>

      {wallsInfo.length === 0 ? (
        <div style={{ color: '#999', fontSize: 14, fontStyle: 'italic' }}>
          Lade Wandinformationen...
        </div>
      ) : selectedWallsInfo.length === 0 ? (
        <div style={{ color: '#999', fontSize: 14, fontStyle: 'italic' }}>
          Keine Wände ausgewählt. Klicken Sie auf eine Wand im 3D-Modell, um sie auszuwählen.
        </div>
      ) : (
        <>
          <GeruestTable 
            geruest={selectedWallsInfo.map(w => ({
              geruestIndex: w.wallIndex,
              area: w.area,
              maxHeight: w.maxHeight
            }))}
            selectedWalls={selectedWalls} 
            onWallToggle={handleWallToggle} 
          />

          <GeruestSummary 
            selectedCount={selectedWalls.length}
            maxHeight={maxHeightOverall}
            groundPerimeter={groundPerimeter}
            totalArea={totalArea}
            selectedWalls={selectedWallsInfo}
          />
        </>
      )}
    </div>
  );
}
