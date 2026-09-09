import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';

export interface SceneData {
  tag: string;
  headline: string;
  keyTakeaways: string[];
}

export const GenericScene: React.FC<{
  data: SceneData;
  color: string;
  takeawayStarts: number[];
}> = ({ data, color, takeawayStarts }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleScale = spring({
    frame: frame - 10,
    fps,
    config: { damping: 12, stiffness: 120, mass: 0.8 },
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
      }}
    >
      <div
        style={{
          transform: `scale(${Math.max(0, titleScale)})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '50px',
        }}
      >
        <div
          style={{
            backgroundColor: color,
            color: '#000000',
            fontWeight: '900',
            fontSize: '32px',
            padding: '12px 28px',
            borderRadius: '9999px',
            textTransform: 'uppercase',
            boxShadow: `0 8px 24px ${color}66`,
          }}
        >
          🚀 {data.tag}
        </div>
        <div
          style={{
            fontSize: '52px',
            fontWeight: '900',
            color: '#ffffff',
            textAlign: 'center',
            textShadow: '0 8px 30px rgba(0,0,0,0.8)',
            backgroundColor: 'rgba(0,0,0,0.6)',
            padding: '24px 32px',
            borderRadius: '24px',
            border: `2px solid rgba(255,255,255,0.2)`,
            lineHeight: 1.3,
          }}
        >
          {data.headline}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', width: '100%' }}>
        {data.keyTakeaways.map((takeaway, idx) => {
          const scale = spring({
            frame: frame - (takeawayStarts[idx] || 0),
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
                borderLeft: `8px solid ${color}`,
                padding: '28px 32px',
                borderRadius: '0 24px 24px 0',
                boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
              }}
            >
              <div style={{ fontSize: '40px' }}>⚡</div>
              <div style={{ fontSize: '32px', color: '#f8fafc', lineHeight: '1.5', fontWeight: '600' }}>
                {takeaway}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
