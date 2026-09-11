import React from 'react';
import { spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { DynamicSceneItem } from '../types';
import { tokens } from '../../design/tokens';
import { SafeArea } from '../../design/components/SafeArea';

// ---------------------------------------------------------------------------
// Local interfaces for fields not yet in DynamicSceneItem
// ---------------------------------------------------------------------------
interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

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
// Constants
// ---------------------------------------------------------------------------
const MAX_BARS = 5;
const BAR_STAGGER = 15; // frames between bar starts
const FIRST_BAR_START = 20;

// ---------------------------------------------------------------------------
// Default fallback palette for bars without explicit colour
// ---------------------------------------------------------------------------
const BAR_PALETTE = ['#38BDF8', '#818CF8', '#34D399', '#FBBF24', '#F472B6'];

// ---------------------------------------------------------------------------
// Single animated bar row
// ---------------------------------------------------------------------------
const AnimatedBar: React.FC<{
  item: ChartDataPoint;
  index: number;
  maxValue: number;
  accentColor: string;
}> = ({ item, index, maxValue, accentColor }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const startFrame = FIRST_BAR_START + index * BAR_STAGGER;

  // Spring-driven width
  const growProgress = spring({
    frame: frame - startFrame,
    fps,
    config: { damping: 14, stiffness: 80, mass: 0.9 },
  });
  const widthPct = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
  const currentWidth = growProgress * widthPct;

  // Entry slide-up
  const slideY = interpolate(growProgress, [0, 1], [40, 0]);
  const opacity = interpolate(growProgress, [0, 1], [0, 1]);

  // Value label fades in after bar is ~80 % grown
  const labelDelay = startFrame + 18;
  const labelOpacity = interpolate(frame, [labelDelay, labelDelay + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const barColor = item.color || BAR_PALETTE[index % BAR_PALETTE.length];

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${slideY}px)`,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: '100%',
      }}
    >
      {/* Label row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          fontSize: '32px',
          fontWeight: 700,
          color: tokens.colors.text.body,
        }}
      >
        <span>{item.label}</span>
        <span
          style={{
            opacity: labelOpacity,
            color: barColor,
            fontWeight: 900,
            fontSize: '34px',
            textShadow: `0 0 12px ${barColor}88`,
          }}
        >
          {item.value.toLocaleString()}
        </span>
      </div>

      {/* Bar track + fill */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '36px',
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderRadius: '18px',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${currentWidth}%`,
            height: '100%',
            borderRadius: '18px',
            background: `linear-gradient(90deg, ${barColor}CC 0%, ${barColor} 100%)`,
            boxShadow: `0 0 20px ${barColor}66, inset 0 2px 4px rgba(255,255,255,0.15)`,
            position: 'relative',
          }}
        >
          {/* Glow tip */}
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              width: '40px',
              height: '100%',
              background: `linear-gradient(90deg, transparent, ${barColor})`,
              filter: 'blur(6px)',
              borderRadius: '0 18px 18px 0',
            }}
          />
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Placeholder fallback (shown when no chartData is supplied)
// ---------------------------------------------------------------------------
const Placeholder: React.FC<{ color: string }> = ({ color }) => {
  const frame = useCurrentFrame();
  const pulse = 0.5 + Math.sin(frame * 0.06) * 0.15;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '24px',
        padding: '60px',
        opacity: pulse,
      }}
    >
      {[80, 60, 45, 30].map((w, i) => (
        <div
          key={i}
          style={{
            width: '100%',
            height: '36px',
            backgroundColor: 'rgba(255,255,255,0.06)',
            borderRadius: '18px',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${w}%`,
              height: '100%',
              borderRadius: '18px',
              background: `linear-gradient(90deg, ${color}44 0%, ${color}22 100%)`,
            }}
          />
        </div>
      ))}
      <div style={{ fontSize: '28px', color: tokens.colors.text.muted, fontWeight: 600 }}>
        No chart data available
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// LayoutBarChart
// ---------------------------------------------------------------------------
export const LayoutBarChart: React.FC<{ data: DynamicSceneItem; color: string }> = ({
  data,
  color,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const duration = data.seqDuration || 300;

  // ---- Resolve chart data ---------------------------------------------------
  const rawChartData: ChartDataPoint[] | undefined = (data as any).chartData;
  const chartData = rawChartData ? rawChartData.slice(0, MAX_BARS) : [];
  const maxValue = chartData.reduce((max, d) => Math.max(max, d.value), 0);

  // ---- Spring entrance -------------------------------------------------------
  const titleProgress = spring({ frame: frame - 5, fps, config: tokens.animation.spring.stiff });
  const titleY = interpolate(titleProgress, [0, 1], [60, 0]);
  const floatY = Math.sin(frame * 0.04) * 6;

  return (
    <SafeArea>
      <ProgressBar duration={duration} color={color} />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          gap: '36px',
          paddingTop: '40px',
          height: '100%',
        }}
      >
        {/* Header */}
        <div
          style={{
            transform: `translateY(${titleY + floatY}px)`,
            opacity: titleProgress,
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            width: '100%',
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
              📊 {data.tag || 'BIỂU ĐỒ'}
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

        {/* Chart area */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: '28px',
            width: '100%',
            backgroundColor: 'rgba(15,23,42,0.7)',
            padding: '40px 36px',
            borderRadius: '32px',
            border: `1px solid rgba(255,255,255,0.06)`,
            boxShadow: '0 30px 60px rgba(0,0,0,0.5)',
          }}
        >
          {chartData.length > 0 ? (
            chartData.map((item, idx) => (
              <AnimatedBar
                key={idx}
                item={item}
                index={idx}
                maxValue={maxValue}
                accentColor={color}
              />
            ))
          ) : (
            <Placeholder color={color} />
          )}
        </div>
      </div>
    </SafeArea>
  );
};
