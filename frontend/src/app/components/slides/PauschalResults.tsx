'use client';
import React from 'react';
import WallTable from './slide_elements/WallTable';
import WallSummary from './slide_elements/WallSummary';
import GeruestTable from './slide_elements/GeruestTable';
import GeruestSummary from './slide_elements/GeruestSummary';
import PriceResult from './slide_elements/PriceResult';
import dynamic from 'next/dynamic';
import { OfferPDF } from '../CreatePDF';

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

interface PauschalResultsProps {
  wallsInfo: WallInfo[];
  selectedWalls: number[];
  windowShare: number;
  directionWindowShares?: Record<string, number>;
  groundPerimeter: number;
  totalArea: number;
  totalWindowArea: number;
  totalWallArea: number;
  maxHeightOverall: number;
  totalPrice: number;
  pricePerSqm: number;
  safetyMargin: number;
  additionalCosts: number;
  logoUrl?: string;
  address: string;
  userRole?: string | null;
}

export default function PauschalResults(props: PauschalResultsProps) {
  const {
    wallsInfo,
    selectedWalls,
    windowShare,
    directionWindowShares = {},
    groundPerimeter,
    totalArea,
    totalWindowArea,
    totalWallArea,
    maxHeightOverall,
    totalPrice,
    pricePerSqm,
    safetyMargin,
    additionalCosts,
    logoUrl,
    address,
  } = props;

  const selectedWallsInfo = wallsInfo.filter(wall => selectedWalls.includes(wall.wallIndex));

  const pdfProps = {
    walls: selectedWallsInfo,
    windowShare: windowShare || 0,
    directionWindowShares: directionWindowShares,
    selectedCount: selectedWalls.length,
    maxHeight: maxHeightOverall,
    groundPerimeter: groundPerimeter,
    totalArea: totalArea,
    totalWindowArea: totalWindowArea,
    totalWallArea: totalWallArea,
    pricePerSqm: pricePerSqm,
    safetyMargin: safetyMargin,
    additionalCosts: additionalCosts,
    totalPrice: totalPrice,
    logoUrl: logoUrl,
    address: address,
  };

  return (
    <div className="ww-viewer-container" style={{
      backgroundColor: 'var(--foreground)',
      borderRadius: 8,
      overflow: 'hidden',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      padding: '20px',
      gap: '12px',
      color: '#ccc',
      border: 'none',
      height: '100%',
      position: 'relative',
    }}>
      <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {props.userRole === 'geruestbauer' ? (
          <>
            <GeruestTable
              geruest={selectedWallsInfo.map(w => ({
                geruestIndex: w.wallIndex,
                area: w.area,
                maxHeight: w.maxHeight
              }))}
              selectedWalls={selectedWalls}
              isReadOnly={true}
            />
            <GeruestSummary
              selectedCount={selectedWalls.length}
              maxHeight={maxHeightOverall}
              groundPerimeter={groundPerimeter}
              totalArea={totalArea}
              selectedWalls={selectedWallsInfo}
            />
          </>
        ) : (
          <>
            <WallTable 
              walls={selectedWallsInfo} 
              windowShare={windowShare || 0}
              directionWindowShares={directionWindowShares}
              isReadOnly={true}
            />
            <WallSummary 
              selectedCount={selectedWalls.length}
              maxHeight={maxHeightOverall}
              groundPerimeter={groundPerimeter}
              totalArea={totalArea}
              totalWindowArea={totalWindowArea}
              totalWallArea={totalWallArea}
              windowShare={windowShare || 0}
              directionWindowShares={directionWindowShares}
              selectedWalls={selectedWallsInfo}
            />
          </>
        )}
        <PriceResult  
          totalWallArea={totalWallArea}
          totalPrice={totalPrice}
          pricePerSqm={pricePerSqm}
          safetyMargin={safetyMargin}
          additionalCosts={additionalCosts}
        />
      </div>
    </div>
  );
}
