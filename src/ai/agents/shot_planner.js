/**
 * Shot Planner Agent (V3)
 * Location: src/ai/agents/shot_planner.js
 * 
 * Expands scenes and narration into explicit, micro-timed shots.
 * Eliminates long static frames by enforcing dynamic visual changes
 * every 1.5s - 3.0s, synchronized to speech cues.
 */

class ShotPlanner {
  constructor(options = {}) {
    this.fps = options.fps || 30;
    this.maxShotDurationSec = options.maxShotDurationSec || 3.2;
    this.minShotDurationSec = options.minShotDurationSec || 1.4;
    this.logFn = options.logFn || console.log;
  }

  /**
   * Plan explicit shots for an entire video scene sequence.
   */
  planShotsForScenes(scenes = [], options = {}) {
    this.logFn(`[ShotPlanner] Bắt đầu chia nhỏ ${scenes.length} cảnh thành chuỗi Cú máy (Shots)...`);
    const allShots = [];
    let globalFrameCursor = 0;

    scenes.forEach((scene, sIdx) => {
      const sceneDurationSec = scene.durationSec || (scene.audioFrames ? (scene.audioFrames / this.fps) : null) || 8.0;
      const sceneShots = this.planShotsForScene(scene, sIdx + 1, globalFrameCursor, sceneDurationSec);
      allShots.push(...sceneShots);
      globalFrameCursor += Math.round(sceneDurationSec * this.fps);
    });

    this.logFn(`  ✅ [ShotPlanner] Hoàn tất: Tổng cộng ${allShots.length} cú máy cho toàn bộ video.`);
    return allShots;
  }

  /**
   * Plan explicit shots for a single scene.
   */
  planShotsForScene(scene, sceneIndex, globalStartFrame, sceneDurationSec) {
    const isFirstScene = (sceneIndex === 1);
    const targetShotCount = Math.max(2, Math.ceil(sceneDurationSec / 2.5));
    const shotDurationSec = sceneDurationSec / targetShotCount;
    const shotDurationFrames = Math.round(shotDurationSec * this.fps);

    const shots = [];
    const narration = scene.voiceover || scene.voiceoverScript || scene.headline || '';
    const words = narration.split(/\s+/).filter(Boolean);
    const wordsPerShot = Math.max(1, Math.floor(words.length / targetShotCount));

    for (let i = 0; i < targetShotCount; i++) {
      const shotId = `s${sceneIndex}_shot${i + 1}`;
      const isFirstShot = (i === 0);
      const isLastShot = (i === targetShotCount - 1);

      const shotStartFrame = globalStartFrame + (i * shotDurationFrames);
      const shotEndFrame = (i === targetShotCount - 1)
        ? globalStartFrame + Math.round(sceneDurationSec * this.fps)
        : shotStartFrame + shotDurationFrames;

      const shotStartSec = parseFloat((shotStartFrame / this.fps).toFixed(2));
      const shotEndSec = parseFloat((shotEndFrame / this.fps).toFixed(2));
      const actualDurationSec = parseFloat((shotEndSec - shotStartSec).toFixed(2));

      const shotWords = words.slice(i * wordsPerShot, isLastShot ? undefined : (i + 1) * wordsPerShot).join(' ');

      // Determine visual layout and camera choreography
      let visual = 'headline_impact';
      let camera = 'static_stable';
      let motion = 'none';
      let transition = isFirstShot ? (isFirstScene ? 'none' : 'slide_right') : 'cut';

      if (isFirstScene && isFirstShot) {
        visual = 'headline_impact';
        camera = 'zoom_punch';
        motion = 'scale_down_1.05_to_1.0';
      } else if (scene.imageFile && i === 1) {
        visual = 'broll_photo';
        camera = 'ken_burns';
        motion = 'pan_zoom_1.0_to_1.12';
      } else if (scene.layoutType === 'stat' || scene.statNumber) {
        visual = 'stat_counter';
        camera = 'static_stable';
        motion = 'number_increment';
      } else if (scene.layoutType === 'quote') {
        visual = 'quote_focus';
        camera = 'subtle_drift';
        motion = 'fade_in_card';
      } else if (i % 2 === 1) {
        visual = scene.imageFile ? 'broll_photo' : 'list_card';
        camera = 'parallax_slide';
        motion = 'drift_x';
      }

      shots.push({
        shotId,
        sceneIndex,
        startFrame: shotStartFrame,
        endFrame: shotEndFrame,
        startSec: shotStartSec,
        endSec: shotEndSec,
        durationSec: actualDurationSec,
        purpose: isFirstShot ? (isFirstScene ? 'HOOK' : 'BEAT_INTRO') : 'BEAT_DETAIL',
        visual,
        camera,
        motion,
        asset: (visual === 'broll_photo') ? (scene.imageFile || '') : '',
        text: (isFirstShot ? scene.headline : (scene.keyTakeaways && scene.keyTakeaways[i - 1])) || scene.headline || '',
        voiceSegment: shotWords || narration,
        transition
      });
    }

    return shots;
  }
}

module.exports = { ShotPlanner };
