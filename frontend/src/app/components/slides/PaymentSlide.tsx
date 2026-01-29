import React, { useEffect } from 'react';

interface PaymentSlideProps {
  isVorOrt?: boolean; // true => Vor-Ort-Angebot, false/undefined => Digitales Angebot
}

const PaymentSlide: React.FC<PaymentSlideProps> = ({ isVorOrt = false }) => {
  useEffect(() => {
    if (isVorOrt) {
      const script = document.createElement('script');
      script.src = 'https://assets.calendly.com/assets/external/widget.js';
      script.async = true;
      document.body.appendChild(script);

      return () => {
        document.body.removeChild(script);
      };
    }
  }, [isVorOrt]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
      padding: '20px',
      backgroundColor: 'var(--foreground)',
      borderRadius: 8,
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      alignItems: 'center',
      flex: 1 // Add flex: 1 to make it stretch
    }}>
      <h2 style={{ margin: 0, color: 'var(--headlinecolor)', alignSelf: 'flex-start' }}>{isVorOrt ? 'Terminvereinbarung' : 'Zahlung'}</h2>

      <div style={{ alignSelf: 'flex-start', color: 'var(--fontcolor)' }}>
        <div style={{ fontWeight: 700 }}>
          {isVorOrt ? 'Vor-Ort-Aufmaß mit Angebot (Kosten: 150€)' : 'Angebot inkl. digitalem, fotobasiertem Aufmaß (Kosten: 40€)'}
        </div>
        <div style={{ marginTop: 8, color: 'var(--fontcolor)', fontSize: 14, lineHeight: 1.5 }}>
          {isVorOrt
            ? 'Vereinbaren Sie direkt einen Vor-Ort-Termin. Die Zahlung erfolgt beim Termin.'
            : 'Das Angebot wird Ihnen so schnell wie möglich an die von Ihnen angegebene E-mail Adresse zugesendet.'}
        </div>
        <div style={{ marginTop: 8, color: 'var(--fontcolor)', fontSize: 14 }}>
          Bei Abschluss des Projekts werden Ihnen die Kosten für das Aufmaß erstattet.
        </div>
      </div>

      {isVorOrt && (
        <div 
          className="calendly-inline-widget" 
          data-url="https://calendly.com/wattwert/c" 
          style={{ minWidth: '100%', height: '1100px' }}
        />
      )}

      {!isVorOrt && (
        <img
          src="/paymentplaceholder.png"
          alt="Payment placeholder"
          style={{ maxWidth: '100%', height: 'auto', borderRadius: 8, border: '1px solid var(--base-grey-light)' }}
        />
      )}
    </div>
  );
};

export default PaymentSlide;
