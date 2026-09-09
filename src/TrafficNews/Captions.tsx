import React from 'react';
import { useCurrentFrame } from 'remotion';
import captionsData from '../../public/captions.json';

export const Captions: React.FC = () => {
  const frame = useCurrentFrame();

  // Find active caption
  const activeCaption = captionsData.find(
    (c) => frame >= c.start && frame <= c.end + 5
  );

  if (!activeCaption) {
    return null;
  }

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '120px',
        left: '40px',
        right: '40px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        textAlign: 'center',
        zIndex: 100,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          border: '3px solid #facc15',
          borderRadius: '24px',
          padding: '16px 28px',
          color: '#ffffff',
          fontSize: '38px',
          fontWeight: '900',
          lineHeight: '1.4',
          fontFamily: 'Inter, system-ui, sans-serif',
          textShadow: '0 4px 15px rgba(0,0,0,0.9)',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.7)',
        }}
      >
        <span style={{ color: '#facc15' }}>🗣️ </span>
        {activeCaption.text}
      </div>
    </div>
  );
};
