// frontend/src/components/BuildingViewer/index.tsx
import { Canvas } from '@react-three/fiber';
import { Grid, Stats } from '@react-three/drei';
import { Building } from './Building';
import { Compass } from './Compass';
import { Controls } from './Controls';
import { BuildingData } from './types';
import { COLORS } from '@/app/components/slides/ColorSelectionSlide';
import { useEffect, useState, useRef } from 'react';
import { Vector3 } from 'three';
import PopUp from '../ui/PopUp';
import DatenquellenPopUp from '../PopUps/DatenquellenPopUp';

interface BuildingViewerProps {
  data: BuildingData;
  currentSlide: number;
  selectedColorKey?: string;
  selectedWalls?: number[];
  onWallClick?: (wallIndex: number) => void;
  geruestWidth?: number;
  eaveHeightDifference?: number;
  userRole?: string | null;
  lod2Id?: string | null;
  wallsCount?: number;
  onSelectAllClick?: () => void;
  selectedNeighbours?: number[];
  selectedSurroundingBuildings?: number[];
  onNeighbourClick?: (index: number) => void;
  onSurroundingBuildingClick?: (index: number) => void;
  onUpdateSelection?: () => void;
  isMainBuildingSelected?: boolean;
  onMainBuildingClick?: () => void;
}

export function BuildingViewer({ data, currentSlide, selectedColorKey, selectedWalls, onWallClick, geruestWidth, eaveHeightDifference, userRole, lod2Id, wallsCount = 0, onSelectAllClick, selectedNeighbours, selectedSurroundingBuildings, onNeighbourClick, onSurroundingBuildingClick, onUpdateSelection, isMainBuildingSelected, onMainBuildingClick }: BuildingViewerProps) {
  const [cameraPosition, setCameraPosition] = useState<[number, number, number]>([20, 20, 20]);
  const [showDimensions, setShowDimensions] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isBuildingSelectionMode, setIsBuildingSelectionMode] = useState<boolean>(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  
  const wallColor = (() => {
    if (selectedColorKey) {
      const found = COLORS.find(c => c.key === selectedColorKey);
      if (found) return found.rgb;
    }
    return '#bbbbbb';
  })();

  useEffect(() => {
    // Calculate bounding box of all vertices
    const allVertices = [
      ...data.walls.flatMap(w => w.vertices),
      ...data.roofs.flatMap(r => r.vertices)
    ];
    
    if (allVertices.length > 0) {
      const minX = Math.min(...allVertices.map(v => v.x));
      const maxX = Math.max(...allVertices.map(v => v.x));
      const minY = Math.min(...allVertices.map(v => v.y));
      const maxY = Math.max(...allVertices.map(v => v.y));
      const minZ = Math.min(...allVertices.map(v => v.z));
      const maxZ = Math.max(...allVertices.map(v => v.z));
      
      // Calculate diagonal length for camera distance
      const diagonal = Math.sqrt(
        Math.pow(maxX - minX, 2) + 
        Math.pow(maxY - minY, 2) + 
        Math.pow(maxZ - minZ, 2)
      );
      
      // Position camera at an angle, distance based on building size
      const distance = 30; // Fixed distance since we're normalizing coordinates
      setCameraPosition([distance, distance, distance]);
    }
  }, [data]);

  useEffect(() => {
    // Reset building selection mode when slide changes
    setIsBuildingSelectionMode(false);
  }, [currentSlide]);

  // Handle drag state and cursor changes
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container) return;

    const handleMouseDown = (e: MouseEvent) => {
      // Only track left mouse button (button 0)
      if (e.button === 0) {
        setIsDragging(true);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleMouseLeave = () => {
      setIsDragging(false);
      // Reset cursor when leaving the container
      document.body.style.cursor = '';
    };

    const handleMouseEnter = () => {
      // Set grab cursor when entering the container (if not already set by wall hover)
      if (document.body.style.cursor !== 'pointer') {
        document.body.style.cursor = isDragging ? 'grabbing' : 'grab';
      }
    };

    const handleMouseMove = () => {
      // Update cursor during movement (if not over a wall)
      if (document.body.style.cursor !== 'pointer') {
        document.body.style.cursor = isDragging ? 'grabbing' : 'grab';
      }
    };

    container.addEventListener('mousedown', handleMouseDown);
    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('mouseleave', handleMouseLeave);

    // Initial cursor setup
    if (document.body.style.cursor !== 'pointer') {
      document.body.style.cursor = isDragging ? 'grabbing' : 'grab';
    }

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('mouseleave', handleMouseLeave);
      // Clean up cursor on unmount
      document.body.style.cursor = '';
    };
  }, [isDragging]);

  // Colors for wall center markers
  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
  const isSelectAllVisible = currentSlide === 3 && wallsCount > 0;

  return (
    <div ref={canvasContainerRef} style={{ width: '100%', height: '100%', minHeight: '500px', position: 'relative' }}>
      {/* Select All / Deselect All Button - Top Left on Slide 2 */}
      {((userRole === "geruestbauer" && currentSlide === 2) || (userRole !== "geruestbauer" && currentSlide === 1)) && (
        <button
          onClick={onSelectAllClick}
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            padding: '8px 16px',
            backgroundColor: (selectedWalls?.length === wallsCount) ? '#f5f5f5' : 'var(--base-col1)',
            color: (selectedWalls?.length === wallsCount) ? '#333' : 'white',
            border: (selectedWalls?.length === wallsCount) ? '1px solid #ccc' : 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500,
            transition: 'all 0.2s ease',
            zIndex: 1000
          }}
          onMouseEnter={(e) => {
            if ((selectedWalls?.length === wallsCount)) {
              e.currentTarget.style.backgroundColor = '#e0e0e0';
            } else {
              e.currentTarget.style.opacity = '0.9';
            }
          }}
          onMouseLeave={(e) => {
            if ((selectedWalls?.length === wallsCount)) {
              e.currentTarget.style.backgroundColor = '#f5f5f5';
            } else {
              e.currentTarget.style.opacity = '1';
            }
          }}
        >
          {(selectedWalls?.length === wallsCount) ? 'Alle abwählen' : 'Alle auswählen'}
        </button>
      )}

      {/* Reset View Button */}
      <button
        onClick={() => {
          if (window.resetCameraView) {
            window.resetCameraView();
          }
        }}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 1000,
          padding: '8px 16px',
          backgroundColor: '#ffffff',
          color: 'var(--base-col1)',
          border: '1px solid var(--base-col1)',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'normal',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          transition: 'background 0.3s'
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.backgroundColor = '#8977FD';
          e.currentTarget.style.color = '#ffffff';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.backgroundColor = '#eeeeee';
          e.currentTarget.style.color = 'var(--base-col1)';
        }}
      >
        Ansicht zurücksetzen
      </button>

      {/* Show Dimensions Checkbox */}
      <label
        style={{
          position: 'absolute',
          top: '50px',
          right: '10px',
          zIndex: 1000,
          padding: '8px 16px',
          backgroundColor: 'transparent',
          color: 'var(--fontcolor)',
          fontSize: '14px',
          fontWeight: 'normal',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
      >
        <input
          type="checkbox"
          checked={showDimensions}
          onChange={(e) => setShowDimensions(e.target.checked)}
          style={{ cursor: 'pointer' }}
        />
        Maße anzeigen
      </label>

      {/* Building Selection Mode Button */}
      {currentSlide === 1 && (
        <button
          onClick={() => {
            if (isBuildingSelectionMode && onUpdateSelection) {
              onUpdateSelection();
            }
            setIsBuildingSelectionMode(prev => !prev);
          }}
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1000,
            padding: '8px 16px',
            backgroundColor: isBuildingSelectionMode ? 'var(--base-col1)' : '#ffffff',
            color: isBuildingSelectionMode ? '#ffffff' : 'var(--base-col1)',
            border: '1px solid var(--base-col1)',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 500,
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            transition: 'all 0.2s ease',
            whiteSpace: 'nowrap'
          }}
          onMouseEnter={(e) => {
            if (!isBuildingSelectionMode) {
                e.currentTarget.style.backgroundColor = '#f5f5f5';
            }
          }}
          onMouseLeave={(e) => {
            if (!isBuildingSelectionMode) {
                e.currentTarget.style.backgroundColor = '#ffffff';
            }
          }}
        >
          {isBuildingSelectionMode ? "Auswahl aktualisieren" : "Gebäude erweitern/ändern"}
        </button>
      )}

            {/* Datenquellen link in lower right corner */}
            <div style={{
        position: 'absolute',
        bottom: '18px',
        right: '10px',
        zIndex: 1000,
      }}>
        <PopUp content={<DatenquellenPopUp />} size="large">
          <span style={{
            color: 'var(--fontcolor)',
            fontSize: '12px',
            textDecoration: 'underline',
            cursor: 'pointer',
            opacity: 0.7
          }}>
            Datenquellen
          </span>
        </PopUp>
      </div>

      <Canvas
        camera={{
          position: cameraPosition,
          fov: 50,
          near: 0.1,
          far: 1000
        }}
        style={{ background: 'var(--foreground)' }}
      >
        {/* Lights */}
        <ambientLight intensity={1} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        <directionalLight position={[-10, -10, -5]} intensity={1} />

        {/* Scene */}
        <Building 
          data={data} 
          currentSlide={currentSlide} 
          showDimensions={showDimensions} 
          wallColor={wallColor}
          selectedWalls={selectedWalls}
          onWallClick={onWallClick}
          geruestWidth={geruestWidth}
          eaveHeightDifference={eaveHeightDifference}
          userRole={userRole}
          lod2Id={lod2Id}
          selectedNeighbours={selectedNeighbours}
          selectedSurroundingBuildings={selectedSurroundingBuildings}
          onNeighbourClick={onNeighbourClick}
          onSurroundingBuildingClick={onSurroundingBuildingClick}
          selectionModeActive={isBuildingSelectionMode}
          isMainBuildingSelected={isMainBuildingSelected}
          onMainBuildingClick={onMainBuildingClick}
        />

        {/* Controls */}
        <Controls />

        {/* Compass */}
        <Compass />
      </Canvas>
    </div>
  );
}

export type { BuildingData } from './types';