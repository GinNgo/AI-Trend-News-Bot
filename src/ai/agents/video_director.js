/**
 * Video Director Agent (V3)
 * Location: src/ai/agents/video_director.js
 * 
 * Transforms a verified story, final script, and narration into an intentional,
 * granular Video Plan (scene-by-scene, shot-by-shot) with strict short-form
 * retention optimization and camera choreography.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getModelsForTask, blockModel, getModelBlockTimeRemaining } = require('../model_router');

class VideoDirector {
  constructor(options = {}) {
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY;
    this.genAI = options.genAI || (this.apiKey ? new GoogleGenerativeAI(this.apiKey) : null);
    this.modelName = options.modelName || process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    this.logFn = options.logFn || console.log;
  }

  /**
   * Produce a complete Video Plan from story & narration.
   */
  async directVideo(params) {
    const {
      storyPackage = {},
      script = null,
      narration = '',
      targetDurationSec = 48,
      platform = 'youtubeShorts',
      category = 'general',
      language = 'vi',
      availableImages = []
    } = params;

    this.logFn('\n🎬 [VideoDirector] Bắt đầu quy hoạch Đạo diễn hình ảnh & Cú máy (Shot Planning)...');

    const scenesSource = (script && script.scenes) || (storyPackage && storyPackage.scenes) || [];
    const title = (script && script.title) || (storyPackage && storyPackage.title) || 'Tin Nóng';

    // If Gemini is available, attempt AI director generation
    if (this.genAI) {
      try {
        const plan = await this._callAiDirector({
          title,
          scenes: scenesSource,
          narration,
          targetDurationSec,
          platform,
          category,
          language,
          availableImages
        });
        if (plan && plan.scenes && plan.scenes.length > 0) {
          const validated = this.validateVideoPlan(plan);
          if (validated.isValid) {
            this.logFn(`  ✅ [VideoDirector] Đã tạo Video Plan (${plan.scenes.length} cảnh, ${plan.totalShots || 'đa'} cú máy) thành công qua AI!`);
            return plan;
          } else {
            this.logFn(`  ⚠️ [VideoDirector] AI Plan không vượt qua validation: ${validated.issues.join('; ')}. Chuyển sang fallback deterministic.`);
          }
        }
      } catch (err) {
        this.logFn(`  ⚠️ [VideoDirector] Lỗi gọi AI Director: ${err.message}. Sử dụng Fallback Engine.`);
      }
    }

    // Deterministic fallback generator
    this.logFn('  🛡️ [VideoDirector] Sử dụng Deterministic Shot Planner dự phòng...');
    return this.buildDeterministicPlan({
      title,
      scenes: scenesSource,
      narration,
      targetDurationSec,
      platform,
      category,
      language,
      availableImages
    });
  }

  /**
   * Internal method calling Gemini with director prompt
   */
  async _callAiDirector({ title, scenes, narration, targetDurationSec, platform, category, language, availableImages }) {
    const fallbackModels = getModelsForTask ? getModelsForTask('DEFAULT', this.modelName) : [this.modelName];

    const prompt = `
You are an Elite Video Director and Motion Choreographer for high-retention vertical short-form video (YouTube Shorts, TikTok, Reels).
Your mission is to take a raw video script and convert it into a granular, multi-shot VIDEO PLAN.

DIRECTORIAL RULES:
1. RETENTION PACING: A viewer's eyes must see a visual change or reset every 1.5 to 2.5 seconds. Never leave a single static shot for longer than 3.5 seconds.
2. SHOT SUB-DIVISION: Every scene MUST be divided into multiple SHOTS so that each shot is between 1.5s and 3.0s.
3. CAMERA CHOREOGRAPHY: Assign one of these camera motions to each shot:
   - "zoom_punch" (rapid scale pulse on shocking hook/fact)
   - "ken_burns_pan" (smooth subtle pan across wide image)
   - "parallax_slide" (dynamic foreground / background contrast movement)
   - "static_stable" (rock-solid anchor for heavy data charts)
4. VISUAL TYPES:
   - "headline_impact" (big bold text card)
   - "broll_photo" (news image with safe crop)
   - "animated_counter" / "bar_chart" / "progress_ring" (for numbers)
   - "quote_focus" (for official quotes)
   - "comparison_split" (for contrasts)

INPUT SCRIPT:
Title: ${title}
Category: ${category}
Language: ${language}
Target Duration: ${targetDurationSec} seconds
Available Images: ${JSON.stringify(availableImages)}
Scenes:
${JSON.stringify(scenes, null, 2)}

OUTPUT JSON FORMAT ONLY:
{
  "hookStrategy": "CURIOSITY_GAP" | "ENTITY_CONFLICT" | "SHOCKING_STAT",
  "targetDurationSec": ${targetDurationSec},
  "pacing": "HIGH_ENERGY_DOCUMENTARY",
  "scenes": [
    {
      "sceneId": 1,
      "purpose": "HOOK",
      "narrationText": "...",
      "shots": [
        {
          "shotId": "1.1",
          "durationSec": 1.8,
          "purpose": "HOOK_PUNCH",
          "visualType": "headline_impact",
          "visualAsset": "",
          "cameraMotion": "zoom_punch",
          "onScreenText": "BOLD 2-4 WORDS",
          "voiceSegment": "first 5 words",
          "transition": "none",
          "audioSyncTrigger": "first_word"
        },
        {
          "shotId": "1.2",
          "durationSec": 2.5,
          "purpose": "CONTEXT_REVEAL",
          "visualType": "broll_photo",
          "visualAsset": "${availableImages[0] || ''}",
          "cameraMotion": "ken_burns_pan",
          "onScreenText": "CRITICAL DETAIL",
          "voiceSegment": "remaining words",
          "transition": "slide_right",
          "audioSyncTrigger": "entity_name"
        }
      ]
    }
  ]
}
`;

    for (const modelName of fallbackModels) {
      if (getModelBlockTimeRemaining && getModelBlockTimeRemaining(modelName) > 0) continue;
      try {
        const model = this.genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        });
        let raw = result.response.text();
        raw = raw.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(raw);
      } catch (e) {
        this.logFn(`  ⚠️ [VideoDirector] Thử model ${modelName} thất bại: ${e.message}`);
        if (blockModel) blockModel(modelName, 60);
      }
    }
    return null;
  }

  /**
   * Deterministic fallback Video Plan builder with adaptive multi-shot subdivision
   */
  buildDeterministicPlan(params) {
    const {
      title,
      scenes = [],
      targetDurationSec = 48,
      category = 'general',
      language = 'vi',
      availableImages = []
    } = params;

    const isEnglish = (language === 'en');
    const plannedScenes = [];
    let imagePointer = 0;
    let totalShotsCount = 0;

    const sceneCount = Math.max(1, scenes.length);
    const targetSceneDur = targetDurationSec / sceneCount;

    for (let i = 0; i < scenes.length; i++) {
      const sc = scenes[i];
      const isFirst = (i === 0);
      const isLast = (i === scenes.length - 1);
      const scenePurpose = isFirst ? 'HOOK' : isLast ? 'LOOP' : (sc.layoutType === 'stat' ? 'EVIDENCE_STAT' : 'CONTEXT');

      const narrationText = sc.voiceover || sc.voiceoverScript || sc.headline || '';
      const headline = sc.headline || (isEnglish ? 'BREAKING' : 'TIN NÓNG');

      let assignedImg = sc.imageFile || '';
      if (!assignedImg && availableImages.length > 0) {
        assignedImg = availableImages[imagePointer % availableImages.length];
        imagePointer++;
      }

      // Determine number of shots needed so each shot is <= 3.0 seconds
      const approxSceneDur = Math.max(3.0, targetSceneDur);
      const numShots = Math.max(2, Math.ceil(approxSceneDur / 2.5));
      const shotDuration = parseFloat((approxSceneDur / numShots).toFixed(1));

      const shots = [];
      const words = narrationText.split(' ').filter(Boolean);
      const wordsPerShot = Math.max(1, Math.floor(words.length / numShots));

      for (let sIdx = 0; sIdx < numShots; sIdx++) {
        const shotNum = sIdx + 1;
        const isHookShot = (isFirst && sIdx === 0);
        const shotWords = words.slice(sIdx * wordsPerShot, (sIdx + 1) * wordsPerShot).join(' ');

        let visualType = 'headline_impact';
        let cameraMotion = 'static_stable';
        let onScreenText = headline.toUpperCase().substring(0, 25);

        if (isHookShot) {
          visualType = 'headline_impact';
          cameraMotion = 'zoom_punch';
          onScreenText = headline.toUpperCase().substring(0, 25);
        } else if (sIdx === 1 && assignedImg) {
          visualType = 'broll_photo';
          cameraMotion = 'ken_burns_pan';
          onScreenText = (sc.keyTakeaways && sc.keyTakeaways[0]) ? sc.keyTakeaways[0].substring(0, 30) : headline;
        } else if (sc.layoutType === 'stat' || sc.statNumber) {
          visualType = 'animated_counter';
          cameraMotion = 'static_stable';
          onScreenText = sc.statNumber ? `${sc.statNumber} ${sc.statLabel || ''}` : headline;
        } else if (sIdx % 2 === 1) {
          visualType = assignedImg ? 'broll_photo' : 'headline_impact';
          cameraMotion = 'parallax_slide';
          onScreenText = (sc.keyTakeaways && sc.keyTakeaways[sIdx % (sc.keyTakeaways.length || 1)]) || headline;
        }

        shots.push({
          shotId: `${i + 1}.${shotNum}`,
          durationSec: shotDuration,
          purpose: isHookShot ? 'HOOK_PUNCH' : `SUB_BEAT_${shotNum}`,
          visualType,
          visualAsset: (visualType === 'broll_photo') ? assignedImg : '',
          cameraMotion,
          onScreenText: onScreenText.trim(),
          voiceSegment: shotWords || narrationText,
          transition: (sIdx === 0 && !isFirst) ? 'slide_right' : 'none',
          audioSyncTrigger: sIdx === 0 ? 'first_word' : 'beat_pulse'
        });
      }

      totalShotsCount += shots.length;

      plannedScenes.push({
        sceneId: i + 1,
        purpose: scenePurpose,
        narrationText,
        shots
      });
    }

    return {
      hookStrategy: isEnglish ? 'ENTITY_CONFLICT' : 'XUNG_DOT_THUC_THE',
      targetDurationSec,
      totalShots: totalShotsCount,
      pacing: 'RELENTLESS_SHORT_FORM',
      scenes: plannedScenes
    };
  }

  /**
   * Validate a Video Plan against project constraints
   */
  validateVideoPlan(plan) {
    const issues = [];
    if (!plan || typeof plan !== 'object') {
      return { isValid: false, issues: ['Plan is null or not an object'] };
    }
    if (!Array.isArray(plan.scenes) || plan.scenes.length === 0) {
      issues.push('Plan must have at least 1 scene');
    } else {
      let maxStatic = 0;
      plan.scenes.forEach(sc => {
        if (!Array.isArray(sc.shots) || sc.shots.length === 0) {
          issues.push(`Scene ${sc.sceneId} has no shots`);
        } else {
          sc.shots.forEach(sh => {
            if (sh.durationSec > maxStatic) maxStatic = sh.durationSec;
            if (sh.durationSec > 4.5) {
              issues.push(`Shot ${sh.shotId} exceeds static threshold (duration: ${sh.durationSec}s)`);
            }
          });
        }
      });
    }
    return {
      isValid: issues.length === 0,
      issues
    };
  }
}

module.exports = { VideoDirector };
