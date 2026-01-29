'use client';
import React from 'react';

export interface GeruestData {
  width: number;
  eave_height_difference: number;
}

interface GeruestCalculationSlideProps {
  data: GeruestData;
  onChange: (data: GeruestData) => void;
}

export default function GeruestCalculationSlide({ data, onChange }: GeruestCalculationSlideProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const parsedValue = parseFloat(value);

    if (name === 'width') {
      if (value === '') {
        onChange({ ...data, width: 0 });
      } else if (!isNaN(parsedValue) && parsedValue >= 0) {
        onChange({ ...data, width: parsedValue });
      }
    } else if (name === 'eave_height_difference') {
      if (value === '') {
        onChange({ ...data, eave_height_difference: 0 });
      } else if (!isNaN(parsedValue) && parsedValue >= 0) {
        onChange({ ...data, eave_height_difference: parsedValue });
      }
    }
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
      <h2 style={{ margin: 0, color: 'var(--fontcolor)', fontSize: 24 }}>Eingabe Gerüstdaten</h2>

      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ color: 'var(--fontcolor)', fontWeight: 400, fontSize: 14 }}>
          Gerüstbreite (cm)
        </label>
        <input
          type="number"
          name="width"
          value={data.width || ''}
          onChange={handleChange}
          placeholder="80"
          min="0"
          style={{
            padding: '10px',
            borderRadius: 6,
            border: '1px solid #ccc',
            fontSize: 16,
            width: '100%'
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <label style={{ color: 'var(--fontcolor)', fontWeight: 400, fontSize: 14 }}>
          Abstand oberste Belagfläche zur Dachkante (cm)
        </label>
        <input
          type="number"
          name="eave_height_difference"
          value={data.eave_height_difference || ''}
          onChange={handleChange}
          placeholder="120"
          min="0"
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
  );
}
