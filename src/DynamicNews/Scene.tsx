import React from 'react';
import { spring, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { DynamicSceneItem } from './types';

// Hỗ trợ hiệu ứng thở mượt mà (Breathing/Floating)
const useAliveMotion = (offset = 0, speed = 20, intensity = 6) => {
  const frame = useCurrentFrame();
  return Math.sin((frame + offset) / speed) * intensity;
};

// ============================================
// TEMPLATE A: CARDS LIST (Danh sách Luận điểm)
// ============================================
const LayoutList: React.FC<{ data: DynamicSceneItem; color: string; takeawayStarts: number[] }> = ({ data, color, takeawayStarts }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Cinematic slow zoom
  const slowZoom = interpolate(frame, [0, data.seqDuration || 300], [1, 1.05], { extrapolateRight: 'clamp' });
  const floatCard = useAliveMotion(0, 30, 8);

  const titleProgress = spring({ frame: frame - 10, fps, config: { damping: 14, stiffness: 100 } });
  const titleY = interpolate(titleProgress, [0, 1], [60, 0]);
  const titleOpacity = interpolate(titleProgress, [0, 1], [0, 1]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 60px', color: 'white', transform: `scale(${slowZoom})` }}>
      <div style={{ transform: `translateY(${titleY + useAliveMotion(10, 25, 5)}px)`, opacity: titleOpacity, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', marginBottom: '50px' }}>
        <div style={{ backgroundColor: color, color: '#000', fontWeight: '900', fontSize: '28px', padding: '12px 32px', borderRadius: '9999px', textTransform: 'uppercase', boxShadow: `0 0 30px ${color}88` }}>
          <span style={{ marginRight: '10px' }}>🔴</span> {data.tag}
        </div>
        <div style={{ fontSize: '50px', fontWeight: '900', color: '#fff', textAlign: 'center', backgroundColor: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(20px)', padding: '28px 40px', borderRadius: '32px', border: `1px solid rgba(255,255,255,0.15)`, borderBottom: `6px solid ${color}`, boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
          {data.headline}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', width: '100%', transform: `translateY(${floatCard}px)` }}>
        {(data.keyTakeaways || []).map((takeaway, idx) => {
          const progress = spring({ frame: frame - takeawayStarts[idx], fps, config: { damping: 12, stiffness: 120 } });
          const cardY = interpolate(progress, [0, 1], [50, 0]);
          const cardOpacity = interpolate(progress, [0, 1], [0, 1]);
          const cardFloat = useAliveMotion(idx * 20, 20, 4);

          return (
            <div key={idx} style={{ transform: `translateY(${cardY + cardFloat}px)`, opacity: cardOpacity, display: 'flex', alignItems: 'center', gap: '28px', backgroundColor: 'rgba(30, 41, 59, 0.7)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.05)', borderLeft: `8px solid ${color}`, padding: '32px 36px', borderRadius: '0 28px 28px 0', boxShadow: '0 15px 30px rgba(0,0,0,0.4)' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: `${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color, fontSize: '24px', fontWeight: 'bold' }}>{idx + 1}</div>
              <div style={{ fontSize: '32px', color: '#f8fafc', lineHeight: '1.5', fontWeight: '600' }}>{takeaway}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ============================================
// TEMPLATE B: BIG STATISTIC (Chỉ số khổng lồ)
// ============================================
const LayoutStat: React.FC<{ data: DynamicSceneItem; color: string; takeawayStarts: number[] }> = ({ data, color, takeawayStarts }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slowZoom = interpolate(frame, [0, data.seqDuration || 300], [1, 1.08], { extrapolateRight: 'clamp' });
  const floatStat = useAliveMotion(0, 25, 15);

  const titleProgress = spring({ frame: frame - 10, fps, config: { damping: 14, stiffness: 100 } });
  const statProgress = spring({ frame: frame - (takeawayStarts[0] || 40), fps, config: { damping: 10, stiffness: 90 } });
  const labelProgress = spring({ frame: frame - (takeawayStarts[1] || 80), fps, config: { damping: 12, stiffness: 120 } });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 60px', color: 'white', transform: `scale(${slowZoom})` }}>
      <div style={{ transform: `translateY(${interpolate(titleProgress, [0, 1], [50, 0])}px)`, opacity: titleProgress, marginBottom: '70px', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', backgroundColor: 'rgba(255,255,255,0.1)', padding: '10px 24px', borderRadius: '99px', color: color, fontWeight: '900', fontSize: '28px', textTransform: 'uppercase', letterSpacing: '3px', marginBottom: '24px', border: `1px solid ${color}44` }}>
          ✨ {data.tag}
        </div>
        <div style={{ fontSize: '50px', fontWeight: '800', lineHeight: 1.4, textShadow: '0 4px 20px rgba(0,0,0,0.8)' }}>{data.headline}</div>
      </div>

      <div style={{ transform: `scale(${statProgress}) translateY(${floatStat}px)`, width: '100%', display: 'flex', justifyContent: 'center', marginBottom: '50px' }}>
        <div style={{
          fontSize: '180px', fontWeight: '900', color: '#fff',
          textShadow: `0 0 80px ${color}, 0 20px 40px rgba(0,0,0,0.5)`,
          fontFamily: 'Space Grotesk, sans-serif',
          background: `linear-gradient(180deg, #ffffff 0%, ${color} 100%)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1
        }}>
          {data.statNumber || "100%"}
        </div>
      </div>

      <div style={{ transform: `translateY(${interpolate(labelProgress, [0, 1], [40, 0])}px)`, opacity: labelProgress, backgroundColor: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(20px)', padding: '28px 48px', borderRadius: '30px', borderTop: `4px solid ${color}`, boxShadow: `0 20px 50px rgba(0,0,0,0.6)`, fontSize: '38px', fontWeight: '700', textAlign: 'center' }}>
        {data.statLabel || data.keyTakeaways?.[0] || "Số liệu đáng chú ý"}
      </div>
    </div>
  );
};

// ============================================
// TEMPLATE C: QUOTE FOCUS (Trích dẫn)
// ============================================
const LayoutQuote: React.FC<{ data: DynamicSceneItem; color: string; takeawayStarts: number[] }> = ({ data, color, takeawayStarts }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const slowZoom = interpolate(frame, [0, data.seqDuration || 300], [1, 1.05], { extrapolateRight: 'clamp' });

  const badgeProgress = spring({ frame: frame - 10, fps, config: { damping: 14, stiffness: 100 } });
  const quoteProgress = spring({ frame: frame - (takeawayStarts[0] || 50), fps, config: { damping: 12, stiffness: 100 } });

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 60px', color: 'white', transform: `scale(${slowZoom})` }}>
      <div style={{ transform: `translateY(${interpolate(badgeProgress, [0, 1], [40, 0])}px)`, opacity: badgeProgress, backgroundColor: color, color: '#000', padding: '14px 32px', borderRadius: '20px', fontSize: '28px', fontWeight: '900', marginBottom: '50px', textTransform: 'uppercase', boxShadow: `0 15px 30px ${color}66` }}>
        💬 {data.tag}
      </div>

      <div style={{ transform: `translateY(${interpolate(quoteProgress, [0, 1], [60, 0]) + useAliveMotion(0, 25, 10)}px)`, opacity: quoteProgress, position: 'relative', backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(24px)', padding: '70px 50px', borderRadius: '40px', border: `1px solid rgba(255,255,255,0.1)`, borderLeft: `10px solid ${color}`, boxShadow: `0 40px 80px rgba(0,0,0,0.7)` }}>
        <div style={{ position: 'absolute', top: '-50px', left: '40px', fontSize: '140px', color: color, fontFamily: 'Georgia, serif', lineHeight: 1, textShadow: `0 10px 30px ${color}88` }}>“</div>
        <div style={{ fontSize: '46px', fontWeight: '700', lineHeight: 1.5, color: '#f8fafc', fontStyle: 'italic', marginBottom: '40px', zIndex: 2, position: 'relative' }}>
          {data.quoteText || data.keyTakeaways?.[0]}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ width: '80px', height: '6px', backgroundColor: color, borderRadius: '3px', boxShadow: `0 0 15px ${color}` }}></div>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '1px' }}>
            {data.quoteAuthor || data.headline}
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// TÍCH HỢP AUDIO VISUALIZER (THANH SÓNG ÂM MÔ PHỎNG)
// ============================================
const AudioVisualizer: React.FC<{ color: string }> = ({ color }) => {
  const frame = useCurrentFrame();
  const bars = 10;

  return (
    <div style={{ position: 'absolute', bottom: '60px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '10px', alignItems: 'flex-end', height: '60px', opacity: 0.8 }}>
      {[...Array(bars)].map((_, i) => {
        // Mô phỏng sóng âm nhảy múa dựa trên frame và index
        const heightBase = 15;
        const jump = Math.sin((frame * 0.4) + i) * Math.cos((frame * 0.2) - i) * 35;
        const barHeight = Math.max(10, heightBase + Math.abs(jump));

        return (
          <div key={i} style={{
            width: '12px',
            height: `${barHeight}px`,
            backgroundColor: color,
            borderRadius: '6px',
            boxShadow: `0 0 15px ${color}`,
            transition: 'height 0.1s ease'
          }} />
        );
      })}
    </div>
  );
};

// ============================================
// MAIN SCENE ROUTER
// ============================================
export const DynamicScene: React.FC<{ data: DynamicSceneItem }> = ({ data }) => {
  const color = data.color || '#38bdf8';
  const takeawayStarts = data.takeawayStarts || [60, 120, 180, 240, 300];

  let LayoutComponent = LayoutList;
  if (data.layoutType === 'stat') LayoutComponent = LayoutStat;
  if (data.layoutType === 'quote') LayoutComponent = LayoutQuote;

  return (
    <div style={{ flex: 1, position: 'relative', display: 'flex', width: '100%', height: '100%' }}>
      <LayoutComponent data={data} color={color} takeawayStarts={takeawayStarts} />

      {/* Visualizer nhấp nháy tạo cảm giác AI đang nói thực sự */}
      <AudioVisualizer color={color} />
    </div>
  );
};
