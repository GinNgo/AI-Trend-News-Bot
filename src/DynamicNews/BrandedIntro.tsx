import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig, Easing } from 'remotion';
import { tokens } from '../design/tokens';
import { SafeArea } from '../design/components/SafeArea';

export const BrandedIntro: React.FC<{
  channelName?: string;
  language?: 'vi' | 'en';
  color?: string;
}> = ({ channelName, language = 'vi', color }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isEn = language === 'en';

  const primaryColor = color || tokens.colors.primary;
  const name = channelName || 'TECH PULSE';
  const subtitle = isEn ? 'Breaking News • 24/7' : 'Tin Nóng • 24/7';

  // ── Flash / Burst effect (frames 0-5) ──────────────────────────
  const flashOpacity = interpolate(frame, [0, 2, 5], [1, 0.8, 0], {
    extrapolateRight: 'clamp',
  });

  // ── Background radial pulse ────────────────────────────────────
  const pulseScale = interpolate(frame, [0, 30, 60], [0.4, 1.2, 1.6], {
    extrapolateRight: 'clamp',
  });
  const pulseOpacity = interpolate(frame, [0, 15, 60], [0, 0.35, 0.15], {
    extrapolateRight: 'clamp',
  });

  // ── Logo spring bounce (starts after flash) ────────────────────
  const logoScale = spring({
    frame: frame - 4,
    fps,
    config: { damping: 10, stiffness: 180, mass: 0.6 },
  });

  const logoOpacity = interpolate(frame, [4, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Typewriter effect for channel name ─────────────────────────
  const typewriterStart = 12; // frames
  const charsPerFrame = 0.4;
  const visibleChars = Math.floor(
    Math.max(0, (frame - typewriterStart) * charsPerFrame)
  );
  const displayedName = name.slice(0, Math.min(visibleChars, name.length));
  const showCursor =
    frame >= typewriterStart && visibleChars < name.length + 8;

  // ── Subtitle fade in ──────────────────────────────────────────
  const subtitleStart = typewriterStart + Math.ceil(name.length / charsPerFrame) + 5;
  const subtitleOpacity = interpolate(
    frame,
    [subtitleStart, subtitleStart + 15],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );
  const subtitleY = interpolate(
    frame,
    [subtitleStart, subtitleStart + 15],
    [12, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // ── Horizontal glowing line expanding from center ──────────────
  const lineStart = 8;
  const lineWidth = interpolate(frame, [lineStart, lineStart + 25], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });
  const lineOpacity = interpolate(frame, [lineStart, lineStart + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // ── Overall fade-out at the very end (last 8 frames of 90) ────
  const fadeOut = interpolate(frame, [82, 90], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        flex: 1,
        position: 'absolute',
        width: '100%',
        height: '100%',
        backgroundColor: tokens.colors.background,
        overflow: 'hidden',
        opacity: fadeOut,
      }}
    >
      {/* ── Radial gradient pulse background ── */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          width: '120%',
          height: '120%',
          transform: `translate(-50%, -50%) scale(${pulseScale})`,
          background: `radial-gradient(circle, ${primaryColor}40 0%, ${primaryColor}10 40%, transparent 70%)`,
          opacity: pulseOpacity,
          pointerEvents: 'none',
        }}
      />

      {/* ── Flash burst overlay ── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: '#FFFFFF',
          opacity: flashOpacity,
          pointerEvents: 'none',
          zIndex: 10,
        }}
      />

      <SafeArea>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            fontFamily: tokens.typography.fontFamily.display,
            textAlign: 'center',
            gap: '16px',
            zIndex: 2,
          }}
        >
          {/* ── Logo emoji ── */}
          <div
            style={{
              fontSize: '120px',
              transform: `scale(${Math.max(0, logoScale)})`,
              opacity: logoOpacity,
              filter: `drop-shadow(0 0 30px ${primaryColor}80)`,
              marginBottom: '8px',
            }}
          >
            🚀
          </div>

          {/* ── Expanding glow line ── */}
          <div
            style={{
              width: `${lineWidth}%`,
              height: '4px',
              background: `linear-gradient(90deg, transparent, ${primaryColor}, ${tokens.colors.accent}, ${primaryColor}, transparent)`,
              borderRadius: '2px',
              opacity: lineOpacity,
              boxShadow: `0 0 20px ${primaryColor}80, 0 0 40px ${primaryColor}40`,
            }}
          />

          {/* ── Channel name (typewriter) ── */}
          <div
            style={{
              fontSize: tokens.typography.size.title,
              fontWeight: tokens.typography.weight.bold,
              color: tokens.colors.text.headline,
              textTransform: 'uppercase',
              letterSpacing: '8px',
              lineHeight: tokens.typography.lineHeight.tight,
              minHeight: tokens.typography.size.title,
              textShadow: `0 0 40px ${primaryColor}60`,
            }}
          >
            {displayedName}
            {showCursor && (
              <span
                style={{
                  color: primaryColor,
                  fontWeight: tokens.typography.weight.regular,
                  opacity: Math.sin(frame * 0.5) > 0 ? 1 : 0,
                }}
              >
                |
              </span>
            )}
          </div>

          {/* ── Subtitle ── */}
          <div
            style={{
              fontSize: tokens.typography.size.caption,
              fontWeight: tokens.typography.weight.semibold,
              color: primaryColor,
              opacity: subtitleOpacity,
              transform: `translateY(${subtitleY}px)`,
              letterSpacing: '4px',
            }}
          >
            {subtitle}
          </div>

          {/* ── Second glow line (mirror) ── */}
          <div
            style={{
              width: `${lineWidth * 0.6}%`,
              height: '2px',
              background: `linear-gradient(90deg, transparent, ${tokens.colors.accent}80, transparent)`,
              opacity: lineOpacity * 0.6,
              marginTop: '8px',
            }}
          />
        </div>
      </SafeArea>
    </div>
  );
};
