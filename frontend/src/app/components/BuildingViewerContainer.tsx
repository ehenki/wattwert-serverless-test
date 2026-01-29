import React from 'react';
import { BuildingViewer } from '@/app/components/BuildingViewer';
import { BuildingData } from '@/app/components/BuildingViewer/types';

interface BuildingViewerContainerProps {
  visualizationData: BuildingData | null;
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

const BuildingViewerContainer: React.FC<BuildingViewerContainerProps> = ({
  visualizationData,
  currentSlide,
  selectedColorKey,
  selectedWalls,
  onWallClick,
  geruestWidth,
  eaveHeightDifference,
  userRole,
  lod2Id,
  wallsCount = 0,
  onSelectAllClick,
  selectedNeighbours,
  selectedSurroundingBuildings,
  onNeighbourClick,
  onSurroundingBuildingClick,
  onUpdateSelection,
  isMainBuildingSelected,
  onMainBuildingClick
}) => {
  return (
    <div style={{
      backgroundColor: '#252525',
      borderRadius: 8,
      overflow: 'hidden',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      minHeight: '500px', // Ensure minimum usable height
      position: 'relative' // Added for absolute positioning of children
    }}>
      {visualizationData ? (
        <div style={{
          flex: 1,
          position: 'relative'
        }}>
          <BuildingViewer 
            data={visualizationData} 
            currentSlide={currentSlide} 
            selectedColorKey={selectedColorKey}
            selectedWalls={selectedWalls}
            onWallClick={onWallClick}
            geruestWidth={geruestWidth}
            eaveHeightDifference={eaveHeightDifference}
            userRole={userRole}
            lod2Id={lod2Id}
            wallsCount={wallsCount}
            onSelectAllClick={onSelectAllClick}
            selectedNeighbours={selectedNeighbours}
            selectedSurroundingBuildings={selectedSurroundingBuildings}
            onNeighbourClick={onNeighbourClick}
            onSurroundingBuildingClick={onSurroundingBuildingClick}
            onUpdateSelection={onUpdateSelection}
            isMainBuildingSelected={isMainBuildingSelected}
            onMainBuildingClick={onMainBuildingClick}
          />
        </div>
      ) : (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          color: '#666',
          fontSize: 16,
          textAlign: 'center',
          padding: 20, 
          margin: 20
        }}>
          Ihr Gebäude konnte nicht geladen werden. Überprüfen Sie, ob auf der Karte tatsächlich ein Gebäude markiert ist und beachten Sie den Hinweis im Adressfeld, falls Ihre Region noch nicht verfügbar ist.
        </div>
      )}
    </div>
  );
};

export default BuildingViewerContainer; 