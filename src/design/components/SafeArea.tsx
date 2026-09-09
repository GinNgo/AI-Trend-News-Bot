import React from 'react';
import { AbsoluteFill } from 'remotion';
import { tokens } from '../tokens';

export const SafeArea: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <AbsoluteFill
      style={{
        paddingTop: tokens.layout.safeArea.top,
        paddingBottom: tokens.layout.safeArea.bottom,
        paddingLeft: tokens.layout.safeArea.horizontal,
        paddingRight: tokens.layout.safeArea.horizontal,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center', // Giữ content ở giữa thay vì flex-end để dễ quản lý hơn với các layout khác nhau
        boxSizing: 'border-box',
        zIndex: 10 // Đảm bảo luôn nằm trên ScrimOverlay và Background
      }}
    >
      {children}
    </AbsoluteFill>
  );
};