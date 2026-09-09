import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const Body: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const points = [
    {
      startFrame: 3, // Matches: "Nhiều phụ huynh bao biện là do muộn giờ..."
      badge: 'LÝ DO?',
      title: 'MUỘN GIỜ, KHÔNG CHỊU ĐỘI',
      desc: 'Phụ huynh thường lấy cớ vội vàng hoặc con không chịu nghe lời',
      color: '#facc15',
    },
    {
      startFrame: 117, // Matches: "Nhưng bạn có biết, người lớn không làm gương..."
      badge: 'TÁC HẠI!',
      title: 'LÀM GƯƠNG XẤU CHO TRẺ',
      desc: 'Người lớn không tự giác sẽ tạo tiền lệ xấu cho ý thức của con',
      color: '#ef4444',
    },
  ];

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 40px 100px 40px', // Extra bottom padding for captions
        color: 'white',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          fontSize: '44px',
          fontWeight: '900',
          color: '#ffffff',
          marginBottom: '50px',
          textAlign: 'center',
          textTransform: 'uppercase',
          backgroundColor: '#b91c1c',
          padding: '14px 32px',
          borderRadius: '16px',
          boxShadow: '0 8px 24px rgba(185, 28, 28, 0.6)'
        }}
      >
        ⚠️ BÀI HỌC Ý THỨC
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '40px', width: '100%' }}>
        {points.map((p, idx) => {
          // Card ONLY appears when the frame reaches its specific startFrame!
          const scale = spring({
            frame: frame - p.startFrame,
            fps,
            config: { damping: 10, stiffness: 150 },
          });

          return (
            <div
              key={idx}
              style={{
                transform: `scale(${Math.max(0, scale)})`,
                display: 'flex',
                alignItems: 'center',
                gap: '24px',
                backgroundColor: 'rgba(15, 23, 42, 0.9)',
                border: `4px solid ${p.color}`,
                padding: '30px 28px',
                borderRadius: '24px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
              }}
            >
              <div
                style={{
                  backgroundColor: p.color,
                  color: '#000000',
                  fontWeight: '900',
                  fontSize: '32px',
                  padding: '16px 20px',
                  borderRadius: '16px',
                  minWidth: '160px',
                  textAlign: 'center'
                }}
              >
                {p.badge}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '36px', fontWeight: '900', color: p.color }}>
                  {p.title}
                </div>
                <div style={{ fontSize: '28px', color: '#e2e8f0', lineHeight: '1.4' }}>
                  {p.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
