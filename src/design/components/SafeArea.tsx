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
        justifyContent: 'flex-start', // Push up to avoid colliding with SubtitleBox
        boxSizing: 'border-box',
        zIndex: 10
      }}
    >
      {children}
    </AbsoluteFill>
  );
};