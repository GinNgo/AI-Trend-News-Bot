import React from 'react';
import { spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { DynamicSceneItem } from '../types';
import { tokens } from '../../design/tokens';
import { SafeArea } from '../../design/components/SafeArea';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Try to extract a percentage or number from a stat string. */
const parsePercentage = (raw?: string): number | null => {
  if (!raw) return null;
  const match = raw.match(/([\d.]+)\s*%?/);
  if (!match) return null;
  const n = parseFloat(match[1]);
  return Number.isNaN(n) ? null : Math.min(n, 100);
};

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
// Ring constants
// ---------------------------------------------------------------------------
const RING_RADIUS = 180;
const STROKE_WIDTH = 22;
const SVG_SIZE = (RING_RADIUS + STROKE_WIDTH) * 2;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// ---------------------------------------------------------------------------
// LayoutProgressRing
// ---------------------------------------------------------------------------
export const LayoutProgressRing: React.FC<{ data: DynamicSceneItem; color: string }> = ({
  data,
  color,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = data.seqDuration || 300;

  // ---- Resolve progress value ------------------------------------------------
  const targetValue: number =
    (data as any).progressValue ??
    parsePercentage((data as any).statNumber ?? data.statNumber) ??
    75; // sensible default

  const progressLabel: string =
    (data as any).progressLabel || data.statLabel || data.keyTakeaways?.[0] || '';

  // ---- Animation timing (counter + ring) ------------------------------------
  const animStart = 15;
  const animEnd = Math.min(duration - 30, 100);

  const animatedValue = interpolate(frame, [animStart, animEnd], [0, targetValue], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const displayPercent = Math.round(animatedValue);

  // stroke-dashoffset drives the ring fill
  const dashOffset = CIRCUMFERENCE * (1 - animatedValue / 100);

  // ---- Glow trail: a small bright dot following the arc tip ------------------
  const arcAngle = ((animatedValue / 100) * 360 - 90) * (Math.PI / 180);
  const tipX = SVG_SIZE / 2 + RING_RADIUS * Math.cos(arcAngle);
  const tipY = SVG_SIZE / 2 + RING_RADIUS * Math.sin(arcAngle);
  const tipGlow = interpolate(animatedValue, [0, 100], [8, 28], { extrapolateRight: 'clamp' });

  // ---- Spring entrance -------------------------------------------------------
  const titleProgress = spring({ frame: frame - 5, fps, config: tokens.animation.spring.stiff });
  const titleY = interpolate(titleProgress, [0, 1], [60, 0]);
  const floatY = Math.sin(frame * 0.04) * 6;

  // ---- Pulse on the counter number ------------------------------------------
  const pulse = 1 + Math.sin(frame * 0.08) * 0.03;

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
          gap: '32px',
          position: 'relative',
        }}
      >
        {/* Ambient glow */}
        <div
          style={{
            position: 'absolute',
            top: '45%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '400px',
            height: '400px',
            backgroundColor: color,
            filter: 'blur(160px)',
            opacity: 0.2 + (animatedValue / 100) * 0.15,
            zIndex: -1,
          }}
        />

        {/* Tag badge + headline */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
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
            📈 {data.tag || 'TIẾN ĐỘ'}
          </div>
          <div
            style={{
              fontSize: '56px',
              fontWeight: 900,
              color: tokens.colors.text.headline,
              textAlign: 'center',
              lineHeight: 1.2,
              textShadow: '0 8px 20px rgba(0,0,0,0.5)',
            }}
          >
            <HighlightText text={data.headline} color={color} />
          </div>
        </div>

        {/* SVG Ring */}
        <div style={{ position: 'relative', width: `${SVG_SIZE}px`, height: `${SVG_SIZE}px` }}>
          <svg
            width={SVG_SIZE}
            height={SVG_SIZE}
            viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
            style={{ transform: 'rotate(-90deg)' }}
          >
            {/* Background track */}
            <circle
              cx={SVG_SIZE / 2}
              cy={SVG_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={STROKE_WIDTH}
            />
            {/* Animated fill */}
            <circle
              cx={SVG_SIZE / 2}
              cy={SVG_SIZE / 2}
              r={RING_RADIUS}
              fill="none"
              stroke={color}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={dashOffset}
              style={{
                filter: `drop-shadow(0 0 ${tipGlow}px ${color})`,
              }}
            />
          </svg>

          {/* Glow tip dot (rendered on top, un-rotated) */}
          {animatedValue > 0.5 && (
            <div
              style={{
                position: 'absolute',
                left: `${tipX}px`,
                top: `${tipY}px`,
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: '#fff',
                boxShadow: `0 0 ${tipGlow}px ${tipGlow / 2}px ${color}, 0 0 ${tipGlow * 2}px ${color}`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          )}

          {/* Center counter text */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                fontSize: '120px',
                fontWeight: 900,
                color: '#fff',
                lineHeight: 1,
                transform: `scale(${pulse})`,
                textShadow: `0 0 30px ${color}88, 0 10px 30px rgba(0,0,0,0.5)`,
              }}
            >
              {displayPercent}
              <span style={{ fontSize: '60px', fontWeight: 700, color: tokens.colors.text.muted }}>
                %
              </span>
            </div>
          </div>
        </div>

        {/* Audio visualizer */}
        <AudioVisualizer color={color} />

        {/* Label below ring */}
        {progressLabel && (
          <div
            style={{
              opacity: titleProgress,
              transform: `translateY(${Math.sin(frame * 0.04) * 6}px)`,
              backgroundColor: 'rgba(15,23,42,0.95)',
              padding: '28px 48px',
              borderRadius: '28px',
              borderTop: `6px solid ${color}`,
              boxShadow: '0 24px 50px rgba(0,0,0,0.6)',
              fontSize: '38px',
              fontWeight: 700,
              color: tokens.colors.text.body,
              textAlign: 'center',
              maxWidth: '90%',
            }}
          >
            <HighlightText text={progressLabel} color={color} />
          </div>
        )}
      </div>
    </SafeArea>
  );
};
