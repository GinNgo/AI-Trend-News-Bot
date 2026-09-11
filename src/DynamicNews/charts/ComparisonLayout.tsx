import React from 'react';
import { spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { DynamicSceneItem } from '../types';
import { tokens } from '../../design/tokens';
import { SafeArea } from '../../design/components/SafeArea';

// ---------------------------------------------------------------------------
// Local interfaces
// ---------------------------------------------------------------------------
interface ComparisonItem {
  before: { label: string; value: string };
  after: { label: string; value: string };
}

// ---------------------------------------------------------------------------
// Shared sub-components (matching Scene.tsx patterns)
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

// ---------------------------------------------------------------------------
// Helper: derive comparison data from fallback
// ---------------------------------------------------------------------------
function deriveComparison(data: DynamicSceneItem): ComparisonItem | null {
  const comp = (data as any).comparisonData as ComparisonItem | undefined;
  if (comp?.before && comp?.after) return comp;

  // Fallback: use first 2 key takeaways
  const kts = data.keyTakeaways ?? [];
  if (kts.length >= 2) {
    return {
      before: { label: 'Trước', value: kts[0] },
      after: { label: 'Sau', value: kts[1] },
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main Layout
// ---------------------------------------------------------------------------
export const LayoutComparison: React.FC<{ data: DynamicSceneItem; color: string }> = ({
  data,
  color,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const comparison = deriveComparison(data);

  // Header spring
  const headerProgress = spring({ frame: frame - 5, fps, config: tokens.animation.spring.stiff });
  const headerY = interpolate(headerProgress, [0, 1], [60, 0]);
  const headerFloat = Math.sin(frame * 0.04) * 6;

  // Panel springs (staggered – left first, right shortly after)
  const leftEnter = spring({ frame: frame - 15, fps, config: { damping: 14, stiffness: 120, mass: 1 } });
  const rightEnter = spring({ frame: frame - 25, fps, config: { damping: 14, stiffness: 120, mass: 1 } });
  const leftX = interpolate(leftEnter, [0, 1], [-120, 0]);
  const rightX = interpolate(rightEnter, [0, 1], [120, 0]);

  // VS indicator spring (appears after both panels)
  const vsEnter = spring({ frame: frame - 35, fps, config: { damping: 10, stiffness: 200, mass: 0.6 } });
  const vsPulse = 1 + Math.sin(frame * 0.12) * 0.08;

  if (!comparison) {
    // Graceful empty state
    return (
      <SafeArea>
        <ProgressBar duration={data.seqDuration || 300} color={color} />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: '24px',
          }}
        >
          <div
            style={{
              fontSize: '64px',
              fontWeight: 900,
              color: tokens.colors.text.headline,
              textAlign: 'center',
            }}
          >
            <HighlightText text={data.headline} color={color} />
          </div>
          <AudioVisualizer color={color} />
        </div>
      </SafeArea>
    );
  }

  return (
    <SafeArea>
      <ProgressBar duration={data.seqDuration || 300} color={color} />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          gap: '32px',
          paddingTop: '20px',
          height: '100%',
        }}
      >
        {/* ---------- Header ---------- */}
        <div
          style={{
            transform: `translateY(${headerY + headerFloat}px)`,
            opacity: headerProgress,
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div
              style={{
                backgroundColor: 'rgba(255,255,255,0.1)',
                color,
                fontWeight: 800,
                fontSize: '28px',
                padding: '12px 32px',
                borderRadius: '99px',
                textTransform: 'uppercase',
                border: `1px solid ${color}44`,
              }}
            >
              ⚖️ {data.tag || 'SO SÁNH'}
            </div>
            <AudioVisualizer color={color} />
          </div>
          <div
            style={{
              fontSize: '64px',
              fontWeight: 900,
              color: tokens.colors.text.headline,
              lineHeight: tokens.typography.lineHeight.tight,
              textShadow: '0 10px 20px rgba(0,0,0,0.5)',
            }}
          >
            <HighlightText text={data.headline} color={color} />
          </div>
        </div>

        {/* ---------- Comparison Panels ---------- */}
        <div
          style={{
            display: 'flex',
            gap: '0px',
            flex: 1,
            alignItems: 'stretch',
            position: 'relative',
          }}
        >
          {/* ---- Left Panel (Before) ---- */}
          <div
            style={{
              flex: 1,
              opacity: leftEnter,
              transform: `translateX(${leftX}px)`,
              backgroundColor: 'rgba(239, 68, 68, 0.08)',
              borderRadius: '24px 0 0 24px',
              padding: '40px 36px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '20px',
              borderLeft: '6px solid rgba(239, 68, 68, 0.5)',
              borderTop: '1px solid rgba(239, 68, 68, 0.2)',
              borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
              boxShadow: 'inset 0 0 60px rgba(239, 68, 68, 0.05), 0 20px 40px rgba(0,0,0,0.3)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Subtle background icon */}
            <div
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                fontSize: '80px',
                opacity: 0.06,
                lineHeight: 1,
              }}
            >
              ◀
            </div>
            <div
              style={{
                fontSize: '80px',
                fontWeight: 900,
                color: '#fff',
                textAlign: 'center',
                lineHeight: 1.2,
                textShadow: '0 4px 20px rgba(239, 68, 68, 0.4)',
                wordBreak: 'break-word',
              }}
            >
              {comparison.before.value}
            </div>
            <div
              style={{
                fontSize: '30px',
                fontWeight: 700,
                color: 'rgba(239, 68, 68, 0.8)',
                textTransform: 'uppercase',
                letterSpacing: '2px',
              }}
            >
              {comparison.before.label}
            </div>
          </div>

          {/* ---- VS Indicator (center) ---- */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: `translate(-50%, -50%) scale(${vsEnter * vsPulse})`,
              zIndex: 20,
              width: '90px',
              height: '90px',
              borderRadius: '50%',
              backgroundColor: color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 40px ${color}88, 0 0 80px ${color}44`,
              border: '4px solid rgba(255,255,255,0.2)',
            }}
          >
            <span
              style={{
                fontSize: '32px',
                fontWeight: 900,
                color: '#fff',
                textShadow: '0 2px 8px rgba(0,0,0,0.5)',
              }}
            >
              VS
            </span>
          </div>

          {/* ---- Right Panel (After) ---- */}
          <div
            style={{
              flex: 1,
              opacity: rightEnter,
              transform: `translateX(${rightX}px)`,
              backgroundColor: 'rgba(34, 197, 94, 0.08)',
              borderRadius: '0 24px 24px 0',
              padding: '40px 36px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '20px',
              borderRight: '6px solid rgba(34, 197, 94, 0.5)',
              borderTop: '1px solid rgba(34, 197, 94, 0.2)',
              borderBottom: '1px solid rgba(34, 197, 94, 0.2)',
              boxShadow: 'inset 0 0 60px rgba(34, 197, 94, 0.05), 0 20px 40px rgba(0,0,0,0.3)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Subtle background icon */}
            <div
              style={{
                position: 'absolute',
                top: '20px',
                left: '20px',
                fontSize: '80px',
                opacity: 0.06,
                lineHeight: 1,
              }}
            >
              ▶
            </div>
            <div
              style={{
                fontSize: '80px',
                fontWeight: 900,
                color: '#fff',
                textAlign: 'center',
                lineHeight: 1.2,
                textShadow: '0 4px 20px rgba(34, 197, 94, 0.4)',
                wordBreak: 'break-word',
              }}
            >
              {comparison.after.value}
            </div>
            <div
              style={{
                fontSize: '30px',
                fontWeight: 700,
                color: 'rgba(34, 197, 94, 0.8)',
                textTransform: 'uppercase',
                letterSpacing: '2px',
              }}
            >
              {comparison.after.label}
            </div>
          </div>
        </div>

        {/* ---------- Key takeaway ---------- */}
        {data.keyTakeaways && data.keyTakeaways.length > 0 && (
          <div
            style={{
              opacity: rightEnter,
              transform: `translateY(${interpolate(rightEnter, [0, 1], [30, 0])}px)`,
              fontSize: tokens.typography.size.body,
              color: tokens.colors.text.body,
              lineHeight: tokens.typography.lineHeight.normal,
              backgroundColor: 'rgba(15,23,42,0.85)',
              padding: '24px 32px',
              borderRadius: '20px',
              borderLeft: `8px solid ${color}`,
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
            }}
          >
            <HighlightText text={data.keyTakeaways[0]} color={color} />
          </div>
        )}
      </div>
    </SafeArea>
  );
};
