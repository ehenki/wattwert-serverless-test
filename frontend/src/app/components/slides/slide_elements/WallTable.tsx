import React from 'react';

interface WallInfo {
  wallIndex: number;
  area: number;
  maxHeight: number;
  width: number;
  direction?: string;
}

interface WallTableProps {
  walls: WallInfo[];
  windowShare: number;
  directionWindowShares?: Record<string, number>;
  selectedWalls?: number[];
  onWallToggle?: (wallIndex: number) => void;
  isReadOnly?: boolean;
}

export default function WallTable({
  walls,
  windowShare,
  directionWindowShares = {},
  selectedWalls = [],
  onWallToggle,
  isReadOnly = false
}: WallTableProps) {

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        backgroundColor: 'white',
        borderRadius: 0,
        border: '1px solid var(--bordercolor)',
        overflow: 'hidden',
      }}>
        <thead>
          <tr style={{
            backgroundColor: '#f5f5f5',
            borderBottom: '2px solid #e0e0e0'
          }}>
            <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 600, color: '#333', fontSize: 14 }}>Wand</th>
            <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 600, color: '#333', fontSize: 14 }}>Fassadenfläche</th>
            <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 600, color: '#333', fontSize: 14 }}>Wandfläche</th>
            <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 600, color: '#333', fontSize: 14 }}>Höhe</th>
          </tr>
        </thead>
        <tbody>
          {walls.map((wall) => {
            // Use direction-specific window share if available, otherwise fall back to global windowShare (defaulting to 15% if both are missing/0)
            const windowShareForWall = wall.direction && directionWindowShares[wall.direction] !== undefined
              ? directionWindowShares[wall.direction]
              : (windowShare || 15);
            const windowShareDecimal = windowShareForWall / 100;
            const wallArea = wall.area * (1 - windowShareDecimal);
            
            return (
              <tr
                key={wall.wallIndex}
                style={{
                  borderBottom: '1px solid #e0e0e0',
                  transition: 'background-color 0.2s ease',
                  cursor: isReadOnly ? 'default' : 'pointer'
                }}
                onClick={() => !isReadOnly && onWallToggle && onWallToggle(wall.wallIndex)}
                onMouseEnter={(e) => {
                  if (!isReadOnly) e.currentTarget.style.backgroundColor = '#f9f9f9';
                }}
                onMouseLeave={(e) => {
                  if (!isReadOnly) e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                <td style={{ padding: '6px 12px', color: '#333', fontSize: 14, fontWeight: 500 }}>{wall.wallIndex + 1}</td>
                <td style={{ padding: '6px 12px', color: '#666', fontSize: 14 }}>{wall.area.toFixed(1)} m²</td>
                <td style={{ padding: '6px 12px', color: '#666', fontSize: 14 }}>{wallArea.toFixed(1)} m²</td>
                <td style={{ padding: '6px 12px', color: '#666', fontSize: 14 }}>{wall.maxHeight.toFixed(1)} m</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

