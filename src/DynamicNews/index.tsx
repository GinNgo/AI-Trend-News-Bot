import React from 'react';
import { AbsoluteFill, useVideoConfig, Audio, staticFile, Sequence } from 'remotion';
import { TransitionSeries, springTiming, linearTiming } from '@remotion/transitions';
import { slide } from '@remotion/transitions/slide';
import { wipe } from '@remotion/transitions/wipe';
import { fade } from '@remotion/transitions/fade';

import { DynamicOutroData, DynamicNewsData } from './types';
import { DynamicScene } from './Scene';
import { DynamicOutro } from './Outro';
import { DynamicBackground } from './Background';
import { NewsTicker } from './NewsTicker';
import { tokens } from '../design/tokens';

export const DynamicNewsComp: React.FC<DynamicNewsData> = (props) => {
  const { width, height } = useVideoConfig();
  const totalFrames = props.totalDurationInFrames || 1800;

  // Luân phiên các hiệu ứng chuyển cảnh mượt mà cho mỗi Scene
  const getTransition = (idx: number) => {
    const types = [
      slide({ direction: 'from-right' }),
      slide({ direction: 'from-bottom' }),
      slide({ direction: 'from-left' }),
      fade()
    ];
    return types[idx % types.length];
  };

  const getTiming = (idx: number) => {
    // Fade bị lỗi giật nháy nếu dùng spring, nên bắt buộc dùng linear
    if (idx % 4 === 3) {
      return linearTiming({ durationInFrames: 15 });
    }
    return springTiming({ config: tokens.animation.spring.smooth, durationInFrames: tokens.animation.duration.medium });
  };

  return (
    <AbsoluteFill style={{ width, height, backgroundColor: tokens.colors.background }}>
      <DynamicBackground
        primaryColor={props.themeColor || tokens.colors.primary}
        bgStyle={props.bgStyle || 'hud'}
        totalDurationInFrames={totalFrames}
      />

      {/* Background Music */}
      <Audio src={staticFile('bgm.mp3')} volume={0.15} loop />

      {/* Dynamic Sequences for Audio */}
      {props.scenes.map((scene, idx) => (
        <Sequence key={`audio-${idx}`} from={scene.globalStart}>
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

            {(idx < props.scenes.length - 1 || props.outro) && (
              <TransitionSeries.Transition
                presentation={getTransition(idx)}
                timing={getTiming(idx)}
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

      {/*
        The News Ticker is placed OUTSIDE the TransitionSeries so it persists
        continuously and keeps moving smoothly across all scene transitions!
      */}
      <NewsTicker
        title={props.title}
        themeColor={props.themeColor || tokens.colors.primary}
        language={props.language}
        headlines={props.scenes.map((s) => s.headline)}
      />
    </AbsoluteFill>
  );
};