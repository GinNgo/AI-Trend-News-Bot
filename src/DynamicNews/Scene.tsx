import React from 'react';
import { spring, useCurrentFrame, useVideoConfig, interpolate, Img, staticFile } from 'remotion';
import { DynamicSceneItem } from './types';
import { tokens } from '../design/tokens';
import { SafeArea } from '../design/components/SafeArea';
import { ScrimOverlay } from '../design/components/ScrimOverlay';

// Component làm nổi bật text (bôi đậm, đổi màu) nếu có dấu **text**
const HighlightText: React.FC<{ text: string, color: string }> = ({ text, color }) => {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <span key={i} style={{ color, fontWeight: 900 }}>{part.slice(2, -2)}</span>;
        }
        return part;
      })}
    </>
  );
};

// Component thanh thời gian chạy dọc
const ProgressBar: React.FC<{ duration: number, color: string }> = ({ duration, color }) => {
  const frame = useCurrentFrame();
  const width = interpolate(frame, [0, duration], [0, 100], { extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, height: '8px', width: `${width}%`, backgroundColor: color, boxShadow: `0 0 10px ${color}`, zIndex: 10 }} />
  );
};

// ============================================
// TEMPLATE: INTRO (Mở đầu cuốn hút)
// ============================================
const LayoutIntro: React.FC<{ data: DynamicSceneItem; color: string }> = ({ data, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({ frame: frame - 15, fps, config: tokens.animation.spring.stiff });
  const titleY = interpolate(titleProgress, [0, 1], [60, 0]);

  return (
    <SafeArea>
      <ProgressBar duration={data.seqDuration || 300} color={color} />
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', gap: '40px' }}>
        <div style={{ alignSelf: 'flex-start', transform: `translateY(${titleY}px)`, opacity: titleProgress, backgroundColor: color, color: '#000', fontWeight: tokens.typography.weight.bold, fontSize: tokens.typography.size.caption, padding: '16px 40px', borderRadius: '16px', textTransform: 'uppercase', boxShadow: `0 20px 40px ${color}66` }}>
          {data.tag && (data.tag.toUpperCase().includes('NÓNG') || data.tag.toUpperCase().includes('HOT') || data.tag.toUpperCase().includes('ĐIỀU TRA')) ? '🔥 TIN NÓNG' : '📊 CẬP NHẬT MỚI'}
        </div>
        <div style={{ transform: `translateY(${titleY}px)`, opacity: titleProgress, fontSize: '80px', fontWeight: tokens.typography.weight.bold, color: tokens.colors.text.headline, lineHeight: tokens.typography.lineHeight.tight, textShadow: '0 10px 40px rgba(0,0,0,0.5)' }}>
          <HighlightText text={data.headline} color={color} />
        </div>

        {data.keyTakeaways && data.keyTakeaways.length > 0 && (
          <div style={{ transform: `translateY(${titleY}px)`, opacity: titleProgress, fontSize: tokens.typography.size.body, color: tokens.colors.text.body, lineHeight: tokens.typography.lineHeight.normal, backgroundColor: 'rgba(15,23,42,0.8)', padding: '32px', borderRadius: '24px', borderLeft: `8px solid ${color}`, background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1)' }}>
            <HighlightText text={data.keyTakeaways[0]} color={color} />
          </div>
        )}
      </div>
    </SafeArea>
  );
};

// ============================================
// TEMPLATE A: CARDS LIST (Danh sách Luận điểm)
// ============================================
const LayoutList: React.FC<{ data: DynamicSceneItem; color: string; takeawayStarts: number[] }> = ({ data, color, takeawayStarts }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({ frame: frame - 10, fps, config: tokens.animation.spring.stiff });
  const titleY = interpolate(titleProgress, [0, 1], [40, 0]);

  return (
    <SafeArea>
      <ProgressBar duration={data.seqDuration || 300} color={color} />
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '40px' }}>
        <div style={{ transform: `translateY(${titleY}px)`, opacity: titleProgress, display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
          <div style={{ display: 'inline-block', backgroundColor: 'rgba(255,255,255,0.1)', color: color, fontWeight: tokens.typography.weight.bold, fontSize: tokens.typography.size.caption, padding: '12px 32px', borderRadius: '99px', textTransform: 'uppercase', alignSelf: 'flex-start', border: `1px solid ${color}44` }}>
            <span style={{ marginRight: '8px' }}>🎯</span> {data.tag}
          </div>
          <div style={{ fontSize: tokens.typography.size.headline, fontWeight: tokens.typography.weight.bold, color: tokens.colors.text.headline, lineHeight: tokens.typography.lineHeight.tight }}>
            <HighlightText text={data.headline} color={color} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
          {(data.keyTakeaways || []).map((takeaway, idx) => {
            const progress = spring({ frame: frame - takeawayStarts[idx], fps, config: tokens.animation.spring.smooth });
            const cardOpacity = interpolate(progress, [0, 1], [0, 1]);

            return (
              <div key={idx} style={{ opacity: cardOpacity, display: 'flex', alignItems: 'center', gap: '24px', backgroundColor: 'rgba(15, 23, 42, 0.7)', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.05)', borderLeft: `6px solid ${color}`, padding: '28px 32px', borderRadius: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.3)' }}>
                <div style={{ minWidth: '48px', height: '48px', borderRadius: '50%', backgroundColor: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: color, fontSize: '24px', fontWeight: tokens.typography.weight.bold }}>{idx + 1}</div>
                <div style={{ fontSize: tokens.typography.size.body, color: tokens.colors.text.body, lineHeight: tokens.typography.lineHeight.normal, fontWeight: tokens.typography.weight.semibold }}>
                  <HighlightText text={takeaway} color={color} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SafeArea>
  );
};

// ============================================
// TEMPLATE B: BIG STATISTIC (Chỉ số khổng lồ)
// ============================================
const LayoutStat: React.FC<{ data: DynamicSceneItem; color: string; takeawayStarts: number[] }> = ({ data, color, takeawayStarts }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const statProgress = spring({ frame: frame - 20, fps, config: tokens.animation.spring.stiff });
  const statText = data.statNumber || "100%";
  const statFontSize = statText.length > 10 ? '90px' : statText.length > 6 ? '120px' : '160px';

  return (
    <SafeArea>
      <ProgressBar duration={data.seqDuration || 300} color={color} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', gap: '40px', height: '100%', position: 'relative' }}>

        {/* Background glow for stat */}
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '300px', height: '300px', backgroundColor: color, filter: 'blur(150px)', opacity: 0.3, zIndex: -1 }} />

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', opacity: statProgress }}>
           <div style={{ backgroundColor: 'rgba(0,0,0,0.5)', padding: '12px 32px', borderRadius: '99px', color: color, fontWeight: tokens.typography.weight.bold, fontSize: tokens.typography.size.caption, textTransform: 'uppercase', letterSpacing: '2px', border: `1px solid ${color}66` }}>
            ✨ {data.tag}
          </div>
          <div style={{ fontSize: tokens.typography.size.headline, fontWeight: tokens.typography.weight.bold, color: tokens.colors.text.headline, textAlign: 'center', lineHeight: tokens.typography.lineHeight.tight }}>
            <HighlightText text={data.headline} color={color} />
          </div>
        </div>

        <div style={{ transform: `scale(${statProgress})`, fontSize: statFontSize, fontWeight: '900', color: '#fff', textShadow: `0 0 40px ${color}, 0 20px 40px rgba(0,0,0,0.5)`, lineHeight: 1, textAlign: 'center', margin: '20px 0' }}>
          {statText}
        </div>

        <div style={{ opacity: statProgress, backgroundColor: 'rgba(15,23,42,0.9)', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1)', padding: '32px 48px', borderRadius: '32px', borderTop: `6px solid ${color}`, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', fontSize: tokens.typography.size.body, fontWeight: tokens.typography.weight.bold, color: tokens.colors.text.body, textAlign: 'center' }}>
          <HighlightText text={data.statLabel || data.keyTakeaways?.[0] || ""} color={color} />
        </div>
      </div>
    </SafeArea>
  );
};

// ============================================
// TEMPLATE D: IMAGE EVIDENCE (Hình ảnh)
// ============================================
const LayoutImage: React.FC<{ data: DynamicSceneItem; color: string; takeawayStarts: number[] }> = ({ data, color, takeawayStarts }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const imagePan = interpolate(frame, [0, data.seqDuration || 300], [1, 1.1], { extrapolateRight: 'clamp' });
  const opacity = spring({ frame: frame - 10, fps, config: tokens.animation.spring.smooth });

  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
      {data.imageFile ? (
        <Img src={staticFile(data.imageFile)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${imagePan})` }} />
      ) : (
         <div style={{ width: '100%', height: '100%', backgroundColor: tokens.colors.background }} />
      )}
      <ScrimOverlay />

      <SafeArea>
        <ProgressBar duration={data.seqDuration || 300} color={color} />
        <div style={{ opacity, display: 'flex', flexDirection: 'column', gap: '24px', zIndex: 2, justifyContent: 'flex-end', height: '100%', paddingBottom: '40px' }}>
          <div style={{ display: 'inline-block', backgroundColor: '#ef4444', color: '#fff', padding: '12px 32px', borderRadius: '12px', fontSize: '28px', fontWeight: tokens.typography.weight.bold, textTransform: 'uppercase', alignSelf: 'flex-start', boxShadow: '0 10px 30px rgba(239,68,68,0.5)' }}>
            📸 {data.tag || "BẰNG CHỨNG"}
          </div>

          <div style={{ fontSize: '64px', fontWeight: tokens.typography.weight.bold, lineHeight: tokens.typography.lineHeight.tight, color: tokens.colors.text.headline, textShadow: '0 10px 30px rgba(0,0,0,0.8)' }}>
            <HighlightText text={data.headline} color={color} />
          </div>

          {(data.keyTakeaways && data.keyTakeaways.length > 0) && (
            <div style={{ fontSize: tokens.typography.size.body, color: tokens.colors.text.body, lineHeight: tokens.typography.lineHeight.normal, backgroundColor: 'rgba(15,23,42,0.85)', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1)', padding: '32px', borderRadius: '24px', borderLeft: `8px solid ${color}` }}>
              <HighlightText text={data.keyTakeaways[0]} color={color} />
            </div>
          )}
        </div>
      </SafeArea>
    </div>
  );
};

// ============================================
// TEMPLATE C: QUOTE FOCUS (Trích dẫn)
// ============================================
const LayoutQuote: React.FC<{ data: DynamicSceneItem; color: string; takeawayStarts: number[] }> = ({ data, color, takeawayStarts }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({ frame: frame - 10, fps, config: tokens.animation.spring.stiff });

  return (
    <SafeArea>
      <ProgressBar duration={data.seqDuration || 300} color={color} />
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', gap: '40px' }}>
        <div style={{ opacity: titleProgress, alignSelf: 'center', backgroundColor: 'rgba(255,255,255,0.1)', padding: '12px 32px', borderRadius: '99px', color: color, fontWeight: tokens.typography.weight.bold, fontSize: tokens.typography.size.caption, textTransform: 'uppercase', border: `1px solid ${color}66` }}>
          💬 {data.tag || "PHÁT BIỂU"}
        </div>

        <div style={{ opacity: titleProgress, position: 'relative', backgroundColor: 'rgba(15, 23, 42, 0.9)', background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)', boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.1)', padding: '60px 50px', borderRadius: '40px', border: `1px solid rgba(255,255,255,0.1)`, borderLeft: `12px solid ${color}`, boxShadow: `0 40px 80px rgba(0,0,0,0.5)` }}>
          <div style={{ position: 'absolute', top: '-40px', left: '40px', fontSize: '120px', color: color, fontFamily: 'Georgia, serif', lineHeight: 1 }}>“</div>
          <div style={{ fontSize: tokens.typography.size.headline, fontWeight: tokens.typography.weight.semibold, lineHeight: 1.5, color: tokens.colors.text.headline, fontStyle: 'italic', marginBottom: '40px', zIndex: 2, position: 'relative' }}>
            <HighlightText text={data.quoteText || data.headline} color={color} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ width: '60px', height: '4px', backgroundColor: color, borderRadius: '2px' }}></div>
            <div style={{ fontSize: tokens.typography.size.caption, fontWeight: tokens.typography.weight.bold, color: tokens.colors.text.muted, textTransform: 'uppercase' }}>
              <HighlightText text={data.quoteAuthor || data.keyTakeaways?.[0] || ""} color={color} />
            </div>
          </div>
        </div>
      </div>
    </SafeArea>
  );
};

export const DynamicScene: React.FC<{ data: DynamicSceneItem }> = ({ data }) => {
  const color = data.color || tokens.colors.accent;
  const takeawayStarts = data.takeawayStarts || [60, 120, 180, 240, 300];

  let LayoutComponent = LayoutList as React.ElementType;
  if (data.layoutType === 'stat') LayoutComponent = LayoutStat;
  if (data.layoutType === 'quote') LayoutComponent = LayoutQuote;
  if (data.layoutType === 'image') LayoutComponent = LayoutImage;

  if (data.tag && (data.tag.toUpperCase().includes('TIN NÓNG') || data.tag.toUpperCase().includes('TỔNG HỢP') || data.tag.toUpperCase().includes('ĐIỀU TRA'))) {
    LayoutComponent = LayoutIntro;
  }

  return (
    <div style={{ flex: 1, position: 'relative', width: '100%', height: '100%', fontFamily: tokens.typography.fontFamily.sans }}>
      <LayoutComponent data={data} color={color} takeawayStarts={takeawayStarts} />
    </div>
  );
};
