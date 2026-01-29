import React, { useState } from 'react';
import { getCardinalDirection, getFullCardinalDirection } from '../../../helpers/directionUtils';
import eventBus from '../../helpers/eventBus';
import { deleteFacadeImage } from '../../database/DeleteImage';
import styles from './Scanner.module.css';

interface WallInfo {
  wallIndex: number;
  area: number;
  maxHeight: number;
  direction?: string;
}

interface UploadedImagesDisplayProps {
  selectedWalls: WallInfo[];
  imageUrls: Record<string, string>;
  lod2Id: string | null;
}

export default function UploadedImagesDisplay({
  selectedWalls,
  imageUrls,
  lod2Id
}: UploadedImagesDisplayProps) {
  const [hoveredDirection, setHoveredDirection] = useState<string | null>(null);

  // Group selected walls by direction
  const wallsByDirection: Record<string, WallInfo[]> = {};
  selectedWalls.forEach(wall => {
    if (wall.direction) {
      if (!wallsByDirection[wall.direction]) {
        wallsByDirection[wall.direction] = [];
      }
      wallsByDirection[wall.direction].push(wall);
    }
  });

  // Sort directions and calculate total areas
  const sortedDirections = Object.keys(wallsByDirection).sort((a, b) => {
    const directionOrder = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    return directionOrder.indexOf(a) - directionOrder.indexOf(b);
  });

  const handleImageClick = (direction: string, directionIndex: number) => {
    // Trigger the image upload for this direction
    eventBus.dispatch('trigger-image-upload', { 
      number: getCardinalDirection(directionIndex)
    });
  };

  const handleDeleteClick = async (e: React.MouseEvent, directionIndex: number) => {
    e.stopPropagation(); // Prevent triggering image upload
    
    if (!lod2Id) return;
    
    const facadeId = String(directionIndex + 1);
    
    // Optional: Add a confirmation dialog
    if (!window.confirm('Bild wirklich löschen?')) {
      return;
    }

    try {
      const result = await deleteFacadeImage(lod2Id, facadeId);
      if (result.success) {
        // Refresh the images by dispatching the same event that ImageUpload uses
        eventBus.dispatch('facade-image-uploaded', { 
          ID_LOD2: lod2Id,
          facade_id: facadeId
        });
      } else {
        alert('Fehler beim Löschen des Bildes');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Ein Fehler ist beim Löschen aufgetreten');
    }
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 16
    }}>
      {sortedDirections.map(direction => {
        const walls = wallsByDirection[direction] || [];
        const totalArea = walls.reduce((sum, wall) => sum + wall.area, 0);
        const directionIndex = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'].indexOf(direction);
        const cardinalDirectionFull = getFullCardinalDirection(directionIndex);
        const cardinalDirection = getCardinalDirection(directionIndex);
        
        // Try to find image for this direction (using direction index + 1 as key)
        const imageUrl = imageUrls[String(directionIndex + 1)];
        const isHovered = hoveredDirection === direction;

        return (
          <div key={direction} style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}>
            <h4 style={{
              margin: 0,
              color: 'var(--fontcolor)',
              fontSize: 14,
              fontWeight: 600
            }}>
              Fassade {cardinalDirectionFull}: {totalArea.toFixed(1)} m²
            </h4>
            
            <div
              onClick={() => handleImageClick(direction, directionIndex)}
              onMouseEnter={() => setHoveredDirection(direction)}
              onMouseLeave={() => setHoveredDirection(null)}
              style={{
                width: '100%',
                aspectRatio: '16 / 10',
                border: `2px dashed ${isHovered ? 'var(--base-col1)' : 'var(--bordercolor)'}`,
                textAlign: 'center',
                cursor: 'pointer',
                backgroundColor: isHovered ? 'var(--foreground)' : 'var(--background)',
                transition: 'all 0.2s ease',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                overflow: 'hidden'
              }}
            >
              {/* Direction badge */}
              <div style={{
                position: 'absolute',
                top: 4,
                left: 4,
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: 'var(--base-col1)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: 11,
                zIndex: 3,
                boxShadow: '0 1px 4px rgba(0,0,0,0.10)'
              }}>
                {cardinalDirection}
              </div>

              {imageUrl ? (
                <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                  {/* Scanning Animation */}
                  {/* <div className={styles.scannerLine}></div>
                  <div className={styles.scannerHighlight}></div> */}
                  
                  <img
                    src={imageUrl}
                    alt={`Fassade ${cardinalDirection}`}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                  
                  {/* Delete Button */}
                  <button
                    onClick={(e) => handleDeleteClick(e, directionIndex)}
                    style={{
                      position: 'absolute',
                      bottom: 8,
                      right: 8,
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      backgroundColor: 'white',
                      border: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      zIndex: 10,
                      transition: 'transform 0.2s ease, background-color 0.2s ease'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'scale(1.1)';
                      e.currentTarget.style.backgroundColor = '#f8f8f8';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.backgroundColor = 'white';
                    }}
                  >
                    <img 
                      src="/trash.png" 
                      alt="Delete" 
                      style={{ 
                        width: 18, 
                        height: 18,
                        objectFit: 'contain'
                      }} 
                    />
                  </button>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      border: `2px solid var(--base-col1)`,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <svg
                      width="24"
                      height="24"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M12 5V19M5 12H19"
                        stroke="var(--base-col1)"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div style={{
                    color: 'var(--fontcolor)',
                    fontSize: 13,
                    fontWeight: 500
                  }}>
                    Bild hochladen
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
