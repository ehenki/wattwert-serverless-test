import React from 'react';

interface WallInfo {
  wallIndex: number;
  area: number;
  maxHeight: number;
  width: number;
}

interface GeruestSummaryProps {
  selectedCount: number;
  maxHeight: number;
  groundPerimeter: number;
  totalArea: number;
  selectedWalls?: WallInfo[];
}

export default function GeruestSummary({
  selectedCount,
  maxHeight,
  groundPerimeter,
  totalArea,
  selectedWalls = []
}: GeruestSummaryProps) {
  // Calculate total length of selected walls
  const total_length_walls = selectedWalls.reduce((sum, wall) => sum + (wall.width || 0), 0);
  return (
    <div style={{
      padding: '8px 16px 8px 16px',
      backgroundColor: '#f9f9f9',
      borderRadius: 0,
      borderTop: '1px solid var(--bordercolor)',
      borderBottom: '1px solid var(--bordercolor)',
      borderRight: '1px solid var(--bordercolor)',
      borderLeft: '4px solid var(--base-col1)',
    }}>
      <h3 style={{ margin: '0 0 4px 0', color: '#333', fontSize: 16 }}>
        Zusammenfassung
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#666' }}>Ausgewählte Wände:</span>
          <span style={{ fontWeight: 600, color: '#333' }}>{selectedCount}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#666' }}>Max. Gerüsthöhe:</span>
          <span style={{ fontWeight: 600, color: '#333' }}>{maxHeight.toFixed(1)} m</span>
        </div>
        <div style={{ height: '1px', backgroundColor: '#ddd', margin: '0 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#666' }}>Gesamt-Außenfläche Gerüst:</span>
          <span style={{ fontWeight: 600, color: '#333' }}>{totalArea.toFixed(1)} m²</span>
        </div>
      </div>
    </div>
  );
}

