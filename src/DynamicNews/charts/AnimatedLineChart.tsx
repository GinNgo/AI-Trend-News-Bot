import React, { useMemo } from 'react';
import { spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { DynamicSceneItem } from '../types';
import { tokens } from '../../design/tokens';
import { SafeArea } from '../../design/components/SafeArea';

// ---------------------------------------------------------------------------
// Local interfaces
// ---------------------------------------------------------------------------
interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
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
// Chart constants
// ---------------------------------------------------------------------------
const CHART_PADDING = { top: 30, right: 40, bottom: 60, left: 70 };
const CHART_WIDTH = 920;
const CHART_HEIGHT = 420;
const INNER_W = CHART_WIDTH - CHART_PADDING.left - CHART_PADDING.right;
const INNER_H = CHART_HEIGHT - CHART_PADDING.top - CHART_PADDING.bottom;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildPath(points: { x: number; y: number }[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
}

function buildAreaPath(points: { x: number; y: number }[], baseline: number): string {
  if (points.length === 0) return '';
  const linePart = buildPath(points);
  const last = points[points.length - 1];
  const first = points[0];
  return `${linePart} L${last.x},${baseline} L${first.x},${baseline} Z`;
}

function totalLength(points: { x: number; y: number }[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    len += Math.sqrt(dx * dx + dy * dy);
  }
  return len;
}

/** Cumulative distance from start for each point */
function cumulativeDistances(points: { x: number; y: number }[]): number[] {
  const dists = [0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    dists.push(dists[i - 1] + Math.sqrt(dx * dx + dy * dy));
  }
  return dists;
}

// ---------------------------------------------------------------------------
// Placeholder wave (when no chartData)
// ---------------------------------------------------------------------------
const PlaceholderWave: React.FC<{ color: string }> = ({ color }) => {
  const frame = useCurrentFrame();
  const points: { x: number; y: number }[] = [];
  const numPoints = 40;
  for (let i = 0; i <= numPoints; i++) {
    const x = CHART_PADDING.left + (i / numPoints) * INNER_W;
    const base = CHART_PADDING.top + INNER_H * 0.5;
    const y = base + Math.sin((i / numPoints) * Math.PI * 3 + frame * 0.06) * INNER_H * 0.3;
    points.push({ x, y });
  }
  const d = buildPath(points);
  const len = totalLength(points);
  const drawProgress = interpolate(frame, [0, 60], [0, 1], { extrapolateRight: 'clamp' });
  const offset = len * (1 - drawProgress);

  return (
    <svg width={CHART_WIDTH} height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={len}
        strokeDashoffset={offset}
        opacity={0.5}
      />
    </svg>
  );
};

// ---------------------------------------------------------------------------
// Main Layout
// ---------------------------------------------------------------------------
export const LayoutLineChart: React.FC<{ data: DynamicSceneItem; color: string }> = ({
  data,
  color,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const chartData: ChartDataPoint[] = (data as any).chartData ?? [];
  const hasData = chartData.length > 0;

  // Header spring
  const headerProgress = spring({ frame: frame - 5, fps, config: tokens.animation.spring.stiff });
  const headerY = interpolate(headerProgress, [0, 1], [60, 0]);
  const headerFloat = Math.sin(frame * 0.04) * 6;

  // Chart enter spring (slightly delayed)
  const chartEnter = spring({ frame: frame - 15, fps, config: tokens.animation.spring.smooth });

  // ---------- compute point positions ----------
  const { points, maxVal, minVal } = useMemo(() => {
    if (!hasData) return { points: [] as { x: number; y: number }[], maxVal: 1, minVal: 0 };
    const vals = chartData.map((d) => d.value);
    const mx = Math.max(...vals);
    const mn = Math.min(...vals, 0);
    const range = mx - mn || 1;
    const pts = chartData.map((d, i) => ({
      x: CHART_PADDING.left + (chartData.length === 1 ? INNER_W / 2 : (i / (chartData.length - 1)) * INNER_W),
      y: CHART_PADDING.top + INNER_H - ((d.value - mn) / range) * INNER_H,
    }));
    return { points: pts, maxVal: mx, minVal: mn };
  }, [chartData, hasData]);

  // ---------- draw animation ----------
  const pathLen = hasData ? totalLength(points) : 0;
  const drawDuration = Math.max(40, (data.seqDuration || 300) * 0.4);
  const drawProgress = interpolate(frame, [20, 20 + drawDuration], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const dashOffset = pathLen * (1 - drawProgress);

  // cumulative distances for dot pop-in timing
  const cumDists = useMemo(() => (hasData ? cumulativeDistances(points) : []), [points, hasData]);

  // grid lines (5 horizontal)
  const gridLines = useMemo(() => {
    const lines: { y: number; label: string }[] = [];
    const range = maxVal - minVal || 1;
    for (let i = 0; i <= 4; i++) {
      const val = minVal + (range * i) / 4;
      const y = CHART_PADDING.top + INNER_H - (i / 4) * INNER_H;
      lines.push({ y, label: Number.isInteger(val) ? String(val) : val.toFixed(1) });
    }
    return lines;
  }, [maxVal, minVal]);

  // area fill
  const areaPath = hasData ? buildAreaPath(points, CHART_PADDING.top + INNER_H) : '';
  const areaOpacity = interpolate(drawProgress, [0.3, 1], [0, 0.25], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const gradientId = `lineGrad-${data.id ?? 0}`;

  return (
    <SafeArea>
      <ProgressBar duration={data.seqDuration || 300} color={color} />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          gap: '28px',
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
              📈 {data.tag || 'BIỂU ĐỒ'}
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

        {/* ---------- Chart ---------- */}
        <div
          style={{
            opacity: chartEnter,
            transform: `translateY(${interpolate(chartEnter, [0, 1], [40, 0])}px)`,
            backgroundColor: 'rgba(15,23,42,0.85)',
            borderRadius: '24px',
            padding: '32px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            borderTop: `6px solid ${color}`,
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {!hasData ? (
            <PlaceholderWave color={color} />
          ) : (
            <svg
              width={CHART_WIDTH}
              height={CHART_HEIGHT}
              viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
              style={{ overflow: 'visible' }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.5} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              {gridLines.map((gl, i) => (
                <g key={i}>
                  <line
                    x1={CHART_PADDING.left}
                    y1={gl.y}
                    x2={CHART_PADDING.left + INNER_W}
                    y2={gl.y}
                    stroke="rgba(148,163,184,0.15)"
                    strokeWidth={1}
                    strokeDasharray="6 4"
                  />
                  <text
                    x={CHART_PADDING.left - 12}
                    y={gl.y + 5}
                    textAnchor="end"
                    fill={tokens.colors.text.muted}
                    fontSize={18}
                    fontFamily={tokens.typography.fontFamily.sans}
                  >
                    {gl.label}
                  </text>
                </g>
              ))}

              {/* Area fill */}
              <path d={areaPath} fill={`url(#${gradientId})`} opacity={areaOpacity} />

              {/* Line */}
              <path
                d={buildPath(points)}
                fill="none"
                stroke={color}
                strokeWidth={4}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={pathLen}
                strokeDashoffset={dashOffset}
                style={{ filter: `drop-shadow(0 0 8px ${color})` }}
              />

              {/* Data points + labels */}
              {points.map((pt, i) => {
                // The dot should pop in when the line reaches it
                const fraction = pathLen > 0 ? cumDists[i] / pathLen : 0;
                const dotDelay = 20 + drawDuration * fraction;
                const dotScale = spring({
                  frame: frame - dotDelay,
                  fps,
                  config: { damping: 10, stiffness: 180, mass: 0.6 },
                });
                const pointColor = chartData[i].color || color;

                return (
                  <g key={i}>
                    {/* Glow */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={12 * dotScale}
                      fill={pointColor}
                      opacity={0.25 * dotScale}
                    />
                    {/* Dot */}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={7 * dotScale}
                      fill={pointColor}
                      stroke="#0F172A"
                      strokeWidth={3}
                    />
                    {/* Label */}
                    <text
                      x={pt.x}
                      y={CHART_PADDING.top + INNER_H + 40}
                      textAnchor="middle"
                      fill={tokens.colors.text.muted}
                      fontSize={20}
                      fontFamily={tokens.typography.fontFamily.sans}
                      fontWeight={600}
                      opacity={dotScale}
                    >
                      {chartData[i].label}
                    </text>
                    {/* Value above dot */}
                    <text
                      x={pt.x}
                      y={pt.y - 18}
                      textAnchor="middle"
                      fill={tokens.colors.text.headline}
                      fontSize={20}
                      fontFamily={tokens.typography.fontFamily.sans}
                      fontWeight={800}
                      opacity={dotScale}
                    >
                      {chartData[i].value}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </div>

        {/* ---------- Key takeaway (first) ---------- */}
        {data.keyTakeaways && data.keyTakeaways.length > 0 && (
          <div
            style={{
              opacity: chartEnter,
              transform: `translateY(${interpolate(chartEnter, [0, 1], [30, 0])}px)`,
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
