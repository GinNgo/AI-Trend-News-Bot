import React from 'react';
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Img,
  staticFile,
} from 'remotion';

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Subtle Ken Burns zoom effect on image
  const zoom = interpolate(frame, [0, 100], [1, 1.15], {
    extrapolateRight: 'clamp',
  });

  // Entrance spring for badge
  const badgeScale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 120 },
  });

  // Title translation and opacity
  const titleOpacity = interpolate(frame, [10, 25], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const titleY = interpolate(frame, [10, 25], [40, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Match info scale
  const matchScale = spring({
    frame: frame - 20,
    fps,
    config: { damping: 14, stiffness: 100 },
  });

  return (
    <div
      style={{
        flex: 1,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '0 40px 100px 40px',
        textAlign: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Background Mourinho Image with Ken Burns zoom */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          transform: `scale(${zoom})`,
          zIndex: 0,
        }}
      >
        <Img
          src={staticFile('mourinho.jpg')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center 20%',
          }}
        />
        {/* Dark Vignette & Gradient Overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background:
              'linear-gradient(to bottom, rgba(15, 23, 42, 0.4) 0%, rgba(15, 23, 42, 0.7) 50%, rgba(15, 23, 42, 0.98) 100%)',
          }}
        />
      </div>

      {/* Content Container */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
        }}
      >
        {/* Breaking News Badge */}
        <div
          style={{
            transform: `scale(${badgeScale})`,
            backgroundColor: '#e11d48',
            color: '#ffffff',
            padding: '12px 32px',
            borderRadius: '9999px',
            fontSize: '28px',
            fontWeight: '900',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            boxShadow: '0 10px 30px rgba(225, 29, 72, 0.6)',
            marginBottom: '30px',
          }}
        >
          🔥 TIN NÓNG C1
        </div>

        {/* Main Title */}
        <div
          style={{
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            fontSize: '56px',
            fontWeight: '900',
            lineHeight: '1.2',
            color: '#ffffff',
            textShadow: '0 4px 30px rgba(0, 0, 0, 0.9)',
            marginBottom: '35px',
          }}
        >
          HLV MOURINHO THẮNG NGHẸT THỞ ĐỘI BÓNG CŨ INTER MILAN
        </div>

        {/* Matchup Banner */}
        <div
          style={{
            transform: `scale(${Math.max(0, matchScale)})`,
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(15px)',
            border: '2px solid rgba(255, 255, 255, 0.25)',
            padding: '16px 36px',
            borderRadius: '24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          }}
        >
          <span style={{ fontSize: '36px', fontWeight: '900', color: '#60a5fa' }}>
            REAL MADRID
          </span>
          <span
            style={{
              fontSize: '28px',
              fontWeight: '900',
              color: '#facc15',
              padding: '6px 14px',
              backgroundColor: 'rgba(0,0,0,0.6)',
              borderRadius: '12px',
            }}
          >
            VS
          </span>
          <span style={{ fontSize: '36px', fontWeight: '900', color: '#38bdf8' }}>
            INTER MILAN
          </span>
        </div>
      </div>
    </div>
  );
};
