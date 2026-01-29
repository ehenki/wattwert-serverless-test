'use client';
import React, { useState } from 'react';
import PopUp from '../ui/PopUp';
import UserPollNoPDF from '../PopUps/UserPollNoPDF';
import TooltipComp from '../ui/Tooltip';
import styles from './Tooltip.module.css';

interface WallInfo {
    wallIndex: number;
    area: number;
    maxHeight: number;
}

interface PriceCalculationProps {
  totalWallArea: number;
  pricePerSqm: number;
  onPricePerSqmChange: (price: number) => void;
  safetyMargin: number;
  onSafetyMarginChange: (margin: number) => void;
  additionalCosts: number;
  onAdditionalCostsChange: (costs: number) => void;
  userId: string;
  accessToken: string;
  userRole?: string | null;
  pdfProps: {
    walls: WallInfo[];
    windowShare: number;
    selectedCount: number;
    maxHeight: number;
    groundPerimeter: number;
    totalArea: number;
    totalWindowArea: number;
    totalWallArea: number;
    pricePerSqm: number;
    safetyMargin: number;
    additionalCosts: number;
    totalPrice: number;
    logoUrl?: string;
    address: string;
  };
}

export default function PriceCalculation({
  totalWallArea,
  pricePerSqm,
  onPricePerSqmChange,
  safetyMargin,
  onSafetyMarginChange,
  additionalCosts,
  onAdditionalCostsChange,
  userId,
  accessToken,
  userRole,
  pdfProps
}: PriceCalculationProps) {
  const [showPoll, setShowPoll] = useState(false);

  const handleRating = () => {
    localStorage.setItem('hasRated', 'true');
    setShowPoll(false);
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
      <h2 style={{ margin: 0, color: 'var(--fontcolor)', fontSize: 24 }}>Kostenberechnung</h2>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16
      }}>
        {/* Price per sqm Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ color: 'var(--fontcolor)', fontWeight: 400, fontSize: 14 }}>
            Einheitspreis pro m² (€)
          </label>
          <input
            type="number"
            value={pricePerSqm || ''}
            onChange={(e) => onPricePerSqmChange(parseFloat(e.target.value) || 0)}
            placeholder="0.00"
            style={{
              padding: '10px',
              borderRadius: 6,
              border: '1px solid #ccc',
              fontSize: 16,
              width: '100%'
            }}
          />
        </div>

        {/* Safety Margin Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ color: 'var(--fontcolor)', fontWeight: 400, fontSize: 14 }}>
            Sicherheitsaufschlag (%)
          </label>
          <input
            type="number"
            value={safetyMargin || ''}
            onChange={(e) => onSafetyMarginChange(parseFloat(e.target.value) || 0)}
            placeholder="0"
            style={{
              padding: '10px',
              borderRadius: 6,
              border: '1px solid #ccc',
              fontSize: 16,
              width: '100%'
            }}
          />
        </div>

        
        {/* Zzgl. Festbetrag für sonstige Leistungen */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ color: 'var(--fontcolor)', fontWeight: 400, fontSize: 14, display: 'flex', alignItems: 'center' }}>
            Kosten Zusatzaufwände (€)
            <TooltipComp content="Aufwände, die pauschal und unabhängig von der Projektgröße entstehen, z.B. Fahrtkosten oder Verwaltungsaufwand" position="top">
              <span className={styles.tooltipIcon}>?</span>
            </TooltipComp>
          </label>
          <input
            type="number"
            value={additionalCosts || ''}
            onChange={(e) => onAdditionalCostsChange(parseFloat(e.target.value) || 0)}
            placeholder="0"
            style={{
              padding: '10px',
              borderRadius: 6,
              border: '1px solid #ccc',
              fontSize: 16,
              width: '100%'
            }}
          />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px', width: '100%' }}>
        <button
          onClick={() => setShowPoll(true)}
          style={{
            backgroundColor: 'var(--base-col1)',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '6px',
            textDecoration: 'none',
            fontSize: '16px',
            fontWeight: '500',
            border: 'none',
            cursor: 'pointer',
            flex: 1
          }}
        >
          Feedback geben
        </button>
        <TooltipComp content="Wir sind gerade in der Testphase. Daher ist für uns jede Rückmeldung wichtig." position="left">
          <span className={styles.tooltipIcon}>?</span>
        </TooltipComp>
      </div>

      {showPoll && (
        <PopUp
          isOpen={showPoll}
          onClose={() => setShowPoll(false)}
          content={
            <UserPollNoPDF
              onRating={handleRating}
              userId={userId}
              accessToken={accessToken}
              userRole={userRole}
            />
          }
        />
      )}
    </div>
  );
}
