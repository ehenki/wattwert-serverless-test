import React from 'react';
import Tooltip from '../../ui/Tooltip';
import styles from '../Tooltip.module.css';

interface GeruestInfo {
  geruestIndex: number;
  area: number;
  maxHeight: number;
}

interface GeruestTableProps {
  geruest: GeruestInfo[];
  selectedWalls?: number[];
  onWallToggle?: (geruestIndex: number) => void;
  isReadOnly?: boolean;
}

export default function GeruestTable({
  geruest,
  selectedWalls = [],
  onWallToggle,
  isReadOnly = false
}: GeruestTableProps) {

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
            <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 600, color: '#333', fontSize: 14 }}>Gerüstfläche</th>
            <th style={{ padding: '8px 8px', textAlign: 'left', fontWeight: 600, color: '#333', fontSize: 14 }}>Gerüsthöhe 
              <Tooltip content="Die Gerüsthöhe berechnet sich aus der Höhe der Wand, abzüglich des von Ihnen angegeben Abstands der obersten Belagfläche zzgl. 2 m (nach DIN 18451)" position="bottom">
                <span className={styles.tooltipIcon}>?</span>
              </Tooltip>
            </th>
          </tr>
        </thead>
        <tbody>
          {geruest.map((geruest) => {
            return (
              <tr
                key={geruest.geruestIndex}
                style={{
                  borderBottom: '1px solid #e0e0e0',
                  transition: 'background-color 0.2s ease',
                  cursor: isReadOnly ? 'default' : 'pointer'
                }}
                onClick={() => !isReadOnly && onWallToggle && onWallToggle(geruest.geruestIndex)}
                onMouseEnter={(e) => {
                  if (!isReadOnly) e.currentTarget.style.backgroundColor = '#f9f9f9';
                }}
                onMouseLeave={(e) => {
                  if (!isReadOnly) e.currentTarget.style.backgroundColor = 'white';
                }}
              >
                <td style={{ padding: '6px 12px', color: '#333', fontSize: 14, fontWeight: 500 }}>{geruest.geruestIndex + 1}</td>
                <td style={{ padding: '6px 12px', color: '#666', fontSize: 14 }}>{geruest.area.toFixed(1)} m²</td>
                <td style={{ padding: '6px 12px', color: '#666', fontSize: 14 }}>{geruest.maxHeight.toFixed(1)} m</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

