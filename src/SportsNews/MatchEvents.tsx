import React from 'react';
import { interpolate, useCurrentFrame, Img, staticFile } from 'remotion';

export const MatchEvents: React.FC = () => {
  const frame = useCurrentFrame();

  // Subtle Ken Burns zoom for Mbappe image
  const zoom = interpolate(frame, [0, 160], [1, 1.15], {
    extrapolateRight: 'clamp',
  });

  const events = [
    { time: "14'", event: "Mbappe dứt điểm mở tỷ số", score: "1 - 0", team: "Real" },
    { time: "23'", event: "Valverde ép sân phản lưới", score: "2 - 0", team: "Real" },
    { time: "77'", event: "Augusto dứt điểm cận thành", score: "2 - 1", team: "Inter" },
    { time: "90'", event: "Courtois cản phá xuất thần", score: "", team: "Highlight" },
  ];

  return (
    <div
      style={{
        flex: 1,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '60px 40px',
        color: 'white',
        fontFamily: 'Inter, system-ui, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Background Image */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          transform: `scale(${zoom})`,
          zIndex: 0,
        }}
      >
        <Img
          src={staticFile('mbappe.jpg')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center top',
          }}
        />
        {/* Dark Vignette Overlay */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)'
          }}
        />
      </div>

      <div style={{ position: 'relative', zIndex: 1, width: '100%' }}>
        {/* Scoreboard Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            width: '100%',
            marginBottom: '60px',
            padding: '24px 30px',
            background: 'linear-gradient(135deg, rgba(96, 165, 250, 0.4), rgba(56, 189, 248, 0.1))',
            borderRadius: '24px',
            border: '1px solid rgba(255,255,255,0.2)',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
          }}
        >
          <span style={{ fontSize: '40px', fontWeight: '900', color: '#60a5fa' }}>REAL MADRID</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <span style={{ fontSize: '56px', fontWeight: '900', color: '#ffffff' }}>2</span>
            <span style={{ fontSize: '40px', color: 'rgba(255,255,255,0.5)' }}>-</span>
            <span style={{ fontSize: '56px', fontWeight: '900', color: '#ffffff' }}>1</span>
          </div>
          <span style={{ fontSize: '40px', fontWeight: '900', color: '#38bdf8' }}>INTER MILAN</span>
        </div>

        {/* Timeline Events */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', width: '100%' }}>
          {events.map((evt, idx) => {
            const delay = idx * 25 + 15;
            const y = interpolate(frame - delay, [0, 20], [60, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });
            const opacity = interpolate(frame - delay, [0, 20], [0, 1], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            });

            return (
              <div
                key={idx}
                style={{
                  opacity,
                  transform: `translateY(${y}px)`,
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'rgba(0,0,0,0.6)',
                  padding: '24px 24px',
                  borderRadius: '20px',
                  borderLeft: `8px solid ${evt.team === 'Real' ? '#60a5fa' : evt.team === 'Inter' ? '#38bdf8' : '#facc15'}`,
                  boxShadow: '0 10px 20px rgba(0,0,0,0.3)',
                }}
              >
                <div style={{ width: '90px', fontSize: '32px', fontWeight: '900', color: '#facc15' }}>
                  {evt.time}
                </div>
                <div style={{ flex: 1, fontSize: '32px', fontWeight: '600', lineHeight: 1.3 }}>
                  {evt.event}
                </div>
                {evt.score && (
                  <div style={{
                    fontSize: '32px',
                    fontWeight: '900',
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    padding: '8px 16px',
                    borderRadius: '12px'
                  }}>
                    {evt.score}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
