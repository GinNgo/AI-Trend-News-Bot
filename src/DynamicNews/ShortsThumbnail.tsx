import React from 'react';
import { Img, staticFile } from 'remotion';

export interface ShortsThumbnailProps {
  title: string;
  category?: string;
  themeColor?: string;
  imageFile?: string;
  tag?: string;
  channelName?: string;
  language?: 'vi' | 'en';
}

export const ShortsThumbnailComp: React.FC<ShortsThumbnailProps> = ({
  title,
  category = 'TIN NÓNG 24H',
  themeColor = '#f59e0b',
  imageFile,
  tag = '🔴 ĐỘC QUYỀN',
  channelName = 'AN NEWS 24/7',
  language = 'vi',
}) => {
  const isEn = language === 'en';
  const displayTag = tag || (isEn ? '🔴 BREAKING' : '🔴 TIN NÓNG');
  const displayCategory = category || (isEn ? 'NEWS UPDATE' : 'THỜI SỰ XÃ HỘI');

  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: '#070b14',
        fontFamily: "'Be Vietnam Pro', 'Montserrat', Arial, sans-serif",
      }}
    >
      {/* ── Background Image Layer ── */}
      {imageFile ? (
        <Img
          src={staticFile(imageFile)}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: 'brightness(0.42) contrast(1.15) saturate(1.25)',
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'radial-gradient(circle at 50% 40%, #1e1b4b 0%, #090d16 100%)',
          }}
        />
      )}

      {/* ── Vignette & High-Contrast Overlay ── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          background:
            'linear-gradient(180deg, rgba(7,11,20,0.85) 0%, rgba(7,11,20,0.3) 30%, rgba(7,11,20,0.6) 65%, rgba(7,11,20,0.95) 100%)',
        }}
      />

      {/* ── Neon Ambient Glow Spots ── */}
      <div
        style={{
          position: 'absolute',
          top: '25%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '800px',
          height: '400px',
          background: `radial-gradient(ellipse, ${themeColor}45 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      {/* ── 5:4 SAFE ZONE CONTAINER (Y: 285px to 1635px = 1350px height) ── */}
      {/* Mọi nội dung text và visual quan trọng đều nằm trong khu vực này để khi YouTube crop 5:4 hoặc 1:1 không bị mất */}
      <div
        style={{
          position: 'absolute',
          top: 285,
          left: 0,
          width: 1080,
          height: 1350,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px 50px',
          boxSizing: 'border-box',
          zIndex: 10,
        }}
      >
        {/* ── Safe Zone Header: Tag & Category ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              backgroundColor: '#dc2626',
              padding: '12px 24px',
              borderRadius: '999px',
              boxShadow: '0 4px 20px rgba(220, 38, 38, 0.6)',
            }}
          >
            <span
              style={{
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '24px',
                letterSpacing: '1px',
                textTransform: 'uppercase',
              }}
            >
              {displayTag}
            </span>
          </div>

          <div
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              border: `2px solid ${themeColor}`,
              padding: '10px 22px',
              borderRadius: '999px',
              color: '#f8fafc',
              fontSize: '22px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '1px',
            }}
          >
            {displayCategory}
          </div>
        </div>

        {/* ── Safe Zone Center: Focal Punch Headline ── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            margin: 'auto 0',
          }}
        >
          {/* Attention-grabbing badge */}
          <div style={{ alignSelf: 'flex-start' }}>
            <span
              style={{
                display: 'inline-block',
                background: 'linear-gradient(90deg, #fbbf24, #f59e0b)',
                color: '#000000',
                fontWeight: 900,
                fontSize: '24px',
                padding: '8px 20px',
                borderRadius: '8px',
                letterSpacing: '1.5px',
                textTransform: 'uppercase',
                boxShadow: '0 4px 15px rgba(245, 158, 11, 0.4)',
              }}
            >
              ⚡ SỰ THẬT BẤT NGỜ
            </span>
          </div>

          {/* Main Title (High-contrast, bold, easily readable on mobile feed) */}
          <h1
            style={{
              fontSize: '66px',
              fontWeight: 900,
              color: '#ffffff',
              lineHeight: 1.18,
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '-1px',
              textShadow:
                '0 4px 12px rgba(0,0,0,0.9), 0 0 24px rgba(0,0,0,0.7), 2px 2px 0 #000, -2px -2px 0 #000, -2px 2px 0 #000, 2px -2px 0 #000',
            }}
          >
            {title}
          </h1>

          {/* Sub Hook Callout */}
          <div
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              borderLeft: `6px solid ${themeColor}`,
              padding: '16px 22px',
              borderRadius: '0 12px 12px 0',
              backdropFilter: 'blur(8px)',
            }}
          >
            <p
              style={{
                color: '#fef08a',
                fontSize: '30px',
                fontWeight: 800,
                margin: 0,
                lineHeight: 1.3,
                textShadow: '0 2px 8px rgba(0,0,0,0.8)',
              }}
            >
              👉 Xem ngay chi tiết để không bỏ lỡ!
            </p>
          </div>
        </div>

        {/* ── Safe Zone Footer: Channel Branding ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderTop: '2px solid rgba(255, 255, 255, 0.15)',
            paddingTop: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '50%',
                backgroundColor: themeColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '26px',
                fontWeight: 900,
                color: '#000',
              }}
            >
              📢
            </div>
            <div>
              <div
                style={{
                  color: '#ffffff',
                  fontSize: '28px',
                  fontWeight: 900,
                  letterSpacing: '1px',
                }}
              >
                {channelName}
              </div>
              <div style={{ color: '#94a3b8', fontSize: '18px', fontWeight: 600 }}>
                Kênh Tin Tức Cập Nhật 24/7
              </div>
            </div>
          </div>

          <div
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              padding: '8px 18px',
              borderRadius: '20px',
              color: '#e2e8f0',
              fontSize: '18px',
              fontWeight: 700,
            }}
          >
            #shorts #trending
          </div>
        </div>
      </div>
    </div>
  );
};
