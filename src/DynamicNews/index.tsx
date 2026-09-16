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

  // Luân phiên các hiệu ứng chuyển cảnh mượt mà, sang trọng (loại bỏ hoàn toàn trượt dọc giật mắt)
  const getTransition = (idx: number) => {
    const types = [
      slide({ direction: 'from-right' }),
      fade(),
      slide({ direction: 'from-right' }),
      fade(),
    ];
    return types[idx % types.length];
  };

  const getTiming = (idx: number) => {
    // Luân phiên timing êm ái
    if (idx % 2 === 1) {
      return linearTiming({ durationInFrames: 12 });
    }
    return springTiming({ config: tokens.animation.spring.smooth, durationInFrames: 15 });
  };

  return (
    <AbsoluteFill style={{ width, height, backgroundColor: tokens.colors.background }}>
      <DynamicBackground
        primaryColor={props.themeColor || tokens.colors.primary}
        bgStyle={props.bgStyle || 'hud'}
        totalDurationInFrames={totalFrames}
      />

      {/* ========================================================= */}
      {/* SPEC-06: EMOTION-ADAPTIVE MULTI-TRACK AUDIO ENGINE         */}
      {/* ========================================================= */}
      {(() => {
        const chan = (props.channelId as string) || '';
        let bgmSource = (props.bgmFile as string) || '';
        if (!bgmSource) {
          if (chan === 'channel_global' || props.language === 'en' || props.category === 'GLOBAL_EXPLAINER') {
            bgmSource = 'bgm_global.mp3';
          } else if (chan === 'channel_tech' || props.category === 'TECH_INNOVATION') {
            bgmSource = 'bgm_tech.mp3';
          } else {
            bgmSource = 'bgm_domestic.mp3';
          }
        }
        const baseVol = (props.bgmVolume as number) || (chan === 'channel_global' ? 0.13 : 0.11);

        // Frame-accurate Dynamic Audio Ducking: Giảm âm khi có voiceover, tự động tăng âm lượng khi chuyển cảnh
        const getDynamicVolume = (f: number) => {
          const isVoiceActive = props.scenes.some(
            (s) => f >= s.globalStart && f < s.globalStart + (s.audioFrames || s.seqDuration)
          ) || (props.outro && f >= props.outro.globalStart && f < props.outro.globalStart + props.outro.audioFrames);

          return isVoiceActive ? baseVol : baseVol * 1.75;
        };

        return <Audio src={staticFile(bgmSource)} volume={getDynamicVolume} loop />;
      })()}

      {/* Dynamic Sequences for Voiceover Audio - Level 1.15 to avoid distortion/clipping */}
      {props.scenes.map((scene, idx) => (
        <Sequence key={`audio-${idx}`} from={scene.globalStart}>
          <Audio src={staticFile(scene.audioFile)} volume={1.15} />
        </Sequence>
      ))}

      {props.outro && (
        <Sequence key="audio-outro" from={props.outro.globalStart}>
          <Audio src={staticFile(props.outro.audioFile)} volume={1.15} />
        </Sequence>
      )}

      {/* ========================================================= */}
      {/* CINEMATIC SOUND EFFECTS (SFX)                             */}
      {/* ========================================================= */}
      {/* 0. Frame 0 Impact / Whoosh for Zero-Bumper Hook */}
      <Sequence key="sfx-hook-0" from={0} durationInFrames={20}>
        <Audio src={staticFile('sfx/whoosh.wav')} volume={0.5} />
      </Sequence>

      {/* 1. Whoosh transition between scenes */}
      {props.scenes.slice(1).map((scene, idx) => (
        <Sequence key={`sfx-whoosh-${idx}`} from={Math.max(0, scene.globalStart - 8)} durationInFrames={18}>
          <Audio src={staticFile('sfx/whoosh.wav')} volume={0.4} />
        </Sequence>
      ))}
      {props.outro && (
        <Sequence key="sfx-whoosh-outro" from={Math.max(0, props.outro.globalStart - 8)} durationInFrames={18}>
          <Audio src={staticFile('sfx/whoosh.wav')} volume={0.4} />
        </Sequence>
      )}

      {/* 2. Pop sounds for takeaway cards */}
      {props.scenes.map((scene, sIdx) =>
        (scene.takeawayStarts || []).map((tStart, tIdx) => (
          <Sequence key={`sfx-pop-${sIdx}-${tIdx}`} from={scene.globalStart + tStart} durationInFrames={10}>
            <Audio src={staticFile('sfx/pop.wav')} volume={0.45} />
          </Sequence>
        ))
      )}

      {/* 3. Ding sound for stats and counters */}
      {props.scenes.map((scene, sIdx) => {
        if (scene.statNumber || scene.layoutType === 'stat' || scene.layoutType === 'animated_counter') {
          return (
            <Sequence key={`sfx-ding-${sIdx}`} from={scene.globalStart + 15} durationInFrames={30}>
              <Audio src={staticFile('sfx/ding.wav')} volume={0.5} />
            </Sequence>
          );
        }
        return null;
      })}

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

      {/* Subtitles: Uses pre-synced VTT captions if provided, otherwise auto-generates smart captions */}
      {props.scenes.map((scene, idx) => {
        if (!scene.voiceover) return null;
        const captions = scene.captions && scene.captions.length > 0
          ? scene.captions
          : generateSimpleCaptions(
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