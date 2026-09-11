import React from 'react';
import { spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { DynamicOutroData } from './types';
import { tokens } from '../design/tokens';
import { SafeArea } from '../design/components/SafeArea';

export const DynamicOutro: React.FC<{
  data?: DynamicOutroData;
  language?: 'vi' | 'en';
}> = ({ data, language = 'vi' }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isEn = language === 'en';

  const title = data?.title || (isEn ? 'DIGITAL ERA' : 'KỶ NGUYÊN SỐ VIỆT NAM');
  const subtitle = data?.subtitle || (isEn ? 'Stay updated with the latest tech & digital transformation' : 'Cập nhật thông tin công nghệ & chuyển đổi số quốc gia');

  // Hero moment: Reveal logo/title
  const scale = spring({
    frame: frame - 5,
    fps,
    config: tokens.animation.spring.stiff,
  });

  return (
    <div
      style={{
        flex: 1,
        position: 'absolute',
        width: '100%',
        height: '100%',
        backgroundColor: tokens.colors.background, // Opaque base
        overflow: 'hidden',
      }}
    >
      <SafeArea>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            fontFamily: tokens.typography.fontFamily.sans,
            textAlign: 'center',
            gap: '40px',
            zIndex: 2,
          }}
        >
          <div
            style={{
              transform: `scale(${Math.max(0, scale)})`,
              backgroundColor: 'rgba(15, 23, 42, 0.8)',
              border: `2px solid ${tokens.colors.primary}`,
              borderRadius: tokens.layout.radius,
              padding: '48px 32px',
              width: '100%',
            }}
          >
          <div style={{ fontSize: '80px', marginBottom: '24px' }}>🚀</div>
          <div
            style={{
              fontSize: tokens.typography.size.headline,
              fontWeight: tokens.typography.weight.bold,
              color: tokens.colors.primary,
              marginBottom: '16px',
              textTransform: 'uppercase',
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: tokens.typography.size.caption,
              color: tokens.colors.text.body,
              fontWeight: tokens.typography.weight.regular,
              lineHeight: tokens.typography.lineHeight.normal,
            }}
          >
            {subtitle}
          </div>
        </div>

        <div
          style={{
            transform: `scale(${Math.max(0, scale)})`,
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            width: '100%',
          }}
        >
          <div
            style={{
              backgroundColor: tokens.colors.text.headline,
              color: tokens.colors.background,
              padding: '24px',
              borderRadius: tokens.layout.radius,
              fontSize: tokens.typography.size.caption,
              fontWeight: tokens.typography.weight.bold,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '16px',
            }}
          >
            <span>👍</span> {isEn ? 'LIKE & SHARE' : 'NHẤN LIKE & CHIA SẺ'}
          </div>
        </div>
      </div>
    </SafeArea>
    </div>
  );
};