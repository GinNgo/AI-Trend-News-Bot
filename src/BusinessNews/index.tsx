import React from 'react';
import { AbsoluteFill, useVideoConfig, interpolate, useCurrentFrame, Audio, staticFile, Sequence } from 'remotion';
import { TransitionSeries, springTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';

import { Intro } from './Intro';
import { Body } from './Body';
import { Outro } from './Outro';

export const BusinessNewsComp: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const bgOffset = interpolate(frame, [0, 809], [0, 180], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${120 + bgOffset}deg, #020617, #0f172a, #1e293b)`,
        width,
        height,
      }}
    >
      {/* Background Music at soft volume */}
      <Audio src={staticFile('bgm.mp3')} volume={0.12} />

      {/* Energetic TikTok-style voiceovers */}
      <Sequence from={0}>
        <Audio src={staticFile('biz_tiktok_1.mp3')} volume={1.2} />
      </Sequence>

      <Sequence from={227}>
        <Audio src={staticFile('biz_tiktok_2.mp3')} volume={1.2} />
      </Sequence>

      <Sequence from={515}>
        <Audio src={staticFile('biz_tiktok_3.mp3')} volume={1.2} />
      </Sequence>

      <AbsoluteFill style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: 0.04 }}>
        <div style={{ fontSize: '700px', fontWeight: '900', color: 'white' }}>
          ALERT
        </div>
      </AbsoluteFill>

      {/* Seamless Transition Series */}
      <TransitionSeries>
        {/* Scene 1: Intro */}
        <TransitionSeries.Sequence durationInFrames={247}>
          <Intro />
        </TransitionSeries.Sequence>

        {/* Transition 1: Slide */}
        <TransitionSeries.Transition
          presentation={slide({ direction: 'from-right' })}
          timing={springTiming({ config: { damping: 12, stiffness: 100 }, durationInFrames: 20 })}
        />

        {/* Scene 2: Body */}
        <TransitionSeries.Sequence durationInFrames={308}>
          <Body />
        </TransitionSeries.Sequence>

        {/* Transition 2: Fade */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 12, stiffness: 80 }, durationInFrames: 20 })}
        />

        {/* Scene 3: Outro */}
        <TransitionSeries.Sequence durationInFrames={294}>
          <Outro />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
