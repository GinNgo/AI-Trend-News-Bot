import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Appears when Voice starts talking about Police (local frame 3)
  const scale = spring({
    frame: frame - 3,
    fps,
    config: { damping: 10, stiffness: 120, mass: 0.8 },
  });

  // Appears when Voice says "Đội mũ cho con là bảo vệ tính mạng..." (local frame 118)
  const lessonScale = spring({
    frame: frame - 118,
    fps,
    config: { damping: 10, stiffness: 150 },
  });

  // Appears when Voice says "Bấm theo dõi ngay..." (local frame 230)
  const ctaScale = spring({
    frame: frame - 230,
    fps,
    config: { damping: 10, stiffness: 150 },
  });

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 50px 100px 50px',
        color: 'white',
        fontFamily: 'Inter, system-ui, sans-serif',
        textAlign: 'center',
        gap: '40px'
      }}
    >
      <div
        style={{
          transform: `scale(${Math.max(0, scale)})`,
          backgroundColor: '#ef4444',
          padding: '40px',
          borderRadius: '30px',
          border: '4px solid white',
          boxShadow: '0 20px 50px rgba(239, 68, 68, 0.4)',
        }}
      >
        <div style={{ fontSize: '100px', marginBottom: '10px' }}>👮‍♂️</div>
        <div style={{ fontSize: '46px', fontWeight: '900', color: 'white', marginBottom: '16px' }}>
          CSGT VÀO CUỘC!
        </div>
        <div style={{ fontSize: '32px', fontWeight: '800', color: '#fef2f2', lineHeight: '1.4' }}>
          Gửi thông báo phạt<br/>thẳng về nhà trường!
        </div>
      </div>

      <div
        style={{
          transform: `scale(${Math.max(0, lessonScale)})`,
          fontSize: '36px',
          color: '#facc15',
          fontWeight: '800',
          backgroundColor: 'rgba(0,0,0,0.6)',
          padding: '24px 30px',
          borderRadius: '20px',
          border: '2px solid #facc15'
        }}
      >
        Đội mũ cho con là<br/>bảo vệ mạng sống của con!
      </div>

      <div
        style={{
          transform: `scale(${Math.max(0, ctaScale)})`,
          fontSize: '40px',
          color: '#ffffff',
          fontWeight: '900',
          textTransform: 'uppercase',
          backgroundColor: '#3b82f6',
          padding: '24px 40px',
          borderRadius: '9999px',
          boxShadow: '0 10px 30px rgba(59, 130, 246, 0.6)'
        }}
      >
        👍 FOLLOW CẬP NHẬT TIN NÓNG!
      </div>
    </div>
  );
};
