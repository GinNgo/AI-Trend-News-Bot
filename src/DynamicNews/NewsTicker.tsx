import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { tokens } from '../design/tokens';

export const NewsTicker: React.FC<{
  title: string;
  themeColor: string;
  language?: string;
  headlines?: string[];
}> = ({ title, themeColor, language = 'vi', headlines = [] }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();

  // Speed of scrolling text
  const speed = 4; // pixels per frame
  const isEn = language === 'en';

  const headlinesText = headlines.length > 0
    ? headlines.map(h => h.toUpperCase()).join(' • ')
    : isEn ? '24/7 GLOBAL UPDATE' : 'CẬP NHẬT LIÊN TỤC 24/7';

  const tickerText = isEn
    ? `🔴 BREAKING NEWS • ${title.toUpperCase()} • ${headlinesText} • LIKE & SUBSCRIBE • `
    : `🔴 BẢN TIN ĐẶC BIỆT • ${title.toUpperCase()} • ${headlinesText} • BẤM LIKE & THEO DÕI ĐỂ KHÔNG BỎ LỠ • `;

  // Ticker bar animation (không dùng modulo để tránh giật lag khi chuỗi dài ngắn khác nhau)
  const offset = -(frame * speed);

  // Lặp chuỗi đủ nhiều để chạy suốt video 60 giây (~1800 frames * speed)
  const repeatedText = Array(30).fill(tickerText).join(' ');

  return (
    <div
      style={{
        position: 'absolute',
        top: '6%',
        left: 0,
        width: '100%',
        height: '70px',
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderBottom: `2px solid ${themeColor}`,
        borderTop: `2px solid ${themeColor}`,
        boxShadow: `0 10px 30px rgba(0,0,0,0.5)`,
        display: 'flex',
        alignItems: 'center',
        zIndex: 90,
        overflow: 'hidden',
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Badge bên trái */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          backgroundColor: '#ef4444',
          color: '#ffffff',
          fontWeight: 900,
          fontSize: '26px',
          display: 'flex',
          alignItems: 'center',
          padding: '0 30px',
          zIndex: 100,
          boxShadow: '10px 0 20px rgba(0,0,0,0.5)',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}
      >
        <div
          style={{
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            backgroundColor: '#fff',
            marginRight: '12px',
            opacity: frame % 30 < 15 ? 1 : 0.3, // nhấp nháy đèn live
          }}
        />
        {isEn ? 'BREAKING' : 'TIN NÓNG'}
      </div>

      {/* Dòng chữ chạy qua lại (News Crawl / Marquee) */}
      <div
        style={{
          display: 'flex',
          whiteSpace: 'nowrap',
          transform: `translateX(${offset}px)`,
          gap: '50px',
          marginLeft: '220px',
          fontSize: '28px',
          fontWeight: 700,
          color: '#f8fafc',
          textTransform: 'uppercase',
          letterSpacing: '1px',
        }}
      >
        <span>{repeatedText}</span>
      </div>
    </div>
  );
};
