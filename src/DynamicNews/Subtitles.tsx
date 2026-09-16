import React from 'react';
import { useCurrentFrame, interpolate, spring, useVideoConfig } from 'remotion';

/**
 * Word-level animated captions that sync with TTS audio.
 * Designed for YouTube Shorts vertical format (1080x1920).
 *
 * When Edge TTS generates VTT subtitles, each word has a timestamp.
 * This component highlights the current word in real-time.
 */

export interface CaptionWord {
  text: string;
  startFrame: number; // Frame where this word starts being spoken
  endFrame: number;   // Frame where this word ends
}

export interface CaptionSegment {
  words: CaptionWord[];
  startFrame: number;
  endFrame: number;
}

interface SubtitleOverlayProps {
  /** Array of caption segments (typically 1 per scene) */
  segments: CaptionSegment[];
  /** Accent color for highlighted words */
  color?: string;
  /** Position: 'bottom' (default) or 'top' */
  position?: 'bottom' | 'top';
  /** Max words visible at once */
  maxVisibleWords?: number;
}

/**
 * Parse VTT content into CaptionSegment array.
 * Edge TTS generates word-level VTT with timestamps like:
 * 00:00:00.240 --> 00:00:00.640
 * <v>word</v>
 */
export function parseVttToCaptions(vttContent: string, fps: number = 30): CaptionSegment[] {
  const segments: CaptionSegment[] = [];
  const lines = vttContent.split('\n');
  const words: CaptionWord[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Match timestamp lines: 00:00:01.240 --> 00:00:01.640 or 00:00:01,240 --> 00:00:01,640
    const timeMatch = line.match(
      /(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/
    );

    if (timeMatch) {
      const startSec =
        parseInt(timeMatch[1]) * 3600 +
        parseInt(timeMatch[2]) * 60 +
        parseInt(timeMatch[3]) +
        parseInt(timeMatch[4]) / 1000;
      const endSec =
        parseInt(timeMatch[5]) * 3600 +
        parseInt(timeMatch[6]) * 60 +
        parseInt(timeMatch[7]) +
        parseInt(timeMatch[8]) / 1000;

      // Next line(s) contain the text
      i++;
      let text = '';
      while (i < lines.length && lines[i].trim() !== '') {
        text += lines[i].trim() + ' ';
        i++;
      }

      text = text.replace(/<[^>]+>/g, '').trim(); // Strip HTML tags
      if (text) {
        const lineWords = text.split(/\s+/).filter(Boolean);
        const cueStartFrame = Math.round(startSec * fps);
        const cueEndFrame = Math.round(endSec * fps);
        const cueDuration = Math.max(1, cueEndFrame - cueStartFrame);

        if (lineWords.length <= 1) {
          words.push({
            text,
            startFrame: cueStartFrame,
            endFrame: cueEndFrame,
          });
        } else {
          // Distribute words smoothly across the cue duration
          const framesPerWord = cueDuration / lineWords.length;
          lineWords.forEach((lw, wIdx) => {
            words.push({
              text: lw,
              startFrame: Math.round(cueStartFrame + wIdx * framesPerWord),
              endFrame: Math.round(cueStartFrame + (wIdx + 1) * framesPerWord),
            });
          });
        }
      }
    }
    i++;
  }

  if (words.length > 0) {
    // Nhịp đọc chuẩn điện ảnh: Gom 4-6 từ/cụm (trung bình 5 từ) để phụ đề đứng yên, êm mắt
    const segmentSize = 5;
    for (let j = 0; j < words.length; j += segmentSize) {
      const segmentWords = words.slice(j, j + segmentSize);
      segments.push({
        words: segmentWords,
        startFrame: segmentWords[0].startFrame,
        endFrame: segmentWords[segmentWords.length - 1].endFrame,
      });
    }

    // Giữ phụ đề liên tục cho tới khi cụm tiếp theo xuất hiện (không chớp tắt sớm)
    for (let s = 0; s < segments.length - 1; s++) {
      segments[s].endFrame = segments[s + 1].startFrame;
    }
    if (segments.length > 0) {
      segments[segments.length - 1].endFrame += 15;
    }
  }

  return segments;
}

/**
 * Generate smart captions from voiceover text.
 * Groups words into 4-6 word natural sentence fragments for stable, comfortable reading.
 */
export function generateSimpleCaptions(
  voiceoverText: string,
  sceneStartFrame: number,
  sceneDurationFrames: number,
  fps: number = 30
): CaptionSegment[] {
  const allWords = voiceoverText.split(/\s+/).filter((w) => w.length > 0);
  if (allWords.length === 0) return [];

  // Phân bổ thời lượng nói đều đặn
  const spokenDurationFrames = Math.max(sceneDurationFrames - 15, Math.floor(sceneDurationFrames * 0.9));
  const framesPerWord = Math.max(5, Math.floor(spokenDurationFrames / allWords.length));

  const words: CaptionWord[] = allWords.map((text, idx) => ({
    text,
    startFrame: sceneStartFrame + idx * framesPerWord,
    endFrame: sceneStartFrame + (idx + 1) * framesPerWord,
  }));

  // Gom từ tự nhiên 4-6 từ mỗi cụm để người xem đọc dễ chịu
  const segments: CaptionSegment[] = [];
  const targetSegmentSize = 5;

  let currentChunk: CaptionWord[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    currentChunk.push(w);

    const hasPunctuation = /[.,!?;:]$/.test(w.text);
    const reachedTarget = currentChunk.length >= targetSegmentSize;
    const isLastWord = (i === words.length - 1);

    if ((hasPunctuation && currentChunk.length >= 3) || reachedTarget || isLastWord) {
      segments.push({
        words: currentChunk,
        startFrame: currentChunk[0].startFrame,
        endFrame: currentChunk[currentChunk.length - 1].endFrame,
      });
      currentChunk = [];
    }
  }

  // Kéo dài thời gian lưu phụ đề liền mạch
  for (let s = 0; s < segments.length; s++) {
    if (s < segments.length - 1) {
      segments[s].endFrame = segments[s + 1].startFrame;
    } else {
      segments[s].endFrame = Math.max(segments[s].endFrame + 20, sceneStartFrame + sceneDurationFrames - 4);
    }
  }

  return segments;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
  segments,
  color = '#FACC15', // Vàng neon rực rỡ
  position = 'bottom',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Tìm cụm phụ đề đang kích hoạt
  const activeSegment = segments.find(
    (seg) => frame >= seg.startFrame - 1 && frame <= seg.endFrame
  );

  if (!activeSegment) return null;

  // Hiệu ứng Fade-in êm ái, đứng yên vững chãi (Tuyệt đối không scale nảy nén gây chóng mặt)
  const enterProgress = spring({
    frame: frame - activeSegment.startFrame + 1,
    fps,
    config: { damping: 20, stiffness: 120, mass: 0.8 },
  });
  const containerOpacity = interpolate(enterProgress, [0, 1], [0, 1]);

  return (
    <div
      style={{
        position: 'absolute',
        top: position === 'top' ? '15%' : '71%', // Safe zone chuẩn: nằm dưới biểu đồ/nội dung chính
        left: '50%',
        transform: 'translateX(-50%)', // Đứng yên vững chãi, không zoom co giật
        width: '94%',
        zIndex: 250,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        opacity: containerOpacity,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '12px 16px',
          maxWidth: '92%',
          padding: '12px 28px',
          backgroundColor: 'rgba(5, 10, 24, 0.78)',
          backdropFilter: 'blur(16px)',
          borderRadius: '24px',
          border: '1.5px solid rgba(255, 255, 255, 0.16)',
          boxShadow: '0 12px 36px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.15)',
        }}
      >
        {activeSegment.words.map((word, idx) => {
          const isActive = frame >= word.startFrame && frame <= word.endFrame;
          
          // Kiểm tra từ khóa đặc biệt (số liệu, tiền tệ, cảnh báo)
          const isNumberOrMoney = /[\d$%€£₫]/.test(word.text);
          const isWarning = /(cảnh báo|nguy hiểm|bốc hơi|sụp đổ|chấn động|shock|danger|warning|collapse|alien)/i.test(word.text);

          // Bảng màu siêu tương phản chuẩn CapCut / Alex Hormozi (Không dùng màu tối)
          let highlightColor = '#FFE600'; // Vàng điện quang rực rỡ
          if (isNumberOrMoney) highlightColor = '#00F2FE'; // Xanh ngọc điện cho con số
          else if (isWarning) highlightColor = '#FF9F0A'; // Cam rực rỡ cho cảnh báo

          return (
            <span
              key={idx}
              style={{
                fontSize: '48px', // Cố định kích cỡ chữ 100% để không làm xô lệch các từ bên cạnh
                fontWeight: 900,
                textTransform: 'uppercase',
                color: isActive ? highlightColor : '#FFFFFF',
                // Loại bỏ hoàn toàn transform rotate & scale giật mắt
                paintOrder: 'stroke fill',
                WebkitTextStroke: '4px #000000',
                textShadow: isActive
                  ? `0 0 20px ${highlightColor}, 0 4px 14px rgba(0,0,0,0.95)`
                  : '0 4px 14px rgba(0,0,0,0.9)',
                fontFamily: '"Montserrat", "Be Vietnam Pro", Impact, sans-serif',
                letterSpacing: '1px',
                lineHeight: 1.25,
                display: 'inline-block',
                transition: 'color 0.08s ease',
              }}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};
