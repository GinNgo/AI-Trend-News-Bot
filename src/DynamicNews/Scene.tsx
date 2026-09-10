import React from 'react';
import { spring, useCurrentFrame, useVideoConfig, interpolate, Img, staticFile } from 'remotion';
import { DynamicSceneItem } from './types';
import { tokens } from '../design/tokens';
import { SafeArea } from '../design/components/SafeArea';
import { ScrimOverlay } from '../design/components/ScrimOverlay';

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

// Sóng âm thanh Audio Visualizer sinh động mô phỏng giọng đọc
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

// Thanh tiến trình chạy mượt mà ở đầu khung hình
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

// ============================================
// TEMPLATE: INTRO (Mở đầu cuốn hút)
// ============================================
const LayoutIntro: React.FC<{ data: DynamicSceneItem; color: string }> = ({ data, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({ frame: frame - 5, fps, config: tokens.animation.spring.stiff });
  const titleY = interpolate(titleProgress, [0, 1], [80, 0]);
  const floatY = Math.sin(frame * 0.04) * 8; // Chuyển động nổi hữu cơ

  return (
    <SafeArea>
      <ProgressBar duration={data.seqDuration || 300} color={color} />
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', gap: '40px' }}>
        <div
          style={{
            alignSelf: 'flex-start',
            transform: `translateY(${titleY + floatY}px)`,
            opacity: titleProgress,
            backgroundColor: color,
            color: '#000',
            fontWeight: 900,
            fontSize: tokens.typography.size.caption,
            padding: '16px 40px',
            borderRadius: '16px',
            textTransform: 'uppercase',
            boxShadow: `0 20px 40px ${color}66`,
          }}
        >
          {data.tag &&
          (data.tag.toUpperCase().includes('NÓNG') ||
            data.tag.toUpperCase().includes('HOT') ||
            data.tag.toUpperCase().includes('ĐIỀU TRA'))
            ? '🔥 TIN NÓNG'
            : '📊 CẬP NHẬT'}
        </div>
        <div
          style={{
            transform: `translateY(${titleY + floatY * 0.8}px)`,
            opacity: titleProgress,
            fontSize: '80px',
            fontWeight: 900,
            color: tokens.colors.text.headline,
            lineHeight: tokens.typography.lineHeight.tight,
            textShadow: '0 10px 40px rgba(0,0,0,0.5)',
          }}
        >
          <HighlightText text={data.headline} color={color} />
        </div>
        <AudioVisualizer color={color} />

        {data.keyTakeaways && data.keyTakeaways.length > 0 && (
          <div
            style={{
              transform: `translateY(${titleY + floatY * 0.5}px)`,
              opacity: titleProgress,
              fontSize: tokens.typography.size.body,
              color: tokens.colors.text.body,
              lineHeight: tokens.typography.lineHeight.normal,
              backgroundColor: 'rgba(15,23,42,0.85)',
              padding: '32px',
              borderRadius: '24px',
              borderLeft: `8px solid ${color}`,
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
            }}
          >
            <HighlightText text={data.keyTakeaways[0]} color={color} />
          </div>
        )}
      </div>
    </SafeArea>
  );
};

// ============================================
// TEMPLATE A: CARDS LIST (Danh sách Luận điểm nảy động)
// ============================================
const LayoutList: React.FC<{ data: DynamicSceneItem; color: string; takeawayStarts: number[] }> = ({
  data,
  color,
  takeawayStarts,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({ frame: frame - 5, fps, config: tokens.animation.spring.stiff });
  const titleY = interpolate(titleProgress, [0, 1], [60, 0]);
  const headerFloat = Math.sin(frame * 0.04) * 6;

  return (
    <SafeArea>
      <ProgressBar duration={data.seqDuration || 300} color={color} />
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '40px', paddingTop: '40px' }}>
        <div
          style={{
            transform: `translateY(${titleY + headerFloat}px)`,
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
                color: color,
                fontWeight: 800,
                fontSize: '28px',
                padding: '12px 32px',
                borderRadius: '99px',
                textTransform: 'uppercase',
                border: `1px solid ${color}44`,
              }}
            >
              🎯 {data.tag || 'TIN TỨC'}
            </div>
            <AudioVisualizer color={color} />
          </div>
          <div
            style={{
              fontSize: '70px',
              fontWeight: 900,
              color: tokens.colors.text.headline,
              lineHeight: tokens.typography.lineHeight.tight,
              textShadow: '0 10px 20px rgba(0,0,0,0.5)',
            }}
          >
            <HighlightText text={data.headline} color={color} />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
          {(data.keyTakeaways || []).map((takeaway, idx) => {
            // Hiệu ứng nảy lò xo (Bouncy spring) và trượt lên từng thẻ
            const startTime = takeawayStarts[idx] !== undefined ? takeawayStarts[idx] : 30 + idx * 45;
            const progress = spring({ frame: frame - startTime, fps, config: { damping: 12, stiffness: 90 } });
            const cardY = interpolate(progress, [0, 1], [80, 0]);
            const cardScale = interpolate(progress, [0, 1], [0.85, 1]);
            const cardOpacity = interpolate(progress, [0, 1], [0, 1]);
            const float = Math.sin(frame * 0.05 + idx) * 5;

            return (
              <div
                key={idx}
                style={{
                  opacity: cardOpacity,
                  transform: `translateY(${cardY + float}px) scale(${cardScale})`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '24px',
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  padding: '28px 32px',
                  borderRadius: '24px',
                  borderLeft: `6px solid ${color}`,
                  boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                }}
              >
                <div
                  style={{
                    minWidth: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: `${color}22`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: color,
                    fontSize: '24px',
                    fontWeight: 900,
                  }}
                >
                  {idx + 1}
                </div>
                <div style={{ fontSize: '40px', color: tokens.colors.text.body, lineHeight: 1.4, fontWeight: 600 }}>
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
// TEMPLATE B: BIG STATISTIC (Chỉ số khổng lồ nhấp nháy sống động)
// ============================================
const LayoutStat: React.FC<{ data: DynamicSceneItem; color: string }> = ({ data, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const statProgress = spring({ frame: frame - 10, fps, config: tokens.animation.spring.stiff });
  const statText = data.statNumber || 'HOT';
  const statFontSize = statText.length > 10 ? '90px' : statText.length > 6 ? '120px' : '160px';
  const statPulse = 1 + Math.sin(frame * 0.08) * 0.04; // Nhịp đập liên tục không đứng yên

  return (
    <SafeArea>
      <ProgressBar duration={data.seqDuration || 300} color={color} />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          gap: '40px',
          height: '100%',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '300px',
            height: '300px',
            backgroundColor: color,
            filter: 'blur(150px)',
            opacity: 0.35 + Math.sin(frame * 0.05) * 0.15,
            zIndex: -1,
          }}
        />

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            opacity: statProgress,
            transform: `translateY(${interpolate(statProgress, [0, 1], [40, 0])}px)`,
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(0,0,0,0.6)',
              padding: '12px 32px',
              borderRadius: '99px',
              color: color,
              fontWeight: 900,
              fontSize: '28px',
              textTransform: 'uppercase',
              letterSpacing: '2px',
              border: `2px solid ${color}66`,
            }}
          >
            ✨ {data.tag || 'CHỈ SỐ'}
          </div>
          <div
            style={{
              fontSize: '64px',
              fontWeight: 900,
              color: tokens.colors.text.headline,
              textAlign: 'center',
              lineHeight: 1.2,
            }}
          >
            <HighlightText text={data.headline} color={color} />
          </div>
        </div>

        <div
          style={{
            transform: `scale(${statProgress * statPulse})`,
            fontSize: statFontSize,
            fontWeight: 900,
            color: '#fff',
            textShadow: `0 0 40px ${color}, 0 20px 40px rgba(0,0,0,0.5)`,
            lineHeight: 1,
            textAlign: 'center',
            margin: '20px 0',
          }}
        >
          {statText}
        </div>
        <AudioVisualizer color={color} />

        <div
          style={{
            opacity: statProgress,
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
          <HighlightText text={data.statLabel || data.keyTakeaways?.[0] || ''} color={color} />
        </div>
      </div>
    </SafeArea>
  );
};

// ============================================
// TEMPLATE D: IMAGE EVIDENCE (Hình ảnh phóng to trượt điện ảnh + Cyber Fallback)
// ============================================
const LayoutImage: React.FC<{ data: DynamicSceneItem; color: string }> = ({ data, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const imagePan = interpolate(frame, [0, data.seqDuration || 300], [1, 1.15], { extrapolateRight: 'clamp' });
  const opacity = spring({ frame: frame - 5, fps, config: tokens.animation.spring.smooth });
  const contentY = interpolate(opacity, [0, 1], [60, 0]);
  const scanLineY = (frame * 6) % 1920;

  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
      {data.imageFile ? (
        <Img
          src={staticFile(data.imageFile)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${imagePan})` }}
        />
      ) : (
        <div style={{ width: '100%', height: '100%', backgroundColor: '#020617', position: 'relative', overflow: 'hidden' }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `linear-gradient(${color}33 2px, transparent 2px), linear-gradient(90deg, ${color}33 2px, transparent 2px)`,
              backgroundSize: '60px 60px',
              transform: `scale(${imagePan})`,
              opacity: 0.5,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: scanLineY,
              height: '4px',
              backgroundColor: color,
              boxShadow: `0 0 40px 10px ${color}`,
              zIndex: 1,
            }}
          />
        </div>
      )}
      <ScrimOverlay />

      <SafeArea>
        <ProgressBar duration={data.seqDuration || 300} color={color} />
        <div
          style={{
            opacity,
            transform: `translateY(${contentY}px)`,
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            zIndex: 2,
            justifyContent: 'flex-end',
            height: '100%',
            paddingBottom: '28%',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div
              style={{
                backgroundColor: color,
                color: '#fff',
                padding: '12px 32px',
                borderRadius: '12px',
                fontSize: '28px',
                fontWeight: 900,
                textTransform: 'uppercase',
                boxShadow: `0 10px 30px ${color}88`,
              }}
            >
              📸 {data.tag || 'BẰNG CHỨNG'}
            </div>
            <AudioVisualizer color={color} />
          </div>

          <div
            style={{
              fontSize: '70px',
              fontWeight: 900,
              lineHeight: 1.1,
              color: '#fff',
              textShadow: '0 10px 30px rgba(0,0,0,0.9)',
            }}
          >
            <HighlightText text={data.headline} color={color} />
          </div>

          {data.keyTakeaways && data.keyTakeaways.length > 0 && (
            <div
              style={{
                fontSize: '40px',
                color: '#f1f5f9',
                lineHeight: 1.4,
                backgroundColor: 'rgba(15,23,42,0.9)',
                padding: '32px',
                borderRadius: '24px',
                borderLeft: `8px solid ${color}`,
                boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
              }}
            >
              <HighlightText text={data.keyTakeaways[0]} color={color} />
            </div>
          )}
        </div>
      </SafeArea>
    </div>
  );
};

// ============================================
// TEMPLATE C: QUOTE FOCUS (Trích dẫn phong cách phóng sự)
// ============================================
const LayoutQuote: React.FC<{ data: DynamicSceneItem; color: string }> = ({ data, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({ frame: frame - 10, fps, config: tokens.animation.spring.stiff });
  const contentY = interpolate(titleProgress, [0, 1], [60, 0]);
  const float = Math.sin(frame * 0.03) * 8;

  return (
    <SafeArea>
      <ProgressBar duration={data.seqDuration || 300} color={color} />
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', gap: '40px' }}>
        <div
          style={{
            opacity: titleProgress,
            transform: `translateY(${contentY + float}px)`,
            alignSelf: 'center',
            backgroundColor: 'rgba(255,255,255,0.1)',
            padding: '12px 32px',
            borderRadius: '99px',
            color: color,
            fontWeight: 900,
            fontSize: '28px',
            textTransform: 'uppercase',
            border: `2px solid ${color}66`,
          }}
        >
          💬 {data.tag || 'PHÁT BIỂU'}
        </div>

        <div
          style={{
            opacity: titleProgress,
            transform: `translateY(${contentY + float * 1.5}px)`,
            position: 'relative',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            padding: '60px 50px',
            borderRadius: '40px',
            borderLeft: `12px solid ${color}`,
            boxShadow: `0 40px 80px rgba(0,0,0,0.6)`,
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-40px',
              left: '40px',
              fontSize: '140px',
              color: color,
              fontFamily: 'Georgia, serif',
              lineHeight: 1,
            }}
          >
            “
          </div>
          <div
            style={{
              fontSize: '60px',
              fontWeight: 700,
              lineHeight: 1.5,
              color: '#fff',
              fontStyle: 'italic',
              marginBottom: '40px',
              zIndex: 2,
              position: 'relative',
            }}
          >
            <HighlightText text={data.quoteText || data.headline} color={color} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ width: '60px', height: '6px', backgroundColor: color, borderRadius: '3px' }}></div>
              <div style={{ fontSize: '32px', fontWeight: 900, color: tokens.colors.text.muted, textTransform: 'uppercase' }}>
                <HighlightText text={data.quoteAuthor || data.keyTakeaways?.[0] || ''} color={color} />
              </div>
            </div>
            <AudioVisualizer color={color} />
          </div>
        </div>
      </div>
    </SafeArea>
  );
};

export const DynamicScene: React.FC<{ data: DynamicSceneItem }> = ({ data }) => {
  const color = data.color || tokens.colors.accent;
  // Khởi động các bullet points dồn dập hơn để màn hình luôn có chuyển động mới
  const takeawayStarts =
    data.takeawayStarts && data.takeawayStarts.length > 0
      ? data.takeawayStarts
      : [30, 75, 120, 165, 210];

  let LayoutComponent = LayoutList as React.ElementType;
  if (
    data.tag &&
    (data.tag.toUpperCase().includes('TIN NÓNG') ||
      data.tag.toUpperCase().includes('TỔNG HỢP') ||
      data.tag.toUpperCase().includes('ĐIỀU TRA'))
  ) {
    LayoutComponent = LayoutIntro;
  }

  // Explicit layout types override the default/tag-based layout
  if (data.layoutType === 'stat') LayoutComponent = LayoutStat;
  if (data.layoutType === 'quote') LayoutComponent = LayoutQuote;
  if (data.layoutType === 'image') LayoutComponent = LayoutImage;


  // Handle Background Image inside the Scene to prevent bleeding and show scraped images
  const frame = useCurrentFrame();
  const imagePan = interpolate(frame, [0, data.seqDuration || 300], [1, 1.15], { extrapolateRight: 'clamp' });
  const hasImage = data.imageFile && data.imageFile.trim() !== '';

  return (
    <div
      style={{
        flex: 1,
        position: 'absolute',
        width: '100%',
        height: '100%',
        backgroundColor: tokens.colors.background, // Opaque base to prevent transition bleed
        fontFamily: tokens.typography.fontFamily.sans,
        overflow: 'hidden',
      }}
    >
      {/* Background Layer per Scene */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        {hasImage ? (
          <>
            <Img
              src={staticFile(data.imageFile!)}
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${imagePan})`, opacity: 0.4 }}
            />
            {/* Dark gradient to ensure text readability */}
            <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(to right, rgba(15,23,42,0.9) 0%, rgba(15,23,42,0.7) 50%, rgba(15,23,42,0.9) 100%)' }} />
          </>
        ) : (
          <div style={{ width: '100%', height: '100%', backgroundColor: '#020617', position: 'relative', overflow: 'hidden' }}>
            <div
              style={{
                position: 'absolute',
                inset: 0,
                backgroundImage: `linear-gradient(${color}22 2px, transparent 2px), linear-gradient(90deg, ${color}22 2px, transparent 2px)`,
                backgroundSize: '80px 80px',
                transform: `scale(${imagePan})`,
                opacity: 0.3,
              }}
            />
          </div>
        )}
      </div>

      <ScrimOverlay />

      <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
        <LayoutComponent data={data} color={color} takeawayStarts={takeawayStarts} />
      </div>

      {/* Subtitle / Voiceover Caption Box */}
      {data.voiceover && (
        <div
          style={{
            position: 'absolute',
            bottom: '10%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '90%',
            zIndex: 100,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.92)',
              backdropFilter: 'blur(12px)',
              padding: '18px 32px',
              borderRadius: '20px',
              border: `1.5px solid ${color}88`,
              boxShadow: `0 15px 35px rgba(0,0,0,0.7), 0 0 25px ${color}22`,
              color: '#ffffff',
              fontSize: '34px',
              fontWeight: 700,
              textAlign: 'center',
              lineHeight: 1.35,
              textShadow: '0 2px 8px rgba(0,0,0,0.8)',
            }}
          >
            <HighlightText text={data.voiceover} color={color} />
          </div>
        </div>
      )}
    </div>
  );
};
