import React from 'react';
import { spring, useCurrentFrame, useVideoConfig, interpolate, Img, staticFile } from 'remotion';
import { DynamicSceneItem, resolveSceneTag } from './types';
import { tokens } from '../design/tokens';
import { SafeArea } from '../design/components/SafeArea';
import { ScrimOverlay } from '../design/components/ScrimOverlay';
import {
  LayoutAnimatedCounter,
  LayoutBarChart,
  LayoutProgressRing,
  LayoutLineChart,
  LayoutComparison,
} from './charts';

const HighlightText: React.FC<{ text: string; color: string }> = ({ text, color }) => {
  if (!text) return null;
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <span
              key={i}
              style={{
                color: '#fff',
                backgroundColor: color,
                padding: '0 12px',
                borderRadius: '8px',
                fontWeight: 900,
                display: 'inline-block',
                margin: '0 8px',
                textTransform: 'uppercase',
                boxShadow: `0 8px 24px ${color}88`,
                transform: 'rotate(-2deg) scale(1.05)',
              }}
            >
              {part.slice(2, -2)}
            </span>
          );
        }
        return part;
      })}
    </>
  );
};

// Sóng âm thanh Audio Visualizer êm dịu, tinh tế (không nhảy chồm chồm)
const AudioVisualizer: React.FC<{ color: string }> = ({ color }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', height: '24px', opacity: 0.8 }}>
      {[0, 1, 2, 3, 4].map((i) => {
        const height = 6 + Math.abs(Math.sin(frame * 0.08 + i * 0.8)) * 12;
        return (
          <div
            key={i}
            style={{
              width: '5px',
              height: `${height}px`,
              backgroundColor: color,
              borderRadius: '3px',
              boxShadow: `0 0 6px ${color}88`,
            }}
          />
        );
      })}
    </div>
  );
};

// Thanh tiến trình chạy mượt mà ở đầu khung hình (không nhấp nháy pulse)
const ProgressBar: React.FC<{ duration: number; color: string }> = ({ duration, color }) => {
  const frame = useCurrentFrame();
  const width = interpolate(frame, [0, duration], [0, 100], { extrapolateRight: 'clamp' });
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        height: '8px',
        width: `${width}%`,
        backgroundColor: color,
        boxShadow: `0 0 12px ${color}`,
        zIndex: 10,
        opacity: 0.9,
      }}
    />
  );
};

// ============================================
// TEMPLATE: INTRO (Mở đầu cuốn hút - Zero-Bumper Hook 0s)
// ============================================
const LayoutIntro: React.FC<{ data: DynamicSceneItem; color: string }> = ({ data, color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // SPEC-07: Hook Anchor 0-1s: Nhẹ nhàng 1.05x -> 1.0x rồi đứng yên hoàn toàn
  const punchProgress = spring({ frame, fps, config: { damping: 18, stiffness: 180, mass: 0.6 } });
  const punchScale = interpolate(punchProgress, [0, 1], [1.05, 1.0]);
  const cardProgress = spring({ frame: Math.max(0, frame - 12), fps, config: tokens.animation.spring.smooth });
  const cardY = interpolate(cardProgress, [0, 1], [20, 0]);

  const currentTag = resolveSceneTag(data.tag, data.language === 'en' ? 'BREAKING' : 'TIN NÓNG', data.language);
  const hasImage = data.imageFile && data.imageFile.trim() !== '';

  return (
    <SafeArea>
      <ProgressBar duration={data.seqDuration || 300} color={color} />
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', gap: hasImage ? '24px' : '36px' }}>
        <div
          style={{
            alignSelf: 'flex-start',
            opacity: 1, // Đứng yên vững chãi, không nhấp nhô/dập dềnh
            backgroundColor: color,
            color: '#000',
            fontWeight: 900,
            fontSize: tokens.typography.size.caption,
            padding: '14px 36px',
            borderRadius: '16px',
            textTransform: 'uppercase',
            boxShadow: `0 10px 25px ${color}66`,
          }}
        >
          {(() => {
            if (currentTag.includes('TAI NẠN') || currentTag.includes('TỘI PHẠM') || currentTag.includes('CẢNH BÁO') || currentTag.includes('NGUY HIỂM')) return `🚨 ${currentTag}`;
            if (currentTag.includes('NÓNG') || currentTag.includes('HOT') || currentTag.includes('BREAKING')) return `🔥 ${currentTag}`;
            if (currentTag.includes('CÔNG NGHỆ') || /(^|\s)AI(\s|$)/.test(currentTag)) return `⚡ ${currentTag}`;
            if (currentTag.includes('KINH TẾ') || currentTag.includes('TÀI CHÍNH') || currentTag.includes('THỊ TRƯỜNG')) return `📈 ${currentTag}`;
            if (currentTag.includes('GIÁO DỤC') || currentTag.includes('MỤC TIÊU')) return `🎯 ${currentTag}`;
            if (currentTag.includes('THỂ THAO') || currentTag.includes('BÓNG ĐÁ')) return `⚽ ${currentTag}`;
            return `📊 ${currentTag}`;
          })()}
        </div>
        <div
          style={{
            transform: `scale(${punchScale})`,
            opacity: 1, // Tiêu đề xuất hiện vững chãi, không dập dềnh
            fontSize: hasImage ? '64px' : '80px',
            fontWeight: 900,
            color: tokens.colors.text.headline,
            lineHeight: tokens.typography.lineHeight.tight,
            textShadow: '0 10px 40px rgba(0,0,0,0.85)',
            textAlign: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(12px)',
            padding: '18px 36px',
            borderRadius: '24px',
            border: `2px solid ${color}88`,
            boxShadow: `0 20px 50px rgba(0,0,0,0.8), 0 0 30px ${color}44`,
          }}
        >
          <HighlightText text={data.headline} color={color} />
        </div>

        {/* Dynamic B-roll Card tại Hook 0-3s nếu có ảnh báo chí */}
        {hasImage ? (
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '520px',
              borderRadius: '24px',
              overflow: 'hidden',
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              border: `2px solid ${color}55`,
              boxShadow: `0 25px 50px rgba(0,0,0,0.85), 0 0 35px ${color}33`,
              transform: `scale(${interpolate(frame, [0, data.seqDuration || 300], [1.0, 1.05], { extrapolateRight: 'clamp' })})`,
            }}
          >
            <Img
              src={staticFile(data.imageFile!)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
              }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: '16px',
                left: '16px',
                backgroundColor: 'rgba(0,0,0,0.8)',
                color: '#fff',
                padding: '6px 18px',
                borderRadius: '10px',
                fontSize: '22px',
                fontWeight: 700,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.2)',
                boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              }}
            >
              📷 {data.language === 'en' ? 'Evidence / News Photo' : 'Hình ảnh hiện trường / Báo chí'}
            </div>
          </div>
        ) : (
          <AudioVisualizer color={color} />
        )}

        {data.keyTakeaways && data.keyTakeaways.length > 0 && (
          <div
            style={{
              transform: `translateY(${cardY}px)`,
              opacity: cardProgress,
              fontSize: hasImage ? '34px' : tokens.typography.size.body,
              color: tokens.colors.text.body,
              lineHeight: tokens.typography.lineHeight.normal,
              backgroundColor: 'rgba(15,23,42,0.88)',
              backdropFilter: 'blur(16px)',
              padding: hasImage ? '20px 28px' : '32px',
              borderRadius: '20px',
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

  const titleProgress = spring({ frame: frame - 5, fps, config: tokens.animation.spring.smooth });
  const titleY = interpolate(titleProgress, [0, 1], [30, 0]);

  return (
    <SafeArea>
      <ProgressBar duration={data.seqDuration || 300} color={color} />
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '40px', paddingTop: '40px' }}>
        <div
          style={{
            transform: `translateY(${titleY}px)`,
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
              🎯 {resolveSceneTag(data.tag, data.language === 'en' ? 'KEY FACTS' : 'DIỄN BIẾN CHÍNH', data.language)}
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
            // Trượt vào êm ái, vào vị trí rồi đứng yên vững chãi (không dập dềnh say sóng)
            const startTime = takeawayStarts[idx] !== undefined ? takeawayStarts[idx] : 30 + idx * 45;
            const progress = spring({ frame: frame - startTime, fps, config: tokens.animation.spring.smooth });
            const cardY = interpolate(progress, [0, 1], [40, 0]);
            const cardScale = interpolate(progress, [0, 1], [0.95, 1]);
            const cardOpacity = interpolate(progress, [0, 1], [0, 1]);

            return (
              <div
                key={idx}
                style={{
                  opacity: cardOpacity,
                  transform: `translateY(${cardY}px) scale(${cardScale})`,
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

  const statProgress = spring({ frame: frame - 10, fps, config: tokens.animation.spring.smooth });
  const statText = data.statNumber || 'HOT';
  const statFontSize = statText.length > 10 ? '90px' : statText.length > 6 ? '120px' : '160px';

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
            opacity: 0.35,
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
            transform: `translateY(${interpolate(statProgress, [0, 1], [30, 0])}px)`,
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
            ✨ {resolveSceneTag(data.tag, data.language === 'en' ? 'STATS' : 'CON SỐ BIẾT NÓI', data.language)}
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
            transform: `scale(${statProgress})`,
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

  // Hiệu ứng zoom ambient background chậm rãi tạo chiều sâu
  const bgPan = interpolate(frame, [0, data.seqDuration || 300], [1.05, 1.15], { extrapolateRight: 'clamp' });
  
  // Hiệu ứng zoom siêu nhẹ cho ảnh chính (1.0 -> 1.03) để ảnh luôn sắc nét 100%, không bao giờ bị vỡ hạt hay crop méo
  const cardScale = interpolate(frame, [0, data.seqDuration || 300], [1.0, 1.03], { extrapolateRight: 'clamp' });
  const cardEntrance = spring({ frame: frame - 4, fps, config: tokens.animation.spring.smooth });
  const cardY = interpolate(cardEntrance, [0, 1], [30, 0]);

  const opacity = spring({ frame: frame - 2, fps, config: tokens.animation.spring.smooth });
  const contentY = interpolate(opacity, [0, 1], [40, 0]);
  const scanLineY = (frame * 6) % 1920;

  return (
    <div style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}>
      {/* 1. Ambient Blurred Backdrop: Phủ kín 100% khung hình 9:16 bằng màu sắc bức ảnh được làm mờ nghệ thuật */}
      {data.imageFile ? (
        <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
          <Img
            src={staticFile(data.imageFile)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              transform: `scale(${bgPan})`,
              filter: 'blur(45px) brightness(0.35) saturate(1.2)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: 'radial-gradient(circle at 50% 45%, rgba(0,0,0,0.1) 0%, rgba(2,6,23,0.85) 100%)',
            }}
          />
        </div>
      ) : (
        <div style={{ width: '100%', height: '100%', backgroundColor: '#020617', position: 'relative', overflow: 'hidden' }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage: `linear-gradient(${color}33 2px, transparent 2px), linear-gradient(90deg, ${color}33 2px, transparent 2px)`,
              backgroundSize: '60px 60px',
              transform: `scale(${bgPan})`,
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
            justifyContent: 'flex-start',
            paddingTop: '40px',
            height: '100%',
          }}
        >
          {/* Header Tag + Audio Visualizer */}
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
              📸 {resolveSceneTag(data.tag, data.language === 'en' ? 'EVIDENCE' : 'BẰNG CHỨNG', data.language)}
            </div>
            <AudioVisualizer color={color} />
          </div>

          {/* Headline */}
          <div
            style={{
              fontSize: '56px',
              fontWeight: 900,
              lineHeight: 1.15,
              color: '#fff',
              textShadow: '0 8px 24px rgba(0,0,0,0.9)',
            }}
          >
            <HighlightText text={data.headline} color={color} />
          </div>

          {/* 2. Floating High-Definition Image Card: Giữ nguyên 100% tỉ lệ và độ nét gốc của ảnh báo chí */}
          {data.imageFile && (
            <div
              style={{
                opacity: cardEntrance,
                transform: `scale(${cardScale}) translateY(${cardY}px)`,
                width: '100%',
                maxHeight: '740px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '24px',
                overflow: 'hidden',
                backgroundColor: 'rgba(15, 23, 42, 0.75)',
                border: `2px solid rgba(255, 255, 255, 0.2)`,
                boxShadow: `0 25px 60px rgba(0,0,0,0.85), 0 0 35px ${color}33`,
              }}
            >
              <Img
                src={staticFile(data.imageFile)}
                style={{
                  width: '100%',
                  maxHeight: '740px',
                  objectFit: 'contain',
                  display: 'block',
                }}
              />
            </div>
          )}

          {/* Key Takeaways Card */}
          {data.keyTakeaways && data.keyTakeaways.length > 0 && (
            <div
              style={{
                fontSize: '36px',
                color: '#f1f5f9',
                lineHeight: 1.35,
                backgroundColor: 'rgba(15,23,42,0.9)',
                backdropFilter: 'blur(16px)',
                padding: '24px 32px',
                borderRadius: '20px',
                borderLeft: `8px solid ${color}`,
                border: `1px solid rgba(255,255,255,0.12)`,
                borderLeftWidth: '8px',
                borderLeftColor: color,
                boxShadow: '0 15px 35px rgba(0,0,0,0.6)',
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

  const titleProgress = spring({ frame: frame - 10, fps, config: tokens.animation.spring.smooth });
  const contentY = interpolate(titleProgress, [0, 1], [30, 0]);

  return (
    <SafeArea>
      <ProgressBar duration={data.seqDuration || 300} color={color} />
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%', gap: '40px' }}>
        <div
          style={{
            opacity: titleProgress,
            transform: `translateY(${contentY}px)`,
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
          💬 {resolveSceneTag(data.tag, data.language === 'en' ? 'QUOTE' : 'PHÁT BIỂU', data.language)}
        </div>

        <div
          style={{
            opacity: titleProgress,
            transform: `translateY(${contentY}px)`,
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
  const tagUpper = (data.tag || '').toUpperCase();
  if (
    tagUpper.includes('NÓNG') ||
    tagUpper.includes('HOT') ||
    tagUpper.includes('ĐIỀU TRA') ||
    tagUpper.includes('BREAKING') ||
    tagUpper.includes('CẢNH BÁO') ||
    tagUpper.includes('KHẨN')
  ) {
    LayoutComponent = LayoutIntro;
  }

  // SPEC-05: Strict Layout Type Precedence (Đảm bảo luân phiên phong phú, không đè layout list/chart thành image)
  if (data.layoutType === 'intro') LayoutComponent = LayoutIntro;
  else if (data.layoutType === 'stat') LayoutComponent = LayoutStat;
  else if (data.layoutType === 'quote') LayoutComponent = LayoutQuote;
  else if (data.layoutType === 'image') LayoutComponent = LayoutImage;
  else if (data.layoutType === 'list') LayoutComponent = LayoutList;
  else if (data.layoutType === 'animated_counter') LayoutComponent = LayoutAnimatedCounter;
  else if (data.layoutType === 'bar_chart') LayoutComponent = LayoutBarChart;
  else if (data.layoutType === 'progress_ring') LayoutComponent = LayoutProgressRing;
  else if (data.layoutType === 'line_chart') LayoutComponent = LayoutLineChart;
  else if (data.layoutType === 'comparison') LayoutComponent = LayoutComparison;
  else if (data.imageFile && !data.layoutType) {
    LayoutComponent = LayoutImage;
  }


  // Handle Background Image inside the Scene to prevent bleeding and show scraped images
  const frame = useCurrentFrame();
  const imagePan = interpolate(frame, [0, data.seqDuration || 300], [1, 1.15], { extrapolateRight: 'clamp' });
  const hasImage = data.imageFile && data.imageFile.trim() !== '';

  // SPEC-03: Attention Reset Punch-Zoom (Chu kỳ 66 frames ~ 2.2s để mắt người xem luôn có kích thích mới)
  const resetCycle = 66;
  const cycleFrame = frame % resetCycle;
  const punchScale = 1 + Math.sin((cycleFrame / resetCycle) * Math.PI) * 0.032;
  const microPanX = Math.sin(frame * 0.04) * 4;

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
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: `scale(${imagePan})`,
                opacity: 0.35,
                filter: 'blur(30px) brightness(0.6)',
              }}
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

      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 2,
          transform: `scale(${punchScale}) translateX(${microPanX}px)`,
          transformOrigin: 'center center',
        }}
      >
        <LayoutComponent data={data} color={color} takeawayStarts={takeawayStarts} />
      </div>
    </div>
  );
};
