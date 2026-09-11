import React from 'react';
import { AbsoluteFill, useVideoConfig, Audio, staticFile, Sequence } from 'remotion';
import { TransitionSeries, springTiming, linearTiming } from '@remotion/transitions';
import { slide } from '@remotion/transitions/slide';
import { fade } from '@remotion/transitions/fade';

import { DynamicNewsData } from './types';
import { DynamicScene } from './Scene';
import { DynamicOutro } from './Outro';
import { DynamicBackground } from './Background';
import { NewsTicker } from './NewsTicker';
import { SubtitleOverlay, generateSimpleCaptions } from './Subtitles';
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
            <DynamicOutro data={props.outro} language={props.language} />
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
        category={(props.category as string) || (props.scenes && props.scenes[0] && props.scenes[0].tag)}
        tickerTag={props.tickerTag as string | undefined}
        tickerColor={props.tickerColor as string | undefined}
      />

      {/* Auto-generated Subtitles from voiceover text */}
      {props.scenes.map((scene, idx) => {
        if (!scene.voiceover) return null;
        const captions = generateSimpleCaptions(
          scene.voiceover,
          scene.globalStart,
          scene.audioFrames || scene.seqDuration,
        );
        return (
          <Sequence key={`sub-${idx}`} from={scene.globalStart} durationInFrames={scene.seqDuration}>
            <SubtitleOverlay
              segments={captions.map(seg => ({
                ...seg,
                startFrame: seg.startFrame - scene.globalStart,
                endFrame: seg.endFrame - scene.globalStart,
                words: seg.words.map(w => ({
                  ...w,
                  startFrame: w.startFrame - scene.globalStart,
                  endFrame: w.endFrame - scene.globalStart,
                })),
              }))}
              color={props.themeColor || tokens.colors.accent}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};