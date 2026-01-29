'use client';

import { useState, useEffect } from 'react';
import CookieConsent, { Cookies } from 'react-cookie-consent';
import GoogleAnalytics from './GoogleAnalytics';

const AnalyticsWrapper = () => {
  const [showAnalytics, setShowAnalytics] = useState(false);

  useEffect(() => {
    // Check if consent has already been given
    if (Cookies.get('CookieConsent') === "true") {
      setShowAnalytics(true);
    }
  }, []);

  const handleAccept = () => {
    setShowAnalytics(true);
  };

  const handleDecline = () => {
    setShowAnalytics(false);
  };

  return (
    <>
      {showAnalytics && <GoogleAnalytics />}
      <CookieConsent
        onAccept={handleAccept}
        onDecline={handleDecline}
        buttonText="Alle Cookies akzeptieren"
        declineButtonText="Nur notwendige Cookies"
        enableDeclineButton
        style={{ 
          background: "#cccccc", 
          boxShadow: "0px -2px 10px rgba(0,0,0,0.1)",
          justifyContent: "center",
          alignItems: "center",
          padding: "20px",
          borderTop: "1px solid var(--border-color, #ccc)"
        }}
        containerClasses="cookie-consent-container"
        contentStyle={{
          margin: "0",
          flex: "none",
          maxWidth: "800px",
          textAlign: "center"
        }}
        buttonWrapperClasses="cookie-button-wrapper"
        buttonStyle={{ 
          color: "#ffffff", 
          fontSize: "14px", 
          background: "var(--base-col2)",
          padding: "10px 20px",
          borderRadius: "5px",
          margin: "0 10px"
        }}
        declineButtonStyle={{ 
          color: "#777", 
          fontSize: "14px", 
          background: "#bbb",
          padding: "10px 20px",
          borderRadius: "5px",
          margin: "0 10px"
        }}
      >
        <p style={{ 
          fontSize: "14px", 
          color: "#444",
          lineHeight: "1.5",
          maxWidth: "600px",
          wordWrap: "break-word",
          overflowWrap: "break-word",
          hyphens: "auto"
        }}>
          Wir verwenden Cookies, um anonyme Statistiken zu erheben und unsere Website zu verbessern. Mehr Informationen finden Sie in unserer <a href="/datenschutz" style={{ color: "var(--base-col1)", textDecoration: "underline" }}>Datenschutzerklärung</a>.
        </p>
      </CookieConsent>
    </>
  );
};

export default AnalyticsWrapper;
