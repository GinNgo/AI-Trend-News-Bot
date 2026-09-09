import React from 'react';
import { AbsoluteFill, useVideoConfig, interpolate, useCurrentFrame, Audio, staticFile, Sequence } from 'remotion';
import { TransitionSeries, springTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';

import { DynamicSceneItem, DynamicOutroData, DynamicNewsData } from './types';
import { DynamicScene } from './Scene';
import { DynamicOutro } from './Outro';
import { DynamicBackground } from './Background';

export const DynamicNewsComp: React.FC<DynamicNewsData> = (props) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const totalFrames = props.totalDurationInFrames || 1800;

  const getTransition = (idx: number) => {
    // Alternate transitions: right, fade, bottom, top
    const types = ['slide-right', 'fade', 'slide-bottom', 'slide-top'];
    const type = types[idx % types.length];

    if (type === 'fade') {
      return fade();
    } else if (type === 'slide-right') {
      return slide({ direction: 'from-right' });
    } else if (type === 'slide-bottom') {
      return slide({ direction: 'from-bottom' });
    } else {
      return slide({ direction: 'from-top' });
    }
  };

  return (
    <AbsoluteFill style={{ width, height, backgroundColor: '#020617' }}>
      {/* Dynamic Animated Sci-fi Background with HUD rings & glowing light */}
      <DynamicBackground
        primaryColor={props.themeColor || '#38bdf8'}
        bgStyle={props.bgStyle || 'hud'}
        totalDurationInFrames={totalFrames}
      />

      {/* Background Music */}
      <Audio src={staticFile('bgm.mp3')} volume={0.15} loop />

      {/* Dynamic Sequences for Audio */}
      {props.scenes.map((scene, idx) => (
        <Sequence key={`audio-${idx}`} from={scene.globalStart}>
          {/* We assume the generated audio files are placed in public/ */}
          <Audio src={staticFile(scene.audioFile)} volume={1.3} />
        </Sequence>
      ))}

      {props.outro && (
        <Sequence key="audio-outro" from={props.outro.globalStart}>
          <Audio src={staticFile(props.outro.audioFile)} volume={1.3} />
        </Sequence>
      )}

      {/* Dynamic Transition Series */}
      <TransitionSeries>
        {props.scenes.map((scene, idx) => (
          <React.Fragment key={`scene-${idx}`}>
            <TransitionSeries.Sequence durationInFrames={scene.seqDuration}>
              <DynamicScene data={scene} />
            </TransitionSeries.Sequence>

            {/* If there is a next scene OR if there is an Outro, we add a transition */}
            {(idx < props.scenes.length - 1 || props.outro) && (
              <TransitionSeries.Transition
                presentation={getTransition(idx)}
                timing={springTiming({ config: { damping: 12, stiffness: 100 }, durationInFrames: 20 })}
              />
            )}
          </React.Fragment>
        ))}

        {props.outro && (
          <TransitionSeries.Sequence durationInFrames={props.outro.seqDuration}>
            <DynamicOutro data={props.outro} />
          </TransitionSeries.Sequence>
        )}
      </TransitionSeries>
    </AbsoluteFill>
  );
};
