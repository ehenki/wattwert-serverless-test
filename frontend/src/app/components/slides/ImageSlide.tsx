import React, { useState, useEffect } from 'react';
import ImageUpload from '../database/ImageUpload';
import { fetchBuildingImages } from '../database/ImageDownloader';
import { getCardinalDirection } from '../../helpers/directionUtils';

interface ImageSlideProps {
  lod2Id: string | null;
  formData: {
    street: string;
    number: string;
    city: string;
    state: string;
  };
  wallCentersData: { center: { x: number, y: number, z: number }, originalIndex: number }[];
}

const ImageSlide: React.FC<ImageSlideProps> = ({ lod2Id, formData, wallCentersData }) => {
  const [imagePreviews, setImagePreviews] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadImages = async () => {
      if (lod2Id) {
        const urls = await fetchBuildingImages(lod2Id);
        setImagePreviews(urls);
      }
    };
    loadImages();
  }, [lod2Id]);

  const isFormValid = () => {
    return formData.street && formData.number && formData.city && formData.state;
  };

  const getAddressString = () => {
    if (!isFormValid()) return "Bild hochladen";
    return `${formData.street} ${formData.number}, ${formData.city}, ${formData.state}`;
  };

  const handleImageSelect = (file: File, number: number) => {
    console.log(`Selected file for wall ${number}:`, file.name);
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 20,
      padding: "20px",
      backgroundColor: "var(--foreground)",
      borderRadius: "8px",
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      flex: 1 // Add flex: 1 to make it stretch
    }}>
      <h2 style={{ margin: 0, color: "var(--headlinecolor)" }}>Foto-Upload</h2>
      <p style={{ margin: "0 0 20px 0", color: "var(--fontcolor)", fontSize: "14px" }}>
        Laden Sie Fotos aller Fassaden hoch, die aufgemessen werden sollen.
        Falls Sie keine Fotos zur Verfügung haben, können Sie im nächsten Schritt den Fensterflächenanteil manuell eingeben.
      </p>
      <div style={{ display: 'flex', justifyContent: 'space-around', gap: '20px', flexWrap: 'wrap' }}>
        {wallCentersData.map((item, idx) => (
          <ImageUpload
            key={idx}
            onImageSelect={(file) => handleImageSelect(file, idx + 1)}
            number={getCardinalDirection(item.originalIndex)}
            originalIndex={item.originalIndex}
            title={getAddressString()}
            ID_LOD2={lod2Id || undefined}
            initialPreviewUrl={imagePreviews[(item.originalIndex + 1).toString()]}
          />
        ))}
      </div>
    </div>
  );
};

export default ImageSlide;
