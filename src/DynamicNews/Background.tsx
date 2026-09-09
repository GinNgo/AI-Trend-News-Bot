import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

export const DynamicBackground: React.FC<{
  primaryColor?: string;
  bgStyle?: 'hud' | 'particles' | 'grid' | 'minimal';
  totalDurationInFrames: number;
}> = ({ primaryColor = '#38bdf8', bgStyle = 'hud', totalDurationInFrames }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Dynamic orbits for Aurora orbs (Lissajous curves)
  const orb1X = Math.sin(frame * 0.02) * 220;
  const orb1Y = Math.cos(frame * 0.015) * 180;
  const orb2X = Math.cos(frame * 0.018) * 200;
  const orb2Y = Math.sin(frame * 0.022) * 160;

  // Infinite cyber highway grid motion
  const gridOffset = (frame * 2.5) % 80;

  // Slow rotation for tech rings
  const rot1 = (frame * 0.4) % 360;
  const rot2 = (-frame * 0.25) % 360;

  const accent = primaryColor;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#030712',
        overflow: 'hidden',
      }}
    >
      {/* 1. DEEP CINEMATIC BASE GRADIENT */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 30%, #0f172a 0%, #020617 100%)',
        }}
      />

      {/* 2. AURORA GLOW ORB 1 (PRIMARY ACCENT) */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: `translate(calc(-50% + ${orb1X}px), calc(-50% + ${orb1Y}px))`,
          width: '900px',
          height: '900px',
          borderRadius: '50%',
          background: `radial-gradient(circle, ${accent}44 0%, transparent 70%)`,
          filter: 'blur(90px)',
          pointerEvents: 'none',
        }}
      />

      {/* 3. AURORA GLOW ORB 2 (SECONDARY VIOLET/CYAN) */}
      <div
        style={{
          position: 'absolute',
          bottom: '20%',
          left: '50%',
          transform: `translate(calc(-50% + ${orb2X}px), calc(-50% + ${orb2Y}px))`,
          width: '750px',
          height: '750px',
          borderRadius: '50%',
          background: `radial-gradient(circle, #8b5cf633 0%, transparent 65%)`,
          filter: 'blur(100px)',
          pointerEvents: 'none',
        }}
      />

      {/* 4. STYLE: CYBER 3D GRID */}
      {bgStyle === 'grid' && (
        <div
          style={{
            position: 'absolute',
            bottom: '-150px',
            left: '-200px',
            right: '-200px',
            height: '1000px',
            perspective: '500px',
            pointerEvents: 'none',
            opacity: 0.35,
          }}
        >
          <div
            style={{
              width: '100%',
              height: '100%',
              transform: 'rotateX(72deg)',
              backgroundImage: `
                linear-gradient(${accent}40 2px, transparent 2px),
                linear-gradient(90deg, ${accent}40 2px, transparent 2px)
              `,
              backgroundSize: '80px 80px',
              backgroundPosition: `0px ${gridOffset}px`,
              maskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 85%)',
              WebkitMaskImage: 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 85%)',
            }}
          />
        </div>
      )}

      {/* 5. STYLE: TECH HUD RINGS */}
      {(bgStyle === 'hud' || !bgStyle) && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg
            style={{
              width: '1500px',
              height: '1500px',
              opacity: 0.18,
              transform: `rotate(${rot1}deg)`,
            }}
            viewBox="0 0 1000 1000"
          >
            <circle cx="500" cy="500" r="460" stroke={accent} strokeWidth="2" fill="none" strokeDasharray="20 40" />
            <circle cx="500" cy="500" r="380" stroke="#ffffff" strokeWidth="1.5" fill="none" strokeDasharray="40 80" />
            <circle cx="500" cy="500" r="280" stroke={accent} strokeWidth="3" fill="none" strokeDasharray="60 100" />
          </svg>

          {/* Secondary Reverse Ring */}
          <svg
            style={{
              position: 'absolute',
              width: '1100px',
              height: '1100px',
              opacity: 0.15,
              transform: `rotate(${rot2}deg)`,
            }}
            viewBox="0 0 1000 1000"
          >
            <circle cx="500" cy="500" r="320" stroke="#c084fc" strokeWidth="2" fill="none" strokeDasharray="15 35" />
            <circle cx="500" cy="500" r="200" stroke={accent} strokeWidth="2" fill="none" strokeDasharray="30 50" />
          </svg>
        </div>
      )}

      {/* 6. STYLE: FLOATING PARTICLES WITH TWINKLE */}
      {bgStyle === 'particles' && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {[...Array(24)].map((_, i) => {
            const pX = (i * 41 + 13) % 100;
            const speed = (i % 3) * 0.3 + 0.4;
            const pY = 100 - (((i * 29) + frame * speed) % 110);
            const pSize = (i % 5) * 2 + 4;
            const opacity = Math.sin((frame * 0.1) + i) * 0.3 + 0.5;

            return (
              <div
                key={i}
                style={{
                  position: 'absolute',
                  left: `${pX}%`,
                  top: `${pY}%`,
                  width: `${pSize}px`,
                  height: `${pSize}px`,
                  borderRadius: '50%',
                  backgroundColor: i % 2 === 0 ? accent : '#c084fc',
                  opacity: Math.max(0.1, opacity),
                  boxShadow: `0 0 16px ${accent}`,
                }}
              />
            );
          })}
        </div>
      )}

      {/* 7. VIGNETTE & FILM OVERLAY (TẠO ĐỘ SÂU ĐIỆN ẢNH) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 50%, transparent 40%, rgba(2, 6, 23, 0.85) 100%)',
          pointerEvents: 'none',
        }}
      />
    </AbsoluteFill>
  );
};
