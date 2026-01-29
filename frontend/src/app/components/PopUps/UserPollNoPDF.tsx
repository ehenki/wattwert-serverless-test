'use client';
import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { uploadRating } from '../database/RatingUpload';

interface WallInfo {
    wallIndex: number;
    area: number;
    maxHeight: number;
}

interface UserPollProps {
  onRating: () => void;
  userId: string;
  accessToken: string;
  userRole?: string | null;
}

export default function UserPoll({ onRating, userId, accessToken, userRole }: UserPollProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [showHint, setShowHint] = useState(false);

  const handleRating = (rate: number) => {
    setRating(rate);
  };

  const isButtonDisabled = rating === 0 || feedbackText.trim() === '';

  const handleDownloadClick = async () => {
    if (isButtonDisabled) {
      setShowHint(true);
      setTimeout(() => setShowHint(false), 3000); // Hide hint after 3 seconds
      return;
    }

    await uploadRating({
      user_id: userId,
      rating: rating,
      note: feedbackText,
      user_role: userRole,
    }, accessToken);
    
    onRating(); // Set hasRated to true in localStorage
    
  };

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h3 style={{ marginBottom: '20px', color: 'var(--headlinecolor)' }}>Wie hilfreich fanden Sie das Schnellaufmaß?</h3>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '30px' }}>
        <span style={{ fontSize: '12px', color: '#666' }}>nicht nützlich</span>
        <div style={{ display: 'flex', gap: '5px' }}>
          {[...Array(10)].map((_, index) => {
            const ratingValue = index + 1;
            return (
              <div
                key={ratingValue}
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: ratingValue <= (hoverRating || rating) ? 'var(--base-col1)' : '#ccc',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                }}
                onClick={() => handleRating(ratingValue)}
                onMouseEnter={() => setHoverRating(ratingValue)}
                onMouseLeave={() => setHoverRating(0)}
              />
            );
          })}
        </div>
        <span style={{ fontSize: '12px', color: '#666' }}>sehr nützlich</span>
      </div>

      {rating > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <label style={{ display: 'block', marginBottom: '10px', color: 'var(--fontcolor)', fontSize: '14px' }}>
            {rating <= 8
              ? "Was können wir noch verbessern?"
              : "Was hat Ihnen besonders gut gefallen? Haben Sie noch Anregungen für weitere Funktionen?"}
          </label>
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            style={{
              width: '100%',
              minHeight: '80px',
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #ccc',
              fontSize: '14px',
              resize: 'vertical',
            }}
          />
        </div>
      )}
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <button
          onClick={handleDownloadClick}
          style={{
            backgroundColor: !isButtonDisabled ? 'var(--base-col1)' : '#ccc',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '6px',
            textDecoration: 'none',
            fontSize: '16px',
            fontWeight: '500',
            border: 'none',
            cursor: !isButtonDisabled ? 'pointer' : 'not-allowed',
          }}
        >
          Feedback abschicken
        </button>
        {showHint && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '8px',
            backgroundColor: 'var(--fontcolor)',
            color: 'var(--background)',
            padding: '6px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
          }}>
            Bitte zuerst die Bewertung ausfüllen
          </div>
        )}
      </div>
    </div>
  );
}
