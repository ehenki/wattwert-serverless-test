import React from 'react';

interface PriceResultProps {
  totalWallArea: number;
  totalPrice: number;
  pricePerSqm: number;
  safetyMargin: number;
  additionalCosts: number;
}

export default function PriceResult({ totalWallArea, totalPrice, pricePerSqm, safetyMargin, additionalCosts }: PriceResultProps) {
  const leistungspreis = totalWallArea * pricePerSqm;
  const sicherheitsaufschlag = leistungspreis * (safetyMargin / 100);

  return (
    <div style={{
      marginTop: 0,
      padding: '8px 16px 8px 16px',
      backgroundColor: '#f9f9f9',
      borderRadius: 0,
      borderTop: '1px solid var(--bordercolor)',
      borderBottom: '1px solid var(--bordercolor)',
      borderRight: '1px solid var(--bordercolor)',
      borderLeft: '4px solid var(--base-col1)',
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        backgroundColor: 'transparent',
      }}>
        <thead>
          <tr>
            <th style={{ padding: '4px 0', textAlign: 'left', fontWeight: 600, color: '#333', fontSize: 14 }}>Leistungspreis</th>
            <th style={{ padding: '4px 0', textAlign: 'left', fontWeight: 600, color: '#333', fontSize: 14 }}>Sicherheitsaufschlag</th>
            <th style={{ padding: '4px 0', textAlign: 'left', fontWeight: 600, color: '#333', fontSize: 14 }}>Zusatzaufwände</th>
            <th style={{ padding: '4px 0', textAlign: 'left', fontWeight: 800, color: '#333', fontSize: 14 }}>Pauschalpreis</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ padding: '4px 0', color: '#666', fontSize: 14 }}>{leistungspreis.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
            <td style={{ padding: '4px 0', color: '#666', fontSize: 14 }}>{sicherheitsaufschlag.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
            <td style={{ padding: '4px 0', color: '#666', fontSize: 14 }}>{additionalCosts.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
            <td style={{ padding: '4px 0', color: '#333', fontSize: 14, fontWeight: 800 }}>{totalPrice.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

