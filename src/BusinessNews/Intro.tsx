import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig, Img, staticFile } from 'remotion';

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Very aggressive fast zoom for TikTok energy
  const zoom = interpolate(frame, [0, 200], [1, 1.3], {
    extrapolateRight: 'clamp',
  });

  const badgeScale = spring({
    frame,
    fps,
    config: { damping: 10, stiffness: 150, mass: 0.8 },
  });

  const titleScale = spring({
    frame: frame - 10,
    fps,
    config: { damping: 10, stiffness: 120, mass: 0.8 },
  });

  return (
    <div
      style={{
        flex: 1,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 40px',
        textAlign: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          transform: `scale(${zoom})`,
          zIndex: 0,
        }}
      >
        <Img
          src={staticFile('thue.webp')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'linear-gradient(to top, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.4) 50%, rgba(0, 0, 0, 0.8) 100%)',
          }}
        />
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '30px' }}>
        <div
          style={{
            transform: `scale(${badgeScale})`,
            backgroundColor: '#ef4444',
            color: '#ffffff',
            padding: '16px 40px',
            borderRadius: '24px',
            fontSize: '44px',
            fontWeight: '900',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            boxShadow: '0 10px 40px rgba(239, 68, 68, 0.8)',
            border: '4px solid white',
            marginBottom: '20px'
          }}
        >
          🚨 CẢNH BÁO
        </div>

        <div
          style={{
            transform: `scale(${titleScale})`,
            fontSize: '60px',
            fontWeight: '900',
            lineHeight: '1.4',
            color: '#facc15',
            textShadow: '0 8px 30px rgba(0, 0, 0, 1)',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: '20px',
            borderRadius: '20px',
            border: '2px solid rgba(255,255,255,0.2)'
          }}
        >
          DOANH NGHIỆP "CHẾT" LÂU NĂM
          <br/>
          <span style={{color: 'white'}}>VẪN PHẢI NỘP ĐỦ THUẾ!</span>
        </div>
      </div>
    </div>
  );
};
