import React from 'react';
import { AbsoluteFill, useVideoConfig, interpolate, useCurrentFrame, Audio, staticFile, Sequence } from 'remotion';
import { TransitionSeries, springTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';

import { Intro } from './Intro';
import { MatchEvents } from './MatchEvents';
import { Outro } from './Outro';

export const SportsNewsComp: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Moving background gradient
  const bgOffset = interpolate(frame, [0, 1101], [0, 200], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(${135 + bgOffset}deg, #0f172a, #1e3a8a, #0f172a)`,
        width,
        height,
      }}
    >
      {/* Background Music (Volume 0.1 so we can hear the voice) */}
      <Audio src={staticFile('bgm.mp3')} volume={0.15} />

      {/* Exact audio start times */}
      <Sequence from={0}>
        <Audio src={staticFile('voice1.mp3')} volume={1} />
      </Sequence>
      <Sequence from={302}>
        <Audio src={staticFile('voice2.mp3')} volume={1} />
      </Sequence>
      <Sequence from={784}>
        <Audio src={staticFile('voice3.mp3')} volume={1} />
      </Sequence>

      <AbsoluteFill style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', opacity: 0.05 }}>
        <div style={{ fontSize: '1000px', fontWeight: '900', color: 'white', whiteSpace: 'nowrap' }}>
          CHAMPIONS LEAGUE
        </div>
      </AbsoluteFill>

      <TransitionSeries>
        {/* Intro Scene */}
        <TransitionSeries.Sequence durationInFrames={322}>
          <Intro />
        </TransitionSeries.Sequence>

        {/* Transition 1 */}
        <TransitionSeries.Transition
          presentation={slide({ direction: 'from-right' })}
          timing={springTiming({ config: { damping: 14, stiffness: 80, mass: 0.8 }, durationInFrames: 20 })}
        />

        {/* Match Events Scene */}
        <TransitionSeries.Sequence durationInFrames={502}>
          <MatchEvents />
        </TransitionSeries.Sequence>

        {/* Transition 2 */}
        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 12, stiffness: 60 }, durationInFrames: 20 })}
        />

        {/* Outro Scene */}
        <TransitionSeries.Sequence durationInFrames={317}>
          <Outro />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
