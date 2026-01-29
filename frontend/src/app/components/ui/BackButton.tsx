'use client';

import { useRouter } from 'next/navigation';

interface BackButtonProps {
  style?: React.CSSProperties;
}

export default function BackButton({ style }: BackButtonProps) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      style={{
        position: 'absolute',
        top: '0px',
        left: '-100px', // Positioned to the left of the text block
        padding: '10px 15px',
        backgroundColor: 'var(--base-col1)',
        color: 'white',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: '500',
        zIndex: 1000,
        ...style
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.backgroundColor = "var(--base-col1-hover)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.backgroundColor = "var(--base-col1)";
      }}
    >
      Zurück
    </button>
  );
}

