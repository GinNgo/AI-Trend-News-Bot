import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { DynamicOutroData } from './types';

export const DynamicOutro: React.FC<{
  data?: DynamicOutroData;
}> = ({ data }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const title = data?.title || 'KỶ NGUYÊN SỐ VIỆT NAM';
  const subtitle = data?.subtitle || 'Cập nhật thông tin công nghệ & chuyển đổi số quốc gia';

  const headerScale = spring({
    frame: frame - 5,
    fps,
    config: { damping: 12, stiffness: 120, mass: 0.8 },
  });

  const ctaScale = spring({
    frame: frame - 60,
    fps,
    config: { damping: 10, stiffness: 140 },
  });

  const byeScale = spring({
    frame: frame - 160,
    fps,
    config: { damping: 12, stiffness: 150 },
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
        gap: '40px',
      }}
    >
      <div
        style={{
          transform: `scale(${Math.max(0, headerScale)})`,
          backgroundColor: 'rgba(15, 23, 42, 0.95)',
          border: '4px solid #38bdf8',
          borderRadius: '32px',
          padding: '40px 36px',
          boxShadow: '0 20px 50px rgba(56, 189, 248, 0.3)',
          width: '100%',
        }}
      >
        <div style={{ fontSize: '90px', marginBottom: '16px' }}>🚀</div>
        <div
          style={{
            fontSize: '48px',
            fontWeight: '900',
            color: '#38bdf8',
            marginBottom: '16px',
            textTransform: 'uppercase',
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: '32px',
            color: '#e2e8f0',
            fontWeight: '600',
            lineHeight: '1.4',
          }}
        >
          {subtitle}
        </div>
      </div>

      <div
        style={{
          transform: `scale(${Math.max(0, ctaScale)})`,
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          width: '100%',
        }}
      >
        <div
          style={{
            backgroundColor: '#ef4444',
            color: '#ffffff',
            padding: '24px 32px',
            borderRadius: '24px',
            fontSize: '38px',
            fontWeight: '900',
            boxShadow: '0 10px 30px rgba(239, 68, 68, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
          }}
        >
          <span>👍</span> NHẤN LIKE & CHIA SẺ
        </div>

        <div
          style={{
            backgroundColor: '#0284c7',
            color: '#ffffff',
            padding: '24px 32px',
            borderRadius: '24px',
            fontSize: '38px',
            fontWeight: '900',
            boxShadow: '0 10px 30px rgba(2, 132, 199, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
          }}
        >
          <span>🔔</span> THEO DÕI ĐỂ KHÔNG BỎ LỠ
        </div>
      </div>

      <div
        style={{
          transform: `scale(${Math.max(0, byeScale)})`,
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          border: '2px solid rgba(255, 255, 255, 0.2)',
          borderRadius: '24px',
          padding: '24px 40px',
          fontSize: '34px',
          fontWeight: '800',
          color: '#facc15',
        }}
      >
        ✨ CẢM ƠN & HẸN GẶP LẠI! ✨
      </div>
    </div>
  );
};
