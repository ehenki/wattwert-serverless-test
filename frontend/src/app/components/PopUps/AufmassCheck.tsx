import React, { useEffect, useState } from 'react';
import { fetchSegmentationOverlayImage } from '../database/ImageDownloader';

interface AufmassCheckProps {
  lod2Id: string;
  facadeId: string;
}

const AufmassCheck: React.FC<AufmassCheckProps> = ({ lod2Id, facadeId }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadImage = async () => {
      setLoading(true);
      const url = await fetchSegmentationOverlayImage(lod2Id, facadeId);
      setImageUrl(url);
      setLoading(false);
    };
    if (lod2Id && facadeId) {
      loadImage();
    }
  }, [lod2Id, facadeId]);

  if (loading) return <div style={{ color: 'var(--fontcolor)' }}>Inhalt wird geladen...</div>;
  if (!imageUrl) return <div style={{ color: 'var(--fontcolor)' }}>Keine Segmentation Overlay gefunden.</div>;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <img src={imageUrl} alt="Segmentation Overlay" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
    </div>
  );
};

export default AufmassCheck;
