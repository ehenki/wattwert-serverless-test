import React, { useState, useEffect } from 'react';

const loadingSentences = [
  "Eingabedaten werden verarbeitet und an Malerbetrieb weitergeleitet. Dies kann bis zu einer Minute dauern.",
  "Gebäudedaten werden geladen...",
  "Fassadenelemente werden identifiziert...",
  "Fassadenelemente werden vermessen...",
  "Materialien werden identifiziert...",
  "Angebot wird vorkalkuliert...",
  "Daten werden an Malerbetrieb weitergeleitet...",
];

const LoadingScreen: React.FC = () => {
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [useSpinnerFallback, setUseSpinnerFallback] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setSentenceIndex((prevIndex) => (prevIndex + 1) % loadingSentences.length);
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(255, 255, 255, 0.1)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
      color: 'black',
      textAlign: 'center'
    }}>
      {useSpinnerFallback ? (
        <div className="spinner"></div>
      ) : (
        <video
          autoPlay
          loop
          muted
          playsInline
          onError={() => setUseSpinnerFallback(true)}
          style={{
            width: 120,
            height: 120,
            objectFit: 'contain',
            pointerEvents: 'none',
            background: 'transparent'
          }}
        >
          <source src="/HouseAnimation.webm" type="video/webm" />
        </video>
      )}
      <p style={{ marginTop: '25px', fontSize: '1.3em', maxWidth: '80%' }}>
        {loadingSentences[sentenceIndex]}
      </p>
      <style jsx>{`
        .spinner {
          border: 6px solid #f3f3f3;
          border-top: 6px solid #4DE0A9;
          border-radius: 50%;
          width: 60px;
          height: 60px;
          animation: spin 1.5s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default LoadingScreen;
