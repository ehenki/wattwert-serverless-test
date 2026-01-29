import React from 'react';

interface StartButtonProps {
  loading: boolean;
  title: string;
  onClick: () => void;
  disabled?: boolean;
}

const StartButton: React.FC<StartButtonProps> = ({ loading, title, onClick, disabled }) => {
  return (
    <button 
      onClick={onClick}
      style={{ 
        width: '100%',
        fontSize: 16, 
        padding: 16,
        cursor: loading || disabled ? 'not-allowed' : 'pointer',
        backgroundColor: 'var(--base-col2)',
        color: 'white',
        border: 'none',
        borderRadius: 8,
        transition: 'background-color 0.2s, opacity 0.2s',
        opacity: loading || disabled ? 0.7 : 1,
        fontWeight: 'bold',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}
      onMouseOver={(e) => {
        if (!(loading || disabled)) {
          e.currentTarget.style.backgroundColor = "var(--base-col2-hover)";
        }
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.backgroundColor = "var(--base-col2)";
      }}
      disabled={loading || !!disabled}
    >
      {loading ? 'Processing...' : title}
    </button>
  );
};

export default StartButton; 