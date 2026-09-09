import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });

  const cardY = interpolate(frame, [15, 35], [50, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const cardOpacity = interpolate(frame, [15, 35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 50px',
        color: 'white',
        fontFamily: 'Inter, system-ui, sans-serif',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          fontSize: '70px',
          fontWeight: '900',
          color: '#facc15',
          marginBottom: '30px',
        }}
      >
        FULL TIME: 2 - 1
      </div>

      <div
        style={{
          transform: `translateY(${cardY}px)`,
          opacity: cardOpacity,
          display: 'flex',
          flexDirection: 'column',
          gap: '24px',
          width: '100%',
        }}
      >
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            padding: '30px',
            borderRadius: '24px',
            fontSize: '36px',
            fontWeight: '600',
          }}
        >
          ⭐ <strong style={{ color: '#60a5fa' }}>Kylian Mbappe</strong> chạm mốc <strong>71 bàn</strong> tại C1, san bằng kỷ lục của Raul!
        </div>

        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            padding: '30px',
            borderRadius: '24px',
            fontSize: '36px',
            fontWeight: '600',
          }}
        >
          🔥 <strong style={{ color: '#38bdf8' }}>Thủ thành Courtois</strong> với 7 pha cứu thua bảo toàn chiến thắng!
        </div>

        <div
          style={{
            marginTop: '40px',
            fontSize: '32px',
            color: '#a3e635',
            fontWeight: '800',
            letterSpacing: '2px',
            textTransform: 'uppercase',
          }}
        >
          👉 Thả tim & Follow để nhận tin bóng đá mới nhất!
        </div>
      </div>
    </div>
  );
};
