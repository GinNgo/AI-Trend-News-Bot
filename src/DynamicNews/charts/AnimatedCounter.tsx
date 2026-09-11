import React from 'react';
import { spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { DynamicSceneItem } from '../types';
import { tokens } from '../../design/tokens';
import { SafeArea } from '../../design/components/SafeArea';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Highlight **bold** segments inside a string. */
const HighlightText: React.FC<{ text: string; color: string }> = ({ text, color }) => {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <span key={i} style={{ color, fontWeight: 900 }}>
              {part.slice(2, -2)}
            </span>
          );
        }
        return part;
      })}
    </>
  );
};

/** Try to extract a numeric value from a string like "1.2M", "$500K", "85%". */
const parseNumericValue = (raw?: string): number | null => {
  if (!raw) return null;
  const cleaned = raw.replace(/[^0-9.\-]/g, '');
  const n = parseFloat(cleaned);
  if (Number.isNaN(n)) return null;
  // Account for K / M / B suffixes in the original string
  const upper = raw.toUpperCase();
  if (upper.includes('B') || upper.includes('TỶ')) return n * 1_000_000_000;
  if (upper.includes('M') || upper.includes('TRIỆU')) return n * 1_000_000;
  if (upper.includes('K') || upper.includes('NGHÌN') || upper.includes('NGÀN')) return n * 1_000;
  return n;
};

/** Auto-format a large number for display (e.g. 1 200 000 → "1.2M" or "1,2 triệu"). */
const formatLargeNumber = (value: number, language?: string): string => {
  const isVi = language?.toLowerCase().startsWith('vi');
  const abs = Math.abs(value);

  if (abs >= 1_000_000_000) {
    const v = value / 1_000_000_000;
    return isVi
      ? `${v.toFixed(v % 1 === 0 ? 0 : 1).replace('.', ',')} tỷ`
      : `${v.toFixed(v % 1 === 0 ? 0 : 1)}B`;
  }
  if (abs >= 1_000_000) {
    const v = value / 1_000_000;
    return isVi
      ? `${v.toFixed(v % 1 === 0 ? 0 : 1).replace('.', ',')} triệu`
      : `${v.toFixed(v % 1 === 0 ? 0 : 1)}M`;
  }
  if (abs >= 10_000) {
    const v = value / 1_000;
    return isVi
      ? `${v.toFixed(v % 1 === 0 ? 0 : 1).replace('.', ',')} nghìn`
      : `${v.toFixed(v % 1 === 0 ? 0 : 1)}K`;
  }
  // Small numbers – use locale formatting
  return isVi
    ? value.toLocaleString('vi-VN')
    : value.toLocaleString('en-US');
};

// ---------------------------------------------------------------------------
// Sub-components (mirroring Scene.tsx patterns)
// ---------------------------------------------------------------------------

const ProgressBar: React.FC<{ duration: number; color: string }> = ({ duration, color }) => {
  const frame = useCurrentFrame();
  const width = interpolate(frame, [0, duration], [0, 100], { extrapolateRight: 'clamp' });
  const pulse = 0.7 + Math.sin(frame * 0.1) * 0.3;
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        height: '10px',
        width: `${width}%`,
        backgroundColor: color,
        boxShadow: `0 0 20px ${color}`,
        zIndex: 10,
        opacity: pulse,
      }}
    />
  );
};

const AudioVisualizer: React.FC<{ color: string }> = ({ color }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', height: '40px', marginTop: '10px' }}>
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const height = 12 + Math.abs(Math.sin(frame * 0.25 + i * 1.2)) * 25;
        return (
          <div
            key={i}
            style={{
              width: '8px',
              height: `${height}px`,
              backgroundColor: color,
              borderRadius: '4px',
              boxShadow: `0 0 10px ${color}`,
            }}
          />
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Particle burst (fires once counter reaches ≥90 % of target)
// ---------------------------------------------------------------------------
const PARTICLE_COUNT = 18;

const ParticleBurst: React.FC<{ color: string; burstFrame: number }> = ({ color, burstFrame }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const elapsed = frame - burstFrame;
  if (elapsed < 0) return null;

  return (
    <>
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
        const angle = (360 / PARTICLE_COUNT) * i;
        const rad = (angle * Math.PI) / 180;
        const distance = spring({
          frame: elapsed,
          fps,
          config: { damping: 22, stiffness: 60, mass: 0.4 },
        });
        const x = Math.cos(rad) * distance * 260;
        const y = Math.sin(rad) * distance * 260;
        const opacity = interpolate(elapsed, [0, 40], [1, 0], { extrapolateRight: 'clamp' });
        const size = 6 + (i % 3) * 4;

        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: `${size}px`,
              height: `${size}px`,
              borderRadius: '50%',
              backgroundColor: i % 2 === 0 ? color : '#fff',
              boxShadow: `0 0 12px ${color}`,
              transform: `translate(${x}px, ${y}px)`,
              opacity,
              pointerEvents: 'none',
            }}
          />
        );
      })}
    </>
  );
};

// ---------------------------------------------------------------------------
// LayoutAnimatedCounter
// ---------------------------------------------------------------------------
export const LayoutAnimatedCounter: React.FC<{ data: DynamicSceneItem; color: string }> = ({
  data,
  color,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = data.seqDuration || 300;

  // ---- Resolve target number ------------------------------------------------
  const counterTarget: number =
    (data as any).counterTarget ??
    parseNumericValue((data as any).statNumber ?? data.statNumber) ??
    100;

  const prefix: string = (data as any).counterPrefix ?? '';
  const suffix: string = (data as any).counterSuffix ?? '';
  const language: string = (data as any).language ?? 'en';

  // ---- Animation timing -----------------------------------------------------
  const countStart = 15;
  const countEnd = Math.min(duration - 30, 120);
  const rawValue = interpolate(frame, [countStart, countEnd], [0, counterTarget], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const currentValue = Math.round(rawValue);
  const progress = counterTarget > 0 ? currentValue / counterTarget : 0;

  // ---- Glow intensity ramps up with progress --------------------------------
  const glowRadius = interpolate(progress, [0, 1], [10, 60], { extrapolateRight: 'clamp' });
  const glowOpacity = interpolate(progress, [0, 1], [0.3, 1], { extrapolateRight: 'clamp' });

  // ---- Particle burst at 90 % -----------------------------------------------
  const burstThreshold = 0.9;
  const burstFrame =
    counterTarget > 0
      ? Math.round(
          interpolate(counterTarget * burstThreshold, [0, counterTarget], [countStart, countEnd])
        )
      : -1;
  const showBurst = frame >= burstFrame && burstFrame > 0;

  // ---- Spring entrance -------------------------------------------------------
  const titleProgress = spring({ frame: frame - 5, fps, config: tokens.animation.spring.stiff });
  const titleY = interpolate(titleProgress, [0, 1], [60, 0]);
  const floatY = Math.sin(frame * 0.04) * 6;

  // ---- Formatted display value -----------------------------------------------
  const displayValue = `${prefix}${formatLargeNumber(currentValue, language)}${suffix}`;

  // ---- Dynamic font size based on display length ----------------------------
  const fontSize = displayValue.length > 14 ? '80px' : displayValue.length > 8 ? '110px' : '140px';

  // ---- Stat label fallback ---------------------------------------------------
  const statLabel =
    (data as any).statLabel || data.statLabel || data.keyTakeaways?.[0] || '';

  return (
    <SafeArea>
      <ProgressBar duration={duration} color={color} />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          gap: '36px',
          position: 'relative',
        }}
      >
        {/* Ambient glow background */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '340px',
            height: '340px',
            backgroundColor: color,
            filter: `blur(${120 + glowRadius}px)`,
            opacity: 0.25 + glowOpacity * 0.2,
            zIndex: -1,
          }}
        />

        {/* Tag badge + headline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            opacity: titleProgress,
            transform: `translateY(${titleY + floatY}px)`,
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(0,0,0,0.6)',
              padding: '12px 32px',
              borderRadius: '99px',
              color,
              fontWeight: 900,
              fontSize: '28px',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              border: `2px solid ${color}66`,
            }}
          >
            📊 {data.tag || 'CHỈ SỐ'}
          </div>
          <div
            style={{
              fontSize: '60px',
              fontWeight: 900,
              color: tokens.colors.text.headline,
              textAlign: 'center',
              lineHeight: 1.2,
            }}
          >
            <HighlightText text={data.headline} color={color} />
          </div>
        </div>

        {/* Animated counter */}
        <div style={{ position: 'relative' }}>
          <div
            style={{
              fontSize,
              fontWeight: 900,
              color: '#fff',
              lineHeight: 1,
              textAlign: 'center',
              textShadow: `0 0 ${glowRadius}px ${color}, 0 0 ${glowRadius * 2}px ${color}88, 0 20px 40px rgba(0,0,0,0.5)`,
              transform: `scale(${1 + Math.sin(frame * 0.08) * 0.03})`,
            }}
          >
            {displayValue}
          </div>
          {showBurst && <ParticleBurst color={color} burstFrame={burstFrame} />}
        </div>

        {/* Audio visualizer */}
        <AudioVisualizer color={color} />

        {/* Stat label card */}
        {statLabel && (
          <div
            style={{
              opacity: titleProgress,
              transform: `translateY(${Math.sin(frame * 0.04) * 8}px)`,
              backgroundColor: 'rgba(15,23,42,0.95)',
              padding: '32px 48px',
              borderRadius: '32px',
              borderTop: `6px solid ${color}`,
              boxShadow: '0 30px 60px rgba(0,0,0,0.6)',
              fontSize: '40px',
              fontWeight: 700,
              color: tokens.colors.text.body,
              textAlign: 'center',
              maxWidth: '90%',
            }}
          >
            <HighlightText text={statLabel} color={color} />
          </div>
        )}
      </div>
    </SafeArea>
  );
};
