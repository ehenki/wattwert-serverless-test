import React from 'react';
import MapboxViewer from '@/app/components/Mapbox/mapbox_map';

interface ParsedAddress {
  postcode?: string;
  street?: string;
  houseNumber?: string;
  city?: string;
  state?: string;
  country: string;
  completeness: 'postcode' | 'street' | 'complete' | 'none';
  freeformQuery?: string;
}

interface MapContainerProps {
  coordinates?: [number, number];
  address?: {
    Street: string;
    House_number: string;
    City: string;
    State: string;
    Country: string;
  };
  parsedAddress?: ParsedAddress;
  onCoordinateClick: (coordinates: [number, number]) => void;
  onBuildingMarked?: () => void;
  onManualMapClick?: (address: { street: string; number: string; city: string; state: string; country: string; fullAddress: string }) => void;
}

const MapContainer: React.FC<MapContainerProps> = ({
  coordinates,
  address,
  parsedAddress,
  onCoordinateClick,
  onBuildingMarked,
  onManualMapClick
}) => {
  return (
    <div style={{
      backgroundColor: 'var(--foreground)',
      borderRadius: 8,
      overflow: 'hidden',
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0 // Allow flex shrinking
    }}>
      <MapboxViewer
        coordinates={coordinates}
        address={address}
        parsedAddress={parsedAddress}
        onCoordinateClick={onCoordinateClick}
        onBuildingMarked={onBuildingMarked}
        onManualMapClick={onManualMapClick}
      />
    </div>
  );
};

export default MapContainer; 