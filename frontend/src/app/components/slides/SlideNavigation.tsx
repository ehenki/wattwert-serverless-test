'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { OfferPDF } from '../CreatePDF';
import PopUp from '../ui/PopUp';
import UserPoll from '../PopUps/UserPoll';
import { trackEvent } from '@/lib/analytics';

const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then((mod) => mod.PDFDownloadLink),
  { ssr: false }
);

interface WallInfo {
  wallIndex: number;
  area: number;
  maxHeight: number;
  width: number;
  direction?: string;
}

interface SlideNavigationProps {
  currentSlide: number;
  totalSlides: number;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit?: () => void;
  canProceed: boolean;
  loading?: boolean;
  isDetailView?: boolean;
  onBackToOverview?: () => void;
  nextLabel?: string;
  displayTotalSlides?: number;
  // PDF Props
  walls?: WallInfo[];
  windowShare?: number;
  directionWindowShares?: Record<string, number>;
  selectedCount?: number;
  maxHeightOverall?: number;
  groundPerimeter?: number;
  totalArea?: number;
  totalWindowArea?: number;
  totalWallArea?: number;
  pricePerSqm?: number;
  safetyMargin?: number;
  additionalCosts?: number;
  totalPrice?: number;
  logoUrl?: string;
  address?: string;
  userId?: string;
  accessToken?: string;
  userRole?: string | null;
}

const SlideNavigation: React.FC<SlideNavigationProps> = ({
  currentSlide,
  totalSlides,
  onPrevious,
  onNext,
  onSubmit,
  canProceed,
  loading = false,
  isDetailView = false,
  onBackToOverview,
  nextLabel,
  displayTotalSlides,
  // PDF Props destructuring
  walls,
  windowShare,
  directionWindowShares,
  selectedCount,
  maxHeightOverall,
  groundPerimeter,
  totalArea,
  totalWindowArea,
  totalWallArea,
  pricePerSqm,
  safetyMargin,
  additionalCosts,
  totalPrice,
  logoUrl,
  address,
  userId,
  accessToken,
  userRole,
}) => {
  const router = useRouter();
  const isFirstSlide = currentSlide === 0;
  const isLastSlide = currentSlide === totalSlides - 1;
  const totalForDisplay = displayTotalSlides ?? totalSlides;

  const buttonStyle = {
    padding: "12px 24px",
    fontSize: 16,
    borderRadius: 4,
    border: "none",
    cursor: "pointer",
    transition: "background-color 0.2s ease"
  };

  const primaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: canProceed ? "var(--base-col1)" : "#ccc",
    color: "white",
    cursor: canProceed ? "pointer" : "not-allowed"
  };

  const secondaryButtonStyle = {
    ...buttonStyle,
    backgroundColor: "#6c757d",
    color: "white"
  };

  const handleNextClick = () => {
    if (currentSlide === 0 && onSubmit) {
      onSubmit();
      onNext();
    } else {
      onNext();
    }
  };

  const [hasRated, setHasRated] = useState(true);
  const [showPoll, setShowPoll] = useState(false);

  useEffect(() => {
    const rated = localStorage.getItem('hasRated');
    if (rated !== 'true') {
      setHasRated(false);
    }
  }, []);

  const handleRating = () => {
    localStorage.setItem('hasRated', 'true');
    setHasRated(true);
    setShowPoll(false);
  };

  const handleDownloadClick = () => {
    trackEvent('click', 'Slide Navigation', 'Save Report');
    if (hasRated) {
      // Programmatically trigger the hidden PDF download link
      const downloadLink = document.querySelector('#pdf-download-link a') as HTMLElement;
      if (downloadLink) {
        downloadLink.click();
      }
    } else {
      setShowPoll(true);
    }
  };

  const pdfProps = {
    walls: walls || [],
    windowShare: windowShare || 0,
    directionWindowShares: directionWindowShares || {},
    selectedCount: selectedCount || 0,
    maxHeight: maxHeightOverall || 0,
    groundPerimeter: groundPerimeter || 0,
    totalArea: totalArea || 0,
    totalWindowArea: totalWindowArea || 0,
    totalWallArea: totalWallArea || 0,
    pricePerSqm: pricePerSqm || 0,
    safetyMargin: safetyMargin || 0,
    additionalCosts: additionalCosts || 0,
    totalPrice: totalPrice || 0,
    logoUrl: logoUrl || undefined,
    address: address || '',
    userRole: userRole,
  };

  const handleNextWithTracking = () => {
    trackEvent('click', 'Slide Navigation', `Forward Button from Slide ${currentSlide + 1}`);
    handleNextClick();
  }

  const handleBackWithTracking = () => {
    if (isDetailView && onBackToOverview) {
      trackEvent('click', 'Slide Navigation', 'Back to Overview');
      onBackToOverview();
    } else {
      trackEvent('click', 'Slide Navigation', `Back Button from Slide ${currentSlide + 1}`);
      onPrevious();
    }
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: "8px",
      padding: "12px",
      backgroundColor: "var(--foreground)",
      borderRadius: "8px",
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      marginTop: "16px"
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px"
      }}>
        <button
          onClick={handleBackWithTracking}
          disabled={!isDetailView && isFirstSlide}
          style={{
            ...secondaryButtonStyle,
            opacity: (!isDetailView && isFirstSlide) ? 0.5 : 1,
            cursor: (!isDetailView && isFirstSlide) ? "not-allowed" : "pointer"
          }}
        >
          {isDetailView ? 'Zur Übersicht' : <img src="/right.png" alt="Zurück" style={{ transform: 'scaleX(-1)', height: '16px' }} />}
        </button>

        {currentSlide === (totalSlides - 1) ? (
          <>
            <div id="pdf-download-link" style={{ display: 'none' }}>
              <PDFDownloadLink
                document={<OfferPDF {...pdfProps} />}
                fileName={`${address?.replace(/[ ,]/g, '_') || 'Schnellaufmass'}_${new Date().toISOString().split('T')[0]}.pdf`}
              >
                Report speichern
              </PDFDownloadLink>
            </div>
            <button
              onClick={handleDownloadClick}
              style={{
                ...primaryButtonStyle,
                textDecoration: 'none',
                textAlign: 'center',
              }}
            >
              Report speichern
            </button>
            {showPoll && (
              <PopUp 
                isOpen={showPoll}
                onClose={() => setShowPoll(false)}
                content={
                  <UserPoll 
                    onRating={handleRating} 
                    pdfProps={pdfProps} 
                    userId={userId || ''} 
                    accessToken={accessToken || ''} 
                    userRole={userRole}
                  />
                } 
              />
            )}
          </>
        ) : (
          <button
            onClick={handleNextWithTracking}
            disabled={!canProceed || loading}
            style={{
              ...buttonStyle,
              backgroundColor: canProceed ? "var(--base-col1)" : "var(--base-grey-light)",
              color: "white",
              cursor: canProceed ? "pointer" : "not-allowed"
            }}
          >
            {loading ? "..." : <img src="/right.png" alt="Weiter" style={{ height: '16px' }} />}
          </button>
        )}
      </div>

      {/* Segmented Progress Bar - hide in detail view */}
      {!isDetailView && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "2px",
          width: "100%"
        }}>
          {Array.from({ length: totalForDisplay }).map((_, index) => (
            <div
              key={index}
              style={{
                flex: 1,
                height: "12px",
                backgroundColor: index <= currentSlide ? "var(--base-col1)" : "#e0e0e0",
                borderRadius: "0",
                transition: "background-color 0.3s ease"
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SlideNavigation;
