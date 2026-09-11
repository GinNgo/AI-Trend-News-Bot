import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const Body: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const points = [
    {
      badge: '95.000+',
      title: 'DOANH NGHIỆP RÀ SOÁT',
      desc: 'Chiến dịch làm sạch dữ liệu thuế quy mô cực lớn',
      color: '#facc15',
    },
    {
      badge: 'BẮT BUỘC',
      title: 'THANH TOÁN HẾT NỢ',
      desc: 'Muốn đóng mã số thuế? Phải trả sòng phẳng mọi khoản!',
      color: '#38bdf8',
    },
    {
      badge: 'TRUY QUÉT',
      title: 'CÔNG TY MA - HÓA ĐƠN',
      desc: 'Xử lý nghiêm hành vi mua bán hóa đơn bất hợp pháp',
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
        padding: '0 40px',
        color: 'white',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          fontSize: '48px',
          fontWeight: '900',
          color: '#ffffff',
          marginBottom: '50px',
          textAlign: 'center',
          textTransform: 'uppercase',
          backgroundColor: '#0ea5e9',
          padding: '12px 30px',
          borderRadius: '16px',
        }}
      >
        📌 ĐIỂM NÓNG CỤC THUẾ
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '30px', width: '100%' }}>
        {points.map((p, idx) => {
          const delay = idx * 25 + 5;
          const scale = spring({
            frame: frame - delay,
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
                border: `3px solid ${p.color}`,
                padding: '24px 28px',
                borderRadius: '24px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
              }}
            >
              <div
                style={{
                  backgroundColor: p.color,
                  color: '#000000',
                  fontWeight: '900',
                  fontSize: '28px',
                  padding: '12px 18px',
                  borderRadius: '16px',
                  minWidth: '150px',
                  textAlign: 'center'
                }}
              >
                {p.badge}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ fontSize: '32px', fontWeight: '900', color: p.color }}>
                  {p.title}
                </div>
                <div style={{ fontSize: '24px', color: '#e2e8f0', lineHeight: '1.4' }}>
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
