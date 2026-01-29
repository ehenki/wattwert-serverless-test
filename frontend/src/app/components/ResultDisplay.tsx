import React from 'react';

interface ResultDisplayProps {
  result: string;
}

const ResultDisplay: React.FC<ResultDisplayProps> = ({ result }) => {
  if (!result) return null;

  return (
    <div style={{ 
      padding: 20, 
      backgroundColor: '#252525', 
      border: '1px solid #ccc',
      borderRadius: 8,
      whiteSpace: 'pre-wrap',
      fontFamily: 'monospace',
      color: '#ffffff',
      overflowX: 'auto',
      width: '100%',
    }}>
      {result}
    </div>
  );
};

export default ResultDisplay; 