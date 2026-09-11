const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const crypto = require('crypto');
const logger = require('../collector/utils/logger');

class VideoEngine {
  constructor(config) {
    this.config = config;
    this.publicDir = path.join(__dirname, '../../public');
    this.fps = 30; // Chuẩn Remotion
  }

  // Hash để biết nội dung cảnh có bị đổi hay không (phục vụ caching)
  generateSceneHash(scene, voiceConfig) {
    const dataString = JSON.stringify({
      voiceover: scene.voiceover,
      imageFile: scene.imageFile,
      voiceConfig
    });
    return crypto.createHash('md5').update(dataString).digest('hex');
  }

  // Generate audio for a single scene with cache check
  generateAudioForScene(scene, voiceConfig) {
    const hash = this.generateSceneHash(scene, voiceConfig);
    const audioName = `scene_${scene.id}_${hash}.mp3`;
    const audioPath = path.join(this.publicDir, audioName);

    // Nếu đã có sẵn audio khớp hash, không cần gọi lại TTS
    if (fs.existsSync(audioPath) && fs.statSync(audioPath).size > 500) {
      logger.info(`[VideoEngine] Dùng lại Audio Cache cho Scene ${scene.id} (Hash: ${hash})`);
      return { audioName, audioPath };
    }

    logger.info(`[VideoEngine] Sinh Audio mới cho Scene ${scene.id}...`);
    const tempFile = path.join(this.publicDir, `temp_${hash}.txt`);
    fs.writeFileSync(tempFile, scene.voiceover, 'utf-8');

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const ttsArgs = [
          '--voice', voiceConfig.voice,
          '-f', tempFile,
          '--write-media', audioPath,
          '--rate', voiceConfig.rate,
          '--pitch', voiceConfig.pitch
        ];
        const result = spawnSync('edge-tts', ttsArgs, { stdio: 'pipe', shell: true });
        if (result.error) throw result.error;

        if (fs.existsSync(audioPath) && fs.statSync(audioPath).size > 500) {
          fs.unlinkSync(tempFile);
          return { audioName, audioPath };
        }
      } catch (e) {
        logger.warn(`Lỗi TTS (Attempt ${attempt}): ${e.message.substring(0, 50)}`);
      }
    }

    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    logger.error(`[VideoEngine] Lỗi TTS không thể phục hồi cho Scene ${scene.id}. Báo lỗi để retry.`);
    throw new Error(`TTS failed permanently for Scene ${scene.id}`);
  }

  // Get exact duration of an mp3
  getAudioDuration(filePath) {
    const pyCode = 'import sys; from mutagen.mp3 import MP3; print(MP3(sys.argv[1]).info.length if len(sys.argv) > 1 else 0)';
    try {
      const result = spawnSync('python', ['-c', pyCode, filePath], { encoding: 'utf-8' });
      const output = (result.stdout || '').trim();
      const dur = parseFloat(output);
      return isNaN(dur) || dur <= 0 ? 10 : dur;
    } catch (e) {
      return 10;
    }
  }

  buildRenderPayload(storyPackage) {
    logger.info(`[VideoEngine] Bắt đầu xây dựng Render Payload. Target Duration: ${storyPackage.targetDurationSec}s`);

    let globalStart = 0;
    const padding = 15; // Frames đệm giữa các cảnh
    const finalScenes = [];
    const colors = ["#38bdf8", "#a855f7", "#eab308", "#22c55e", "#ef4444", "#ec4899", "#f97316"];

    const voiceConfig = {
      voice: process.env.TTS_VOICE || "vi-VN-HoaiMyNeural",
      rate: process.env.TTS_RATE || "+5%",
      pitch: process.env.TTS_PITCH || "+0Hz"
    };

    // Process each scene dynamically
    for (let i = 0; i < storyPackage.scenes.length; i++) {
      const s = storyPackage.scenes[i];

      // 1. Generate or load cached audio
      const { audioName, audioPath } = this.generateAudioForScene(s, voiceConfig);

      // 2. Determine frames based on real audio duration OR AI requested duration
      const realDurSec = this.getAudioDuration(audioPath);
      // Ưu tiên độ dài audio thực tế, nhưng đảm bảo không ngắn hơn AI đề xuất (tránh bị cắt sớm)
      const finalDurSec = Math.max(realDurSec, s.durationSec);
      const audioFrames = Math.round(realDurSec * this.fps);
      const totalSceneFrames = Math.round(finalDurSec * this.fps);

      const seqDur = totalSceneFrames + padding;

      // 3. Sync visual takeaways
      const takeaways = s.keyTakeaways || [];
      const takeawayStarts = takeaways.map((_, idx) => 60 + idx * Math.floor(audioFrames / (takeaways.length + 1)));

      finalScenes.push({
        id: s.id,
        tag: s.tag,
        layoutType: s.layoutType,
        imageFile: s.imageFile,
        headline: s.headline,
        keyTakeaways: s.keyTakeaways || [],
        statNumber: s.statNumber,
        statLabel: s.statLabel,
        quoteText: s.quoteText,
        quoteAuthor: s.quoteAuthor,
        audioFile: audioName,
        audioFrames: audioFrames, // Độ dài thực của audio
        seqDuration: seqDur,      // Độ dài vùng chứa của cảnh (có padding)
        globalStart: globalStart,
        color: colors[i % colors.length],
        takeawayStarts: takeawayStarts
      });

      globalStart += seqDur;
    }

    // Outro
    const outroDurSec = 5;
    const outroFrames = Math.round(outroDurSec * this.fps);
    const finalOutro = {
      title: storyPackage.title,
      subtitle: "Cảm ơn bạn đã theo dõi!",
      seqDuration: outroFrames,
      globalStart: globalStart
    };
    globalStart += outroFrames;

    // Package JSON for Remotion
    const finalRemotionJson = {
      title: storyPackage.title,
      category: storyPackage.category || (storyPackage.scenes && storyPackage.scenes[0] && storyPackage.scenes[0].tag),
      themeColor: storyPackage.themeColor,
      bgStyle: storyPackage.bgStyle,
      storyAngle: storyPackage.storyAngle,
      totalDurationInFrames: globalStart, // Tự động co giãn theo nội dung, KHÔNG HARDCODE
      scenes: finalScenes,
      outro: finalOutro
    };

    return finalRemotionJson;
  }

  async render(storyPackage, outputPath) {
    const payload = this.buildRenderPayload(storyPackage);

    // Ghi payload ra file cho Remotion đọc
    const jsonPath = path.join(__dirname, '../../src/dynamic_news.json');
    fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2));

    const totalSecs = Math.round(payload.totalDurationInFrames / this.fps);
    logger.info(`[VideoEngine] Đã đồng bộ Frame. Tổng thời lượng: ${totalSecs}s (${payload.totalDurationInFrames} frames)`);

    logger.info(`[VideoEngine] Bắt đầu Render bằng Remotion...`);
    const renderResult = spawnSync('npx', ['remotion', 'render', 'DynamicNews', outputPath], { stdio: 'inherit', shell: true });
    if (renderResult.error) {
      throw renderResult.error;
    }
    if (renderResult.status !== 0) {
      throw new Error(`Remotion render process exited with code ${renderResult.status}`);
    }

    logger.info(`[VideoEngine] Render hoàn tất: ${outputPath}`);
    return outputPath;
  }
}

module.exports = { VideoEngine };