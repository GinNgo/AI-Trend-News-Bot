import React from 'react';
import { Img, staticFile } from 'remotion';
import { tokens } from '../design/tokens';

export const ThumbnailComp: React.FC<{
  title: string;
  category?: string;
  themeColor?: string;
  imageFile?: string;
  language?: 'vi' | 'en';
}> = ({ title, category, themeColor, imageFile, language = 'vi' }) => {
  const primaryColor = themeColor || tokens.colors.primary;
  const isEn = language === 'en';
  const channelLabel = isEn ? 'TECH PULSE' : 'TECH PULSE';

  return (
    <div
      style={{
        width: 1280,
        height: 720,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: tokens.colors.background,
        fontFamily: tokens.typography.fontFamily.display,
      }}
    >
      {/* ── Background image (if provided) ── */}
      {imageFile && (
        <Img
          src={staticFile(imageFile)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'brightness(0.4) saturate(1.2)',
          }}
        />
      )}

      {/* ── Dark gradient overlay for text readability ── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background: imageFile
            ? `linear-gradient(135deg, rgba(15, 23, 42, 0.92) 0%, rgba(15, 23, 42, 0.6) 50%, rgba(15, 23, 42, 0.85) 100%)`
            : `linear-gradient(135deg, ${tokens.colors.background} 0%, #1E293B 50%, ${tokens.colors.background} 100%)`,
        }}
      />

      {/* ── Accent glow (top-right) ── */}
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          right: '-10%',
          width: '60%',
          height: '60%',
          background: `radial-gradient(circle, ${primaryColor}30 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* ── Accent glow (bottom-left) ── */}
      <div
        style={{
          position: 'absolute',
          bottom: '-15%',
          left: '-10%',
          width: '50%',
          height: '50%',
          background: `radial-gradient(circle, ${tokens.colors.accent}20 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* ── Content container ── */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '48px 56px',
          zIndex: 1,
        }}
      >
        {/* ── Top bar: Category badge + Channel logo ── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          {/* Category badge */}
          {category && (
            <div
              style={{
                backgroundColor: primaryColor,
                color: '#FFFFFF',
                fontSize: '22px',
                fontWeight: tokens.typography.weight.bold,
                padding: '8px 20px',
                borderRadius: '8px',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                boxShadow: `0 4px 20px ${primaryColor}60`,
              }}
            >
              {category}
            </div>
          )}

          {/* Channel logo */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              border: `2px solid ${primaryColor}60`,
              borderRadius: '12px',
              padding: '8px 16px',
            }}
          >
            <span style={{ fontSize: '28px' }}>🚀</span>
            <span
              style={{
                fontSize: '18px',
                fontWeight: tokens.typography.weight.bold,
                color: tokens.colors.text.headline,
                letterSpacing: '2px',
              }}
            >
              {channelLabel}
            </span>
          </div>
        </div>

        {/* ── Headline text (max 2 lines) ── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          {/* Accent line */}
          <div
            style={{
              width: '80px',
              height: '5px',
              backgroundColor: primaryColor,
              borderRadius: '3px',
              boxShadow: `0 0 15px ${primaryColor}80`,
            }}
          />

          <div
            style={{
              fontSize: '58px',
              fontWeight: tokens.typography.weight.bold,
              color: tokens.colors.text.headline,
              lineHeight: 1.15,
              textShadow: '0 4px 30px rgba(0,0,0,0.5)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '90%',
            }}
          >
            {title}
          </div>

          {/* Bottom accent bar */}
          <div
            style={{
              width: '100%',
              height: '4px',
              background: `linear-gradient(90deg, ${primaryColor}, ${tokens.colors.accent}, transparent)`,
              borderRadius: '2px',
              marginTop: '8px',
            }}
          />
        </div>
      </div>
    </div>
  );
};
