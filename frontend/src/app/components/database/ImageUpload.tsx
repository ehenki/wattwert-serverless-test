import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/contexts/AuthContext';
import eventBus from '../helpers/eventBus';
import { createClient } from '@supabase/supabase-js';
import { wallCenterIndexToFacadeId } from '@/app/helpers/directionUtils';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Utility function to detect mobile devices
const isMobileDevice = () => {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (window.innerWidth <= 1024) || // Increased threshold for tablets
         ('ontouchstart' in window) ||
         (navigator.maxTouchPoints > 0);
};

interface ImageUploadProps {
  onImageSelect: (file: File) => void;
  title?: string;
  description?: string;
  ID_LOD2?: string;
  tags?: string[];
  location?: { x: number; y: number };
  className?: string;
  number?: number | string;
  originalIndex?: number;
  initialPreviewUrl?: string;
}

interface FacadeImage {
  ID_LOD2: string;
  facade_id: string;
  tags: string[];
  title?: string;
  storage_path?: string;
  public_url?: string;
  size_bytes?: number;
  width?: number;
  height?: number;
  user_id?: string;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  onImageSelect,
  title = "Bild hochladen",
  description,
  ID_LOD2,
  tags = [],
  location,
  className = "",
  number,
  originalIndex,
  initialPreviewUrl
}) => {
  // Set description based on number if not provided
  const displayDescription = description || (number ? `${number}` : "Drag and drop an image here or click to browse");
  const [isDragOver, setIsDragOver] = useState(false);
  const [preview, setPreview] = useState<string | null>(initialPreviewUrl || null);
  const [uploading, setUploading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileOptions, setShowMobileOptions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const { session } = useAuth();

  // Check if device is mobile on mount
  useEffect(() => {
    setIsMobile(isMobileDevice());
  }, []);

  useEffect(() => {
    const handleTriggerUpload = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail.number === number) {
        if (isMobile) {
          setShowMobileOptions(true);
        } else {
          fileInputRef.current?.click();
        }
      }
    };

    eventBus.on('trigger-image-upload', handleTriggerUpload);
    return () => {
      eventBus.off('trigger-image-upload', handleTriggerUpload);
    };
  }, [number, isMobile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      handleFileSelect(imageFile);
    }
  }, []);

  const uploadFacadeImage = async (imageData: FacadeImage): Promise<{ success: boolean; error?: any }> => {
    if (!imageData.ID_LOD2 || !imageData.facade_id || !imageData.user_id || !imageData.tags || imageData.tags.length === 0) {
      console.error('ID_LOD2, facade_id, user_id, or tags are missing.');
      return { success: false, error: 'Missing required parameters' };
    }

    try {
      // Check if an entry with the same ID_LOD2, facade_id, AND tags already exists
      const { data: existingRecords, error: fetchError } = await supabase
        .from('facade_image')
        .select('*')
        .eq('ID_LOD2', imageData.ID_LOD2)
        .eq('facade_id', imageData.facade_id)
        .contains('tags', imageData.tags);

      if (fetchError) {
        console.error('Error checking existing facade image:', fetchError);
        return { success: false, error: fetchError };
      }

      const hasExisting = existingRecords && existingRecords.length > 0;

      const dataToUpsert = {
        ID_LOD2: imageData.ID_LOD2,
        facade_id: imageData.facade_id,
        tags: imageData.tags,
        title: imageData.title || null,
        storage_path: imageData.storage_path || null,
        public_url: imageData.public_url || null,
        size_bytes: imageData.size_bytes || null,
        width: imageData.width || null,
        height: imageData.height || null
        // user_id is handled by database default auth.uid()
      };

      if (hasExisting) {
        // Update existing entry
        const { error } = await supabase
          .from('facade_image')
          .update(dataToUpsert)
          .eq('ID_LOD2', imageData.ID_LOD2)
          .eq('facade_id', imageData.facade_id)
          .contains('tags', imageData.tags);

        if (error) {
          console.error('Error updating facade image:', error);
          return { success: false, error };
        }
      } else {
        // Insert new entry
        const { error } = await supabase
          .from('facade_image')
          .insert(dataToUpsert);

        if (error) {
          console.error('Error inserting facade image:', error);
          return { success: false, error };
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Exception in uploadFacadeImage:', error);
      return { success: false, error };
    }
  };

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    if (!session || !session.user?.id) {
      alert('You must be logged in to upload images');
      return;
    }

    if (!ID_LOD2) {
      alert('Building ID is missing');
      return;
    }

    if (originalIndex === undefined) {
      alert('Facade direction information is missing');
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Call parent handler
    onImageSelect(file);

    // Get image dimensions
    const img = new Image();
    const imageLoadPromise = new Promise<{ width: number; height: number }>((resolve) => {
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.src = URL.createObjectURL(file);
    });

    setUploading(true);
    try {
      // Derive facade_id from originalIndex
      const facadeId = wallCenterIndexToFacadeId(originalIndex);

      // Upload to Supabase Storage: user_id/ID_LOD2/filename
      const fileExt = file.name.split('.').pop();
      const timestamp = Date.now();
      const fileName = `${timestamp}.${fileExt}`;
      const storagePath = `${session.user.id}/${ID_LOD2}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('facade_images')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        alert('Failed to upload image to storage');
        return;
      }

      // Get image dimensions
      const { width, height } = await imageLoadPromise;

      // Save metadata to database
      // Note: We don't store public_url because the bucket is not public
      // Instead, ImageDownloader will create signed URLs when needed
      const facadeImageData: FacadeImage = {
        ID_LOD2: ID_LOD2,
        facade_id: String(facadeId),
        tags: ['photo'],
        title: title,
        storage_path: storagePath,
        // public_url is omitted - will be undefined, ImageDownloader will use signed URLs
        size_bytes: file.size,
        width: width,
        height: height,
        user_id: session.user.id
      };

      const result = await uploadFacadeImage(facadeImageData);
      
      if (result.success) {
        console.log('Image uploaded successfully:', {
          facade_id: facadeId,
          storage_path: storagePath
        });
        
        // Dispatch event to notify that images should be refreshed
        eventBus.dispatch('facade-image-uploaded', { 
          ID_LOD2: ID_LOD2,
          facade_id: String(facadeId)
        });
      } else {
        alert('Failed to save image metadata');
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  }, [onImageSelect, title, ID_LOD2, session, originalIndex]);

  useEffect(() => {
    if (initialPreviewUrl) {
      setPreview(initialPreviewUrl);
    }
  }, [initialPreviewUrl]);

  const handleClick = useCallback(() => {
    if (isMobile) {
      setShowMobileOptions(true);
    } else {
      fileInputRef.current?.click();
    }
  }, [isMobile]);

  const handleCameraClick = useCallback(() => {
    setShowMobileOptions(false);
    cameraInputRef.current?.click();
  }, []);

  const handleGalleryClick = useCallback(() => {
    setShowMobileOptions(false);
    galleryInputRef.current?.click();
  }, []);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  return (
    <div className={className}>
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          width: '200px',
          height: '120px',
          border: `2px dashed ${isDragOver ? 'var(--base-col1)' : 'var(--base-grey-light)'}`,
          borderRadius: '8px',
          textAlign: 'center',
          cursor: uploading ? 'wait' : 'pointer',
          backgroundColor: isDragOver ? 'var(--base-grey-light)' : 'var(--background)',
          transition: 'all 0.2s ease',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          overflow: 'hidden',
          margin: '0 auto',
          opacity: uploading ? 0.6 : 1
        }}
        onMouseOver={(e) => {
          if (!uploading) {
            e.currentTarget.style.border = `2px solid var(--base-col1-hover)`;
          }
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.border = `2px dashed  var(--base-grey-light)`;
        }}
      >
        {number && (
          <div style={{
            position: 'absolute',
            top: 8,
            left: 8,
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'var(--base-col1)',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 16,
            zIndex: 3,
            boxShadow: '0 1px 4px rgba(0,0,0,0.10)'
          }}>
            {number}
          </div>
        )}
        {uploading && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 4,
            color: 'var(--base-col1)',
            fontSize: '14px',
            fontWeight: 600
          }}>
            Uploading...
          </div>
        )}
        {preview ? (
          <div style={{ width: '100%', height: '100%' }}>
            <img
              src={preview}
              alt="Preview"
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '4px',
                objectFit: 'cover',
                display: 'block'
              }}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                setPreview(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
              disabled={uploading}
              style={{
                position: 'absolute',
                bottom: '8px',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '6px 14px',
                backgroundColor: uploading ? '#ccc' : 'var(--base-col1)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: uploading ? 'not-allowed' : 'pointer',
                fontSize: '13px',
                zIndex: 2
              }}
              onMouseOver={(e) => {
                if (!uploading) {
                  e.currentTarget.style.backgroundColor = "var(--base-col1-hover)";
                }
              }}
              onMouseOut={(e) => {
                if (!uploading) {
                  e.currentTarget.style.backgroundColor = "var(--base-col1)";
                }
              }}
            >
              Remove
            </button>
          </div>
        ) : (
          <>
            <div
              style={{
                width: '48px',
                height: '48px',
                border: `2px solid var(--base-col1)`,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '8px',
                marginTop: '8px'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.border = `2px solid var(--base-col1-hover)`;
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.border = `2px solid var(--base-col1)`;
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
            <div>
              <h3 style={{ margin: '0 0 4px 0', color: 'var(--base-grey)', fontSize: '15px' }}>
                {"Bild " + number + " hochladen"}
              </h3>
            </div>
          </>
        )}
      </div>
      
      {/* Mobile Options Modal */}
      {showMobileOptions && typeof document !== 'undefined' && createPortal(
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)', // Slightly darker
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999 // Very high z-index
          }}
          onClick={() => setShowMobileOptions(false)}
        >
          <div 
            style={{
              backgroundColor: 'var(--background)',
              borderRadius: '16px',
              padding: '24px',
              margin: '20px',
              maxWidth: '320px',
              width: '100%',
              boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
              animation: 'modalFadeIn 0.3s ease-out'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <style>{`
              @keyframes modalFadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
              }
            `}</style>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <button
                onClick={handleCameraClick}
                style={{
                  padding: '18px',
                  backgroundColor: 'var(--base-col1)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '17px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
              >
                <span style={{ fontSize: '24px' }}>📷</span> Kamera verwenden
              </button>
              <button
                onClick={handleGalleryClick}
                style={{
                  padding: '18px',
                  backgroundColor: '#f0f0f0',
                  color: '#333',
                  border: '1px solid #e0e0e0',
                  borderRadius: '12px',
                  fontSize: '17px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px'
                }}
              >
                <span style={{ fontSize: '24px' }}>🖼️</span> Aus Galerie wählen
              </button>
              <button
                onClick={() => setShowMobileOptions(false)}
                style={{
                  padding: '14px',
                  marginTop: '8px',
                  backgroundColor: 'transparent',
                  color: '#888',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '15px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* File inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
        disabled={uploading}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
        disabled={uploading}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInputChange}
        style={{ display: 'none' }}
        disabled={uploading}
      />
    </div>
  );
};

export default ImageUpload;
