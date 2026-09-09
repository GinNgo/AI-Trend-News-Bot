import React from 'react';
import { AbsoluteFill, useVideoConfig, useCurrentFrame, Audio, staticFile, Sequence } from 'remotion';
import { TransitionSeries, springTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';

import { DynamicOutroData, DynamicNewsData } from './types';
import { DynamicScene } from './Scene';
import { DynamicOutro } from './Outro';
import { DynamicBackground } from './Background';
import { tokens } from '../design/tokens';

export const DynamicNewsComp: React.FC<DynamicNewsData> = (props) => {
  const { width, height } = useVideoConfig();
  const totalFrames = props.totalDurationInFrames || 1800;

  // Xóa bỏ random transition (vi phạm nguyên tắc), chỉ dùng slide mượt mà từ dưới lên hoặc fade
  const getTransition = (idx: number) => {
    // Luôn dùng fade để đảm bảo sự liền mạch, tránh giật lag hoặc quá lạm dụng chuyển động
    return fade();
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

            {/* Transition duy nhất và đồng bộ */}
            {(idx < props.scenes.length - 1 || props.outro) && (
              <TransitionSeries.Transition
                presentation={getTransition(idx)}
                timing={springTiming({ config: tokens.animation.spring.smooth, durationInFrames: tokens.animation.duration.medium })}
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