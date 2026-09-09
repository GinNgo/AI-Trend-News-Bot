import React from 'react';
import { AbsoluteFill } from 'remotion';
import { tokens } from '../tokens';

export const ScrimOverlay: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        background: tokens.colors.overlay.scrim,
        pointerEvents: 'none',
        zIndex: 1 // Đảm bảo overlay nằm trên background và dưới text
      }}
    />
  );
};