import React from 'react';

interface FacadeMeasureSlideProps {
  value: string; // comma-separated list
  onChange: (nextValue: string) => void;
}

const OPTIONS = [
  { label: 'Fenstertausch', icon: '/windowIcon.png' },
  { label: 'Fassadenanstrich', icon: '/farbroller.png' },
  { label: 'Fassadenputz', icon: '/putzkelle.png' },
];

const FacadeMeasureSlide: React.FC<FacadeMeasureSlideProps> = ({ value, onChange }) => {
  const selected = new Set((value || '').split(',').map(s => s.trim()).filter(Boolean));

  const toggle = (option: string) => {
    const next = new Set(selected);
    if (next.has(option)) next.delete(option); else next.add(option);
    onChange(Array.from(next).join(','));
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      padding: '20px',
      backgroundColor: 'var(--foreground)',
      borderRadius: 8,
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      flex: 1 // Add flex: 1 to make it stretch
    }}>
      <h2 style={{ margin: 0, color: 'var(--headlinecolor)', marginBottom: '10px' }}>Fassadenmaßnahmen</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontSize: 20 }}>
        {OPTIONS.map(option => (
          <label
            key={option.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: 'black',
              padding: '10px',
              border: selected.has(option.label) ? '2px solid var(--base-col1)' : '1px solid var(--base-grey-light)',
              borderRadius: 8,
              cursor: 'pointer',
              backgroundColor: selected.has(option.label) ? 'color-mix(in srgb, var(--base-col1), white 80%)' : 'white',
              transition: 'all 0.2s ease',
            }}
            onClick={() => toggle(option.label)}
          >
            <img src={option.icon} alt={option.label} style={{ width: 32, height: 32 }} />
            {option.label}
          </label>
        ))}
      </div>
    </div>
  );
};

export default FacadeMeasureSlide;
