const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const crypto = require('crypto');
const logger = require('../collector/utils/logger');

function normalizeVietnameseSpeechText(text) {
  if (!text) return text;
  return text
    .replace(/(\d+)\s*%/g, '$1 phần trăm')
    .replace(/\b([1-6])\s*[gG](?=[^a-zA-Z0-9_àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]|$)/g, '$1 Gờ')
    .replace(/\bSIM\b/g, 'Sim');
}

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
    let safeVoiceover = scene.voiceover || '';
    if (!voiceConfig.voice || voiceConfig.voice.startsWith('vi-')) {
      safeVoiceover = normalizeVietnameseSpeechText(safeVoiceover);
    }
    safeVoiceover = safeVoiceover
      .replace(/&/g, ' và ')
      .replace(/[<>{}[\]\\]/g, ' ')
      .replace(/["“”„«»'‘’`]/g, ' ')
      .replace(/[%*#@~^|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (!safeVoiceover) safeVoiceover = "Không có nội dung.";
    const tempFile = path.join(this.publicDir, `temp_tts_${Date.now()}_${Math.random().toString(36).substring(7)}.txt`);
    fs.writeFileSync(tempFile, safeVoiceover, 'utf-8');

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const pitchArg = (voiceConfig.pitch && voiceConfig.pitch !== '+0Hz' && !voiceConfig.voice.startsWith('vi-')) ? `--pitch="${voiceConfig.pitch}"` : '';
        const rateArg = voiceConfig.rate ? `--rate="${voiceConfig.rate}"` : '';
        const ttsCmd = `edge-tts --voice ${voiceConfig.voice} -f "${tempFile}" --write-media "${audioPath}" ${rateArg} ${pitchArg}`.replace(/\s+/g, ' ');
        const result = spawnSync(ttsCmd, { stdio: 'pipe', shell: true, timeout: 25000, windowsHide: true });
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

  // Get exact duration of an mp3 using Node.js music-metadata (no Python dependency!)
  getAudioDuration(filePath) {
    try {
      // Use synchronous approach: spawn a small node script
      const { spawnSync } = require('child_process');
      const script = `const mm = require('music-metadata');mm.parseFile(process.argv[1]).then(m => process.stdout.write(String(m.format.duration || 0))).catch(() => process.stdout.write('0'));`;
      const result = spawnSync(process.execPath, ['-e', script, filePath], { encoding: 'utf-8', timeout: 10000, windowsHide: true });
      const dur = parseFloat((result.stdout || '').trim());
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

    // Auto-switch TTS voice based on detected language
    const language = storyPackage.language || 'vi';
    const isEnglish = language === 'en';
    const voiceConfig = {
      voice: isEnglish ? 'en-US-ChristopherNeural' : (process.env.TTS_VOICE || "vi-VN-HoaiMyNeural"),
      rate: isEnglish ? '+8%' : (process.env.TTS_RATE || "+5%"),
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

      let cleanTag = (s.tag || '').trim();
      if (!cleanTag || /^(cảnh|scene)\s*\d*$/i.test(cleanTag)) {
        if (i === 0) cleanTag = isEnglish ? 'BREAKING' : 'TIN NÓNG';
        else if (s.layoutType === 'stat' || s.statNumber) cleanTag = isEnglish ? 'STATS' : 'CON SỐ BIẾT NÓI';
        else if (s.layoutType === 'quote') cleanTag = isEnglish ? 'PERSPECTIVE' : 'GÓC NHÌN';
        else if (s.layoutType === 'image') cleanTag = isEnglish ? 'EVIDENCE' : 'BẰNG CHỨNG';
        else if (i === storyPackage.scenes.length - 1) cleanTag = isEnglish ? 'DEBATE' : 'DƯ LUẬN';
        else cleanTag = isEnglish ? 'UPDATE' : 'DIỄN BIẾN';
      }

      finalScenes.push({
        id: s.id,
        tag: cleanTag,
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
        takeawayStarts: takeawayStarts,
        language: language,
        // Data Visualization fields
        chartData: s.chartData,
        progressValue: s.progressValue,
        progressLabel: s.progressLabel,
        counterTarget: s.counterTarget,
        counterPrefix: s.counterPrefix,
        counterSuffix: s.counterSuffix,
        comparisonData: s.comparisonData,
      });

      globalStart += seqDur;
    }

    // SPEC-01: THE ENDLESS RETENTION LOOP
    // Bỏ qua Outro nếu bật Endless Loop để tối ưu tỷ lệ xem lại > 100%
    let finalOutro = undefined;
    const enableEndlessLoop = process.env.ENABLE_ENDLESS_LOOP !== 'false';
    if (!enableEndlessLoop && !storyPackage.enableLoop) {
      const outroDurSec = 5;
      const outroFrames = Math.round(outroDurSec * this.fps);
      finalOutro = {
        title: storyPackage.title,
        subtitle: isEnglish ? "Thanks for watching!" : "Cảm ơn bạn đã theo dõi!",
        seqDuration: outroFrames,
        globalStart: globalStart
      };
      globalStart += outroFrames;
    }

    // Package JSON for Remotion
    const finalRemotionJson = {
      title: storyPackage.title,
      language: language,
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

    const outDir = path.dirname(path.resolve(outputPath));
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const configuredConcurrency = (this.config && this.config.REMOTION_CONCURRENCY) || 3;
    logger.info(`[VideoEngine] Bắt đầu Render bằng Remotion (concurrency=${configuredConcurrency})...`);
    const renderCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
    let renderResult = spawnSync(`${renderCmd} remotion render DynamicNews "${outputPath}" --concurrency=${configuredConcurrency}`, {
      stdio: 'inherit',
      shell: true,
      windowsHide: true
    });

    if (renderResult.status !== 0 || !fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1000000) {
      logger.warn(`[VideoEngine] ⚠️ Remotion lần 1 gặp sự cố (code ${renderResult.status}). Thử lại với chế độ An Toàn (Concurrency 1)...`);
      renderResult = spawnSync(`${renderCmd} remotion render DynamicNews "${outputPath}" --concurrency=1`, {
        stdio: 'inherit',
        shell: true,
        windowsHide: true
      });
    }

    if (renderResult.status !== 0 || !fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1000000) {
      logger.warn(`[VideoEngine] ⚠️ Remotion lần 2 chưa xong. Thử lại với chế độ Software Rendering (Tắt GPU Acceleration)...`);
      renderResult = spawnSync(`${renderCmd} remotion render DynamicNews "${outputPath}" --disable-hardware-acceleration --concurrency=1`, {
        stdio: 'inherit',
        shell: true,
        windowsHide: true
      });
    }

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