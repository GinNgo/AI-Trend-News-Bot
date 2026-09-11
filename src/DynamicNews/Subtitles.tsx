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

    // Match timestamp lines: 00:00:01.240 --> 00:00:01.640
    const timeMatch = line.match(
      /(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})/
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
        words.push({
          text,
          startFrame: Math.round(startSec * fps),
          endFrame: Math.round(endSec * fps),
        });
      }
    }
    i++;
  }

  if (words.length > 0) {
    // Group words into segments of ~8 words each
    const segmentSize = 8;
    for (let j = 0; j < words.length; j += segmentSize) {
      const segmentWords = words.slice(j, j + segmentSize);
      segments.push({
        words: segmentWords,
        startFrame: segmentWords[0].startFrame,
        endFrame: segmentWords[segmentWords.length - 1].endFrame,
      });
    }
  }

  return segments;
}

/**
 * Generate simple captions from voiceover text (no VTT needed).
 * Splits text into words and evenly distributes timing across the scene duration.
 */
export function generateSimpleCaptions(
  voiceoverText: string,
  sceneStartFrame: number,
  sceneDurationFrames: number,
  fps: number = 30
): CaptionSegment[] {
  const allWords = voiceoverText.split(/\s+/).filter((w) => w.length > 0);
  if (allWords.length === 0) return [];

  const framesPerWord = Math.max(4, Math.floor(sceneDurationFrames / allWords.length));
  const words: CaptionWord[] = allWords.map((text, idx) => ({
    text,
    startFrame: sceneStartFrame + idx * framesPerWord,
    endFrame: sceneStartFrame + (idx + 1) * framesPerWord,
  }));

  // Group into segments
  const segmentSize = 6;
  const segments: CaptionSegment[] = [];
  for (let j = 0; j < words.length; j += segmentSize) {
    const segmentWords = words.slice(j, j + segmentSize);
    segments.push({
      words: segmentWords,
      startFrame: segmentWords[0].startFrame,
      endFrame: segmentWords[segmentWords.length - 1].endFrame,
    });
  }

  return segments;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
  segments,
  color = '#38BDF8',
  position = 'bottom',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Find the currently active segment
  const activeSegment = segments.find(
    (seg) => frame >= seg.startFrame - 5 && frame <= seg.endFrame + 10
  );

  if (!activeSegment) return null;

  // Container entrance animation
  const enterProgress = spring({
    frame: frame - activeSegment.startFrame + 5,
    fps,
    config: { damping: 15, stiffness: 120, mass: 0.8 },
  });
  const containerY = interpolate(enterProgress, [0, 1], [30, 0]);
  const containerOpacity = interpolate(enterProgress, [0, 1], [0, 1]);

  // Exit fade
  const framesUntilEnd = activeSegment.endFrame - frame;
  const exitOpacity = framesUntilEnd < 10
    ? interpolate(framesUntilEnd, [0, 10], [0, 1], { extrapolateRight: 'clamp' })
    : 1;

  return (
    <div
      style={{
        position: 'absolute',
        [position === 'top' ? 'top' : 'bottom']: position === 'top' ? '15%' : '24%',
        left: '50%',
        transform: `translateX(-50%) translateY(${containerY}px)`,
        width: '88%',
        zIndex: 200,
        display: 'flex',
        justifyContent: 'center',
        opacity: containerOpacity * exitOpacity,
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(12px)',
          padding: '14px 28px',
          borderRadius: '16px',
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: '6px 10px',
          maxWidth: '100%',
          boxShadow: `0 8px 30px rgba(0,0,0,0.5)`,
        }}
      >
        {activeSegment.words.map((word, idx) => {
          const isActive = frame >= word.startFrame && frame <= word.endFrame;
          const isPast = frame > word.endFrame;
          const wordEnter = spring({
            frame: frame - word.startFrame,
            fps,
            config: { damping: 20, stiffness: 200, mass: 0.5 },
          });
          const scale = isActive ? 1 + interpolate(wordEnter, [0, 1], [0, 0.08]) : 1;

          return (
            <span
              key={idx}
              style={{
                fontSize: '36px',
                fontWeight: isActive ? 900 : 600,
                color: isActive ? color : isPast ? '#E2E8F0' : 'rgba(226, 232, 240, 0.6)',
                transform: `scale(${scale})`,
                transition: 'color 0.1s',
                textShadow: isActive
                  ? `0 0 20px ${color}88, 0 2px 8px rgba(0,0,0,0.8)`
                  : '0 2px 4px rgba(0,0,0,0.5)',
                fontFamily: '"Be Vietnam Pro", "Roboto", sans-serif',
                lineHeight: 1.5,
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
