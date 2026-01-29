'use client';
import React, { useState } from 'react';
import { getCardinalDirection, getFullCardinalDirection } from '../../../helpers/directionUtils';
import PopUp from '../../ui/PopUp';
import AufmassCheck from '../../PopUps/AufmassCheck';
import scannerStyles from './Scanner.module.css';
import styles from '../Tooltip.module.css';
import Tooltip from '../../ui/Tooltip';

interface FacadeWidgetProps {
  direction: string;
  mode: 'manual' | 'processing' | 'completed';
  windowShare: number;
  windowCount?: number;
  imageUrl?: string;
  facadeId: string;
  lod2Id?: string;
  onWindowShareChange: (value: number) => void;
}

export default function FacadeWidget({
  direction,
  mode,
  windowShare,
  windowCount,
  imageUrl,
  facadeId,
  lod2Id,
  onWindowShareChange
}: FacadeWidgetProps) {
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const cardinalDirection = getFullCardinalDirection(
    ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].indexOf(direction)
  );

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 20,
      padding: '8px',
      backgroundColor: 'var(--foreground)',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
      minHeight: 80
    }}>
      {/* Left side - Direction and status */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{
          fontSize: 16,
          fontWeight: 600,
          color: 'var(--fontcolor)'
        }}>
          Fensteranteil {cardinalDirection}
        </div>
        <div style={{
          fontSize: 14,
          color: 'var(--fontcolor)',
          opacity: 0.7
        }}>
          {mode === 'manual' && 'Manuelle Angabe'}
          {mode === 'processing' && (
            <>
              Ermittlung aus Foto...
              <Tooltip content="Unsere Bilderkennung identifiziert gerade automatisch die Fenster & Türen. Dies kann bis zu 2 Minuten dauern." position="right">
                <span className={styles.tooltipIcon}>?</span>
              </Tooltip>
            </>
          )}
          {mode === 'completed' &&(
            <>Ermittlung aus Foto ({windowCount ?? 0} Fenster)
              <Tooltip content="Unsere Bilderkennung hat die Fensterflächen erkannt und ermittelt. Sie können das Ergebnis überprüfen." position="right">
                <span className={styles.tooltipIcon}>?</span>
              </Tooltip>
            </>
            )}
        </div>
      </div>

      {/* Right side - Mode-specific content */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
        {mode === 'manual' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => {
                const newValue = Math.max(0, windowShare - 5);
                onWindowShareChange(newValue);
              }}
              style={{
                width: 32,
                height: 32,
                padding: 0,
                border: 'none',
                backgroundColor: 'var(--base-col1)',
                color: 'white',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 18,
                fontWeight: 800,
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--base-col1-hover)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--base-col1)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              −
            </button>
            <input
              type="number"
              min="0"
              max="100"
              value={windowShare}
              onChange={(e) => {
                const inputValue = e.target.value;
                let value: number;
                
                if (inputValue === '' || inputValue === '-') {
                  value = 0;
                } else {
                  value = Math.max(0, Math.min(100, parseFloat(inputValue) || 0));
                }
                onWindowShareChange(value);
              }}
              style={{
                width: 70,
                padding: '6px 8px',
                border: '1px solid var(--fontcolor)',
                fontSize: 14,
                textAlign: 'center'
              }}
              onWheel={(e) => e.currentTarget.blur()}
            />
            <button
              onClick={() => {
                const newValue = Math.min(100, windowShare + 5);
                onWindowShareChange(newValue);
              }}
              style={{
                width: 32,
                height: 32,
                padding: 0,
                border: 'none',
                backgroundColor: 'var(--base-col1)',
                color: 'white',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 18,
                fontWeight: 800,
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--base-col1-hover)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--base-col1)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              +
            </button>
            <span style={{ color: 'var(--fontcolor)', fontSize: 14 }}>%</span>
          </div>
        )}

        {mode === 'processing' && (
          <div style={{ 
            position: 'relative',
            width: 80,
            height: 60,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 4,
            overflow: 'hidden',
            backgroundColor: '#f0f0f0'
          }}>
            {imageUrl && (
              <img
                src={imageUrl}
                alt="Facade"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  opacity: 0.4
                }}
              />
            )}
            {/* Scanning Animation */}
            <div className={scannerStyles.scannerLine}></div>
            <div className={scannerStyles.scannerHighlight}></div>
          </div>
        )}

        {mode === 'completed' && (
          <>
            <div style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'var(--fontcolor)',
              padding: '6px 8px',
              backgroundColor: 'var(--foreground)',
              border: '1px solid var(--base-col1)',
              width: '84px',
              textAlign: 'center',
              boxSizing: 'border-box'
            }}>
              {windowShare}%
            </div>
            <button
              onClick={() => setIsPopupOpen(true)}
              style={{
                padding: '6px',
                backgroundColor: 'var(--base-col1)',
                border: 'none',
                borderRadius: 4,
                fontSize: 12,
                color: '#fff',
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                width: '84px',
                boxSizing: 'border-box'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--base-col1-hover)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--base-col1)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              Überprüfen
            </button>
          </>
        )}
      </div>

      
      {isPopupOpen && lod2Id && (
        <PopUp
          isOpen={isPopupOpen}
          onClose={() => setIsPopupOpen(false)}
          content={<AufmassCheck lod2Id={lod2Id} facadeId={facadeId} />}
          size="large"
        />
      )}

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
    </div>
  );
}
