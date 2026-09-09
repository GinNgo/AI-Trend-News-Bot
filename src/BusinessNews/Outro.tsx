import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame: frame - 5,
    fps,
    config: { damping: 10, stiffness: 120, mass: 0.8 },
  });

  const ctaScale = spring({
    frame: frame - 40,
    fps,
    config: { damping: 10, stiffness: 150 },
  });

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 50px',
        color: 'white',
        fontFamily: 'Inter, system-ui, sans-serif',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          backgroundColor: '#22c55e',
          padding: '40px',
          borderRadius: '30px',
          border: '4px solid white',
          boxShadow: '0 20px 50px rgba(34, 197, 94, 0.4)',
          marginBottom: '60px'
        }}
      >
        <div style={{ fontSize: '100px', marginBottom: '10px' }}>⚡</div>
        <div style={{ fontSize: '48px', fontWeight: '900', color: 'white', marginBottom: '16px' }}>
          GIẢI QUYẾT TRONG 3 NGÀY
        </div>
        <div style={{ fontSize: '32px', fontWeight: '800', color: '#ecfdf5' }}>
          Ngay sau khi nộp đủ tiền!
        </div>
      </div>

      <div
        style={{
          transform: `scale(${Math.max(0, ctaScale)})`,
          fontSize: '44px',
          color: '#ffffff',
          fontWeight: '900',
          textTransform: 'uppercase',
          backgroundColor: '#ef4444',
          padding: '24px 40px',
          borderRadius: '9999px',
          boxShadow: '0 10px 30px rgba(239, 68, 68, 0.6)'
        }}
      >
        ❤️ FOLLOW ĐỂ KHỎI MẤT TIỀN OAN!
      </div>
    </div>
  );
};
