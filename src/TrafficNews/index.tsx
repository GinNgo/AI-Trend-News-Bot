import React from 'react';
import { AbsoluteFill, useVideoConfig, interpolate, useCurrentFrame, Audio, staticFile, Sequence } from 'remotion';
import { TransitionSeries, springTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';

import { Intro } from './Intro';
import { Body } from './Body';
import { Outro } from './Outro';
import { Captions } from './Captions';

export const TrafficNewsComp: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const bgOffset = interpolate(frame, [0, 858], [0, 180], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${120 + bgOffset}deg, #18181b, #27272a, #09090b)`,
        width,
        height,
      }}
    >
      {/* Background Music at soft volume */}
      <Audio src={staticFile('bgm.mp3')} volume={0.12} />

      {/* Energetic TikTok-style voiceovers with exact frame sync */}
      {/* Audio 1: 246 frames. Pad to 266 */}
      <Sequence from={0}>
        <Audio src={staticFile('traffic_1.mp3')} volume={1.2} />
      </Sequence>

      {/* Audio 2: 242 frames. Pad to 262 */}
      <Sequence from={266}>
        <Audio src={staticFile('traffic_2.mp3')} volume={1.2} />
      </Sequence>

      {/* Audio 3: 310 frames. Pad to 330 */}
      <Sequence from={528}>
        <Audio src={staticFile('traffic_3.mp3')} volume={1.2} />
      </Sequence>

      <AbsoluteFill style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: 0.04 }}>
        <div style={{ fontSize: '700px', fontWeight: '900', color: 'white' }}>
          TRAFFIC
        </div>
      </AbsoluteFill>

      {/* Seamless Transition Series */}
      <TransitionSeries>
        {/* Scene 1: Intro (266 + 20 overlap = 286) */}
        <TransitionSeries.Sequence durationInFrames={286}>
          <Intro />
        </TransitionSeries.Sequence>

        {/* Transition 1: Slide */}
        <TransitionSeries.Transition
          presentation={slide({ direction: 'from-right' })}
          timing={springTiming({ config: { damping: 12, stiffness: 100 }, durationInFrames: 20 })}
        />

        {/* Scene 2: Body (262 + 20 overlap = 282) */}
        <TransitionSeries.Sequence durationInFrames={282}>
          <Body />
        </TransitionSeries.Sequence>

        {/* Transition 2: Fade */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 12, stiffness: 80 }, durationInFrames: 20 })}
        />

        {/* Scene 3: Outro (330) */}
        <TransitionSeries.Sequence durationInFrames={330}>
          <Outro />
        </TransitionSeries.Sequence>
      </TransitionSeries>

      {/* Live Sync Karaoke Captions matching every single sentence! */}
      <Captions />
    </AbsoluteFill>
  );
};
