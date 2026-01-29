import React from 'react';

interface ClosingButtonProps {
  onClick: () => void;
  title?: string;
}

const ClosingButton: React.FC<ClosingButtonProps> = ({ onClick, title = "Schließen" }) => {
  return (
    <button
      onClick={onClick}
      style={{
        position: 'absolute',
        top: '16px',
        right: '16px',
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        border: 'none',
        backgroundColor: 'var(--foreground)',
        color: 'var(--fontcolor)',
        fontSize: '20px',
        fontWeight: 'bold',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
        transition: 'all 0.2s ease',
        zIndex: 100,
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#e0e0e0';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#f0f0f0';
      }}
      title={title}
    >
      ×
    </button>
  );
};

export default ClosingButton;
