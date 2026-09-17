// Ép unbuffered stdout & stderr để log truyền realtime qua SSE mà không bị đệm
if (process.stdout && process.stdout._handle && process.stdout._handle.setBlocking) {
  try { process.stdout._handle.setBlocking(true); } catch(e) {}
}
if (process.stderr && process.stderr._handle && process.stderr._handle.setBlocking) {
  try { process.stderr._handle.setBlocking(true); } catch(e) {}
}

const { recordError } = require('./src/utils/error_recorder.js');
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const { scrapeArticleDeep } = require('./src/scraper/browser.js');
const { extractFacts, generateScript } = require('./src/ai/agents.js');
const { classifyLanguage, getSourceMetadata } = require('./src/ai/language_classifier.js');
const { classifyDataViz } = require('./src/ai/data_viz_classifier.js');

// Load config
require('dotenv').config();
const configPath = path.join(__dirname, 'config.json');
let config = {};
try {
  config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
} catch (e) {}

const apiKey = process.env.GEMINI_API_KEY || config.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

function getAudioDurationPython(filePath) {
  const pyCode = 'import sys; from mutagen.mp3 import MP3; print(MP3(sys.argv[1]).info.length if len(sys.argv) > 1 else 0)';
  try {
    const output = execSync(`python -c "${pyCode}" "${filePath}"`, { windowsHide: true }).toString().trim();
    const dur = parseFloat(output);
    return isNaN(dur) || dur <= 0 ? 10 : dur;
  } catch (e) {
    console.error("Lỗi khi đọc duration audio:", e.message);
    return 10; // Fallback 10s
  }
}

function parseVttToCaptions(vttContent, globalStart = 0, fps = 30) {
  const segments = [];
  const lines = vttContent.split('\n');
  const words = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    const timeMatch = line.match(
      /(\d{2}):(\d{2}):(\d{2})[.,](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/
    );

    if (timeMatch) {
      const startSec =
        parseInt(timeMatch[1]) * 3600 +
        parseInt(timeMatch[2]) * 60 +
        parseInt(timeMatch[3]) +
        parseInt(timeMatch[4]) / 1000;
      const endSec =
        parseInt(timeMatch[5]) * 3600 +
        parseInt(timeMatch[6]) * 60 +
        parseInt(timeMatch[7]) +
        parseInt(timeMatch[8]) / 1000;

      i++;
      let text = '';
      while (i < lines.length && lines[i].trim() !== '') {
        text += lines[i].trim() + ' ';
        i++;
      }

      text = text.replace(/<[^>]+>/g, '').trim();
      if (text) {
        const lineWords = text.split(/\s+/).filter(Boolean);
        const cueStart = Math.round(startSec * fps) + globalStart;
        const cueEnd = Math.round(endSec * fps) + globalStart;
        const cueDur = Math.max(1, cueEnd - cueStart);

        if (lineWords.length <= 1) {
          words.push({ text, startFrame: cueStart, endFrame: cueEnd });
        } else {
          const framesPerWord = cueDur / lineWords.length;
          lineWords.forEach((lw, wIdx) => {
            words.push({
              text: lw,
              startFrame: Math.round(cueStart + wIdx * framesPerWord),
              endFrame: Math.round(cueStart + (wIdx + 1) * framesPerWord),
            });
          });
        }
      }
    }
    i++;
  }

  // Chuẩn hóa ghép từ cho phụ đề: Nếu Edge-TTS tách "2" và "Gờ" thành 2 từ, gộp lại hiển thị "2G" trên phụ đề
  const mergedWords = [];
  for (let k = 0; k < words.length; k++) {
    const cur = words[k];
    const prev = mergedWords.length > 0 ? mergedWords[mergedWords.length - 1] : null;
    if (prev && /^[1-6]$/.test(prev.text)) {
      const gMatch = cur.text.match(/^([gG]ờ)([.,!?;:]*)$/i);
      if (gMatch) {
        prev.text = `${prev.text}G${gMatch[2] || ''}`;
        prev.endFrame = cur.endFrame;
        continue;
      }
    }
    mergedWords.push(cur);
  }

  if (mergedWords.length > 0) {
    // Ultra-Kinetic 2026: Chia phụ đề thành các cụm 1-3 từ
    const segmentSize = 3;
    for (let j = 0; j < mergedWords.length; j += segmentSize) {
      const segmentWords = mergedWords.slice(j, j + segmentSize);
      segments.push({
        words: segmentWords,
        startFrame: segmentWords[0].startFrame,
        endFrame: segmentWords[segmentWords.length - 1].endFrame,
      });
    }

    for (let s = 0; s < segments.length - 1; s++) {
      segments[s].endFrame = segments[s + 1].startFrame;
    }
    if (segments.length > 0) {
      segments[segments.length - 1].endFrame += 20;
    }
  }

  return segments;
}

function normalizeVietnameseSpeechText(text) {
  if (!text) return text;
  return text
    // 1. Phân tách phần trăm: 50% -> 50 phần trăm
    .replace(/(\d+)\s*%/g, '$1 phần trăm')
    // 2. Chuyển đổi các thế hệ mạng 1G - 6G
    .replace(/\b([1-6])\s*[gG](?=[^a-zA-Z0-9_àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]|$)/g, '$1 Gờ')
    // 3. Thuật ngữ Công nghệ & Viết tắt
    .replace(/\bSIM\b/g, 'Sim')
    .replace(/\bAI\b/g, 'Ây Ai')
    .replace(/\bCEO\b/gi, 'Xi i âu')
    .replace(/\bSmartphone(s)?\b/gi, 'Sờ mát phôn')
    .replace(/\bYouTube(r|rs)?\b/gi, 'Yêu túp')
    .replace(/\bVideo(s)?\b/gi, 'Vi đi ô')
    .replace(/\bApp(s)?\b/gi, 'Áp')
    .replace(/\bVNĐ\b/gi, 'Việt Nam Đồng')
    .replace(/\bUSD\b/gi, 'Đô la Mỹ')
    // 4. Sửa số thập phân (VD: 1.5 -> 1 phẩy 5)
    .replace(/(\d+)\.(\d+)/g, '$1 phẩy $2');
}

function generateAudioSafe(text, outputPath, voice, rate, pitch, vttPath = null) {
  const tempFile = path.join(__dirname, `temp_tts_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.txt`);

  // Xử lý chuẩn hóa phát âm tiếng Việt (tránh đọc 2G thành 2 giây, % thành bỏ qua, ...)
  let safeText = text || "Nội dung đang được cập nhật.";
  if (!voice || voice.startsWith('vi-')) {
    safeText = normalizeVietnameseSpeechText(safeText);
  }

  // Xử lý triệt để text để tránh lỗi SSML XML của Microsoft Edge-TTS (dấu ngoặc kép, &, ký tự đặc biệt)
  safeText = safeText
    .replace(/&/g, ' và ')
    .replace(/[<>{}[\]\\]/g, ' ')
    .replace(/["“”„«»'‘’`]/g, ' ')
    .replace(/[%*#@~^|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (safeText.length === 0) safeText = "Không có nội dung.";

  // Write text to a temp file (UTF-8 without BOM)
  fs.writeFileSync(tempFile, safeText, 'utf-8');

  const subArg = vttPath ? `--write-subtitles "${vttPath}"` : '';
  const fallbackVoice = voice.startsWith('vi-') ? (voice.includes('HoaiMy') ? 'vi-VN-NamMinhNeural' : 'vi-VN-HoaiMyNeural') : 'en-US-JennyNeural';

  for (let attempt = 1; attempt <= 3; attempt++) {
    const currentVoice = (attempt === 1) ? voice : fallbackVoice;
    // Microsoft Edge TTS không hỗ trợ --pitch cho giọng tiếng Việt (gây lỗi NoAudioReceived)
    const pitchArg = (pitch && pitch !== '+0Hz' && !currentVoice.startsWith('vi-')) ? `--pitch="${pitch}"` : '';
    // Nếu rate là +0% hoặc rỗng, không truyền cờ --rate để Edge-TTS chạy ở tốc độ chuẩn ổn định nhất
    const isRateDefault = !rate || rate === '+0%' || rate === '0%';
    const rateArg = (!isRateDefault && !(attempt >= 2 && currentVoice.includes('NamMinh'))) ? `--rate="${rate}"` : '';

    try {
      execSync(`edge-tts --voice ${currentVoice} -f "${tempFile}" --write-media "${outputPath}" ${subArg} ${rateArg} ${pitchArg}`.replace(/\s+/g, ' '), { 
        stdio: 'pipe', 
        timeout: 25000, 
        windowsHide: true 
      });
      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 500) {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        return; // Success
      }
    } catch (e) {
      console.warn(`    ⚠️ Thử lại lần ${attempt}/3 do lỗi TTS (${currentVoice}): ${e.message ? e.message.substring(0, 50) : e}...`);
      try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, attempt * 2000); } catch (_) {}
    }
  }
  if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);

  console.warn(`    ❌ Cảnh báo: Sinh âm thanh thất bại, dùng file âm thanh ngắn 4s (silence.mp3) an toàn.`);
  const silencePath = path.join(__dirname, 'public', 'silence.mp3');
  if (fs.existsSync(silencePath)) {
    fs.copyFileSync(silencePath, outputPath);
  } else {
    try {
      execSync(`ffmpeg -y -f lavfi -i anullsrc=r=24000:cl=mono -t 4 -q:a 9 -acodec libmp3lame "${outputPath}"`, { stdio: 'pipe', windowsHide: true });
    } catch (e) {
      fs.writeFileSync(outputPath, "dummy audio");
    }
  }
}

async function main() {
  const urlArg = process.argv[2];
  if (!urlArg) {
    console.error("❌ Vui lòng cung cấp link bài báo hoặc nội dung/prompt! Vd: node auto_pipeline.js <URL_HOAC_TEXT>");
    process.exit(1);
  }

  console.log("⚡ [Pipeline Engine] Bắt đầu tiếp nhận tác vụ và nạp tài nguyên...");
  let articleText = "";
  let downloadedImages = [];
  const publicDir = path.join(__dirname, 'public');

  if (urlArg.startsWith("http")) {
    console.log(`\n🔍 BƯỚC 1: Đang cào dữ liệu từ link bằng Deep Scraper (Puppeteer)...`);
    console.log(`URL: ${urlArg}`);
    try {
      const result = await scrapeArticleDeep(urlArg, publicDir);
      articleText = result.text;
      downloadedImages = result.images;
      console.log(`✅ Lấy thành công ${articleText.length} ký tự và ${downloadedImages.length} hình ảnh thực chứng.`);
    } catch (e) {
      console.error("❌ Lỗi khi cào dữ liệu:", e.message);
      process.exit(1);
    }
  } else if (urlArg.endsWith('.txt') && fs.existsSync(urlArg)) {
    console.log(`\n🔍 BƯỚC 1: Đọc nội dung từ file (${urlArg})...`);
    articleText = fs.readFileSync(urlArg, 'utf-8').trim();
    console.log(`✅ Lấy thành công ${articleText.length} ký tự từ file.`);
  } else {
    console.log(`\n🔍 BƯỚC 1: Đã nhận Prompt / Nội dung tự do trực tiếp.`);
    articleText = urlArg;
    console.log(`✅ Kích thước nội dung ban đầu: ${articleText.length} ký tự.`);
  }

  // Nếu prompt có chứa URL
  const urlMatch = articleText.match(/https?:\/\/[^\s"'\)]+/);
  if (urlMatch && !urlArg.startsWith("http")) {
    const embeddedUrl = urlMatch[0];
    console.log(`\n🔗 Phát hiện đường link bài viết trong Prompt: ${embeddedUrl}`);
    console.log(`🌐 Đang tự động cào thêm nội dung chi tiết & hình ảnh từ link để bổ sung kịch bản...`);
    try {
      const result = await scrapeArticleDeep(embeddedUrl, publicDir);
      if (result.text.length > 200) {
        console.log(`✅ Cào bổ sung thành công ${result.text.length} ký tự và ${result.images.length} hình ảnh từ bài báo gốc!`);
        articleText += `\n\n--- DỮ LIỆU CHI TIẾT TỰ ĐỘNG CÀO TỪ BÀI BÁO GỐC (${embeddedUrl}) ---\n${result.text}`;
        downloadedImages.push(...result.images);
      }
    } catch (e) {
      console.log(`⚠️ Không thể cào từ link đính kèm: ${e.message}. Tiếp tục với prompt hiện tại.`);
    }
  }

  // Chuyển sang AI Agents Workflow
  console.log(`\n🧠 KHỞI ĐỘNG HỆ THỐNG AI ĐA TẦNG...`);

  // Stage 1: Extract facts (initial pass in default language)
  let facts;
  try {
    facts = await extractFacts(genAI, articleText, config.LANGUAGE === 'auto' ? 'vi' : (config.LANGUAGE || 'vi'));
    console.log(`  ✅ Bóc tách sự kiện thành công!`);
    console.log(`  📎 Tóm tắt: ${facts.summary}`);
  } catch (err) {
    console.error("❌ AI không thể trích xuất sự kiện:", err.message);
    process.exit(1);
  }

  // Stage 1.5: Auto Language Detection (NEW)
  let detectedLanguage = process.env.PIPELINE_LANGUAGE || config.LANGUAGE || 'vi';
  if (!process.env.PIPELINE_LANGUAGE && (config.LANGUAGE === 'auto' || !config.LANGUAGE)) {
    try {
      const sourceUrl = urlArg.startsWith('http') ? urlArg : '';
      const langResult = await classifyLanguage(genAI, {
        sourceUrl,
        facts,
        rawText: articleText.substring(0, 3000),
      });
      detectedLanguage = langResult.language;
      console.log(`  🌐 Ngôn ngữ video: ${detectedLanguage === 'en' ? '🇬🇧 English' : '🇻🇳 Tiếng Việt'} (${(langResult.confidence * 100).toFixed(0)}%)`);
    } catch (err) {
      console.warn(`  ⚠️ Language detection thất bại, dùng mặc định: ${detectedLanguage}`);
    }
  }

  // If language is EN and facts were extracted in VI, re-extract in EN
  if (detectedLanguage === 'en') {
    console.log(`  🔄 Re-extract facts bằng Tiếng Anh...`);
    facts = await extractFacts(genAI, articleText, 'en');
  }

  // Stage 2: Generate video script
  let aiData;
  try {
    aiData = await generateScript(genAI, facts, downloadedImages, detectedLanguage);
    console.log(`  ✅ AI đã viết kịch bản gồm ${aiData.scenes.length} cảnh (${detectedLanguage}).`);
  } catch (err) {
    console.error("❌ AI không thể tạo kịch bản:", err.message);
    process.exit(1);
  }

  // Stage 2.5: Data Visualization Classification (NEW)
  try {
    aiData.scenes = await classifyDataViz(genAI, aiData.scenes, facts);
  } catch (err) {
    console.warn(`  ⚠️ Data viz classification thất bại, giữ layout gốc: ${err.message}`);
  }

  // FEATURE FLAG: V3 VIDEO PRODUCTION ENGINE (Default: v1 for 100% stable production)
  const videoEngineVersion = process.env.VIDEO_ENGINE || config.VIDEO_ENGINE || 'v1';
  console.log(`🎬 Động cơ Video: [VIDEO_ENGINE=${videoEngineVersion.toUpperCase()}]`);

  let videoPlan = null;
  if (videoEngineVersion === 'v2') {
    try {
      console.log(`\n🚀 [V3 ENGINE] Kích hoạt Video Director & Visual Choreographer...`);
      const { VideoDirector } = require('./src/ai/agents/video_director.js');
      const { VisualDirector } = require('./src/ai/agents/visual_director.js');
      const { RetentionOptimizer } = require('./src/ai/agents/retention_optimizer.js');

      const director = new VideoDirector({ genAI, modelName: process.env.GEMINI_MODEL || config.GEMINI_MODEL });
      videoPlan = await director.directVideo({
        storyPackage: facts,
        script: aiData,
        narration: aiData.scenes.map(s => s.voiceover).join(' '),
        targetDurationSec: 48,
        platform: 'youtubeShorts',
        category: aiData.category || '',
        language: detectedLanguage,
        availableImages: downloadedImages
      });

      const visualDirector = new VisualDirector();
      videoPlan = visualDirector.enhanceVideoPlan(videoPlan, downloadedImages);

      const retentionOptimizer = new RetentionOptimizer();
      const retentionReport = retentionOptimizer.evaluateRetention(videoPlan, aiData);
      if (!retentionReport.passed) {
        console.log(`  ⚡ [V3 ENGINE] Tự động tối ưu nhịp dựng kịch bản: ${retentionReport.recommendations.join('; ')}`);
        videoPlan = retentionOptimizer.optimizePlan(videoPlan);
      }
      console.log(`  ✅ [V3 ENGINE] Video Plan hoàn tất với ${videoPlan.totalShots || 'đa'} cú máy.`);
    } catch (v2Err) {
      console.warn(`⚠️ [V3 ENGINE] Lỗi khởi chạy V2, tự động fallback an toàn về V1: ${v2Err.message}`);
    }
  }

  // 1. Phân loại Kênh xuất bản (Thời sự VN vs Tech/Global)
  const { ChannelRouter } = require('./src/publishing/channel_router.js');
  const channelRouter = new ChannelRouter();
  const explicitEnvChannel = process.env.PIPELINE_CHANNEL_ID;
  const isEnglish = (detectedLanguage === 'en');
  const targetChannelId = (explicitEnvChannel && ['channel_domestic', 'channel_tech', 'channel_global'].includes(explicitEnvChannel))
    ? explicitEnvChannel
    : channelRouter.route({
        title: aiData.title,
        category: aiData.category || '',
        scope: (aiData.scope || (isEnglish ? 'international' : 'domestic')),
        language: detectedLanguage,
        tags: aiData.youtubeTags || []
      });
  const channelMeta = channelRouter.getChannelMeta(targetChannelId);
  console.log(`📌 Kênh mục tiêu: [${channelMeta.badge}] ${channelMeta.name} (${targetChannelId})`);

  const ttsVoice = channelMeta.ttsVoice || (isEnglish ? 'en-US-ChristopherNeural' : (config.TTS_VOICE || 'vi-VN-NamMinhNeural'));
  // Chuẩn viral: Tốc độ đọc tự nhiên, dứt khoát (+10% đến +12% tiếng Việt, +8% tiếng Anh)
  const ttsRate = channelMeta.ttsRate || (isEnglish ? '+8%' : (config.TTS_RATE || '+10%'));
  const ttsPitch = channelMeta.ttsPitch || config.TTS_PITCH || '+0Hz';
  console.log(`  🎙️ Cấu hình TTS: Giọng [${ttsVoice}], Tốc độ [${ttsRate}], Cao độ [${ttsPitch}]`);
  const FPS = 30;
  const padding = 15; // Giảm padding giữa các cảnh từ 20 xuống 15 frames để nhịp video liên tục
  let globalStart = 0;
  const colors = ["#38bdf8", "#a855f7", "#eab308", "#22c55e", "#ef4444", "#ec4899", "#f97316"];
  const finalScenes = [];

  for (let i = 0; i < aiData.scenes.length; i++) {
    const s = aiData.scenes[i];
    const audioName = `dynamic_${i+1}.mp3`;
    const vttName = `dynamic_${i+1}.vtt`;
    const audioPath = path.join(publicDir, audioName);
    const vttPath = path.join(publicDir, vttName);

    console.log(`  Đang sinh audio & phụ đề VTT cảnh ${i+1}...`);
    const voiceText = s.voiceover || s.voiceoverScript || s.headline;
    generateAudioSafe(voiceText, audioPath, ttsVoice, ttsRate, ttsPitch, vttPath);

    let durSec = getAudioDurationPython(audioPath);
    // GUARD-RAIL: Mỗi cảnh Shorts chỉ được phép dài từ 3s đến 14s tối đa!
    // Tránh tuyệt đối trường hợp file audio lỗi kéo dài hàng phút làm hỏng video
    if (durSec > 14 || isNaN(durSec) || durSec <= 0) {
      console.warn(`    ⚠️ Cảnh báo: Thời lượng cảnh ${i+1} (${durSec}s) vượt quá ngưỡng an toàn. Tự động điều chỉnh về 8s.`);
      durSec = 8;
    }
    const frames = Math.round(durSec * FPS);
    const seqDur = frames + padding + (i < aiData.scenes.length - 1 ? 15 : 0);
    const takeaways = s.keyTakeaways || [];
    const takeawayStarts = takeaways.map((_, idx) => 45 + idx * Math.floor(frames / (takeaways.length + 1)));

    // SPEC-05: MULTI-ASSET VISUAL B-ROLL DISTRIBUTION
    // Tránh tình trạng bài chỉ có 1 ảnh báo chí mà lặp đi lặp lại trên toàn bộ 5-7 cảnh gây nhàm chán
    let assignedImage = undefined;
    if (downloadedImages && downloadedImages.length > 0) {
      if (downloadedImages.length === 1) {
        // Chỉ có 1 ảnh: Ưu tiên dùng ở Cảnh 1 (Intro Hook) hoặc Cảnh 2 (Evidence). Các cảnh còn lại dành cho Data-viz/List/Quote
        if (i === 0 || (i === 1 && s.layoutType === 'image')) {
          assignedImage = downloadedImages[0];
        }
      } else {
        // Nhiều ảnh: Phân bổ cách nhật không trùng lặp ở các cảnh kề nhau
        if (s.imageFile && fs.existsSync(path.join(publicDir, s.imageFile))) {
          assignedImage = s.imageFile;
        } else if (i === 0 || s.layoutType === 'image' || (i % 2 === 0 && Math.floor(i / 2) < downloadedImages.length)) {
          const imgIdx = Math.floor(i / 2) % downloadedImages.length;
          assignedImage = downloadedImages[imgIdx];
        }
      }
    }

    // Trích xuất phụ đề VTT chính xác theo giọng đọc
    let sceneCaptions = undefined;
    if (fs.existsSync(vttPath)) {
      try {
        const vttContent = fs.readFileSync(vttPath, 'utf-8');
        sceneCaptions = parseVttToCaptions(vttContent, globalStart, FPS);
      } catch (err) {
        console.warn(`    ⚠️ Không thể parse VTT cảnh ${i+1}: ${err.message}`);
      }
    }

    let cleanTag = (s.tag || '').trim();
    if (!cleanTag || /^(cảnh|scene)\s*\d*$/i.test(cleanTag)) {
      if (i === 0) cleanTag = isEnglish ? 'BREAKING' : 'TIN NÓNG';
      else if (s.layoutType === 'stat' || s.statNumber) cleanTag = isEnglish ? 'STATS' : 'CON SỐ BIẾT NÓI';
      else if (s.layoutType === 'quote') cleanTag = isEnglish ? 'PERSPECTIVE' : 'GÓC NHÌN';
      else if (s.layoutType === 'image') cleanTag = isEnglish ? 'EVIDENCE' : 'BẰNG CHỨNG';
      else if (i === aiData.scenes.length - 1) cleanTag = isEnglish ? 'DEBATE' : 'DƯ LUẬN';
      else cleanTag = isEnglish ? 'UPDATE' : 'DIỄN BIẾN';
    }

    finalScenes.push({
      id: i + 1,
      tag: cleanTag,
      layoutType: s.layoutType || 'list',
      imageFile: assignedImage && fs.existsSync(path.join(publicDir, assignedImage)) ? assignedImage : undefined,
      headline: s.headline,
      keyTakeaways: s.keyTakeaways || [],
      statNumber: s.statNumber,
      statLabel: s.statLabel,
      quoteText: s.quoteText,
      quoteAuthor: s.quoteAuthor,
      voiceover: voiceText,
      audioFile: audioName,
      audioFrames: frames,
      globalStart: globalStart,
      seqDuration: seqDur,
      color: colors[i % colors.length],
      takeawayStarts: takeawayStarts,
      language: detectedLanguage,
      captions: sceneCaptions,
      // Data Visualization fields (populated by classifyDataViz)
      chartData: s.chartData || undefined,
      progressValue: s.progressValue || undefined,
      progressLabel: s.progressLabel || undefined,
      counterTarget: s.counterTarget || undefined,
      counterPrefix: s.counterPrefix || undefined,
      counterSuffix: s.counterSuffix || undefined,
      comparisonData: s.comparisonData || undefined,
    });

    globalStart += frames + padding;
  }

  // SPEC-01: THE ENDLESS RETENTION LOOP
  // Với video ngắn (<60s), loại bỏ Outro chào tạm biệt vì đây là "Exit Sign" làm sụt giảm Retention
  let finalOutro = undefined;
  const enableEndlessLoop = process.env.ENABLE_ENDLESS_LOOP !== 'false';

  if (!enableEndlessLoop) {
    console.log(`  Đang sinh audio Outro truyền thống...`);
    const outroVoiceover = isEnglish
      ? "Don't forget to like and subscribe for daily news! See you next time!"
      : "Bấm theo dõi kênh để cập nhật tin nóng mỗi ngày nhé! Hẹn gặp lại các bạn!";
    const outroAudio = 'dynamic_outro.mp3';
    const outroPath = path.join(publicDir, outroAudio);
    generateAudioSafe(outroVoiceover, outroPath, ttsVoice, ttsRate, ttsPitch);

    const outroDur = getAudioDurationPython(outroPath);
    const outroFrames = Math.round(outroDur * FPS);
    const outroSeqDur = outroFrames + padding;

    finalOutro = {
      title: aiData.title,
      subtitle: isEnglish ? "Fast & accurate news updates" : "Cập nhật tin tức nhanh và chính xác nhất",
      audioFile: outroAudio,
      audioFrames: outroFrames,
      globalStart: globalStart,
      seqDuration: outroSeqDur
    };

    globalStart += outroFrames + padding;
  } else {
    console.log(`  ♾️ KÍCH HOẠT THE ENDLESS RETENTION LOOP: Bỏ qua Outro truyền thống để tối đa hóa Retention >100%!`);
  }

  // SPEC-06: BỘ CHỌN NHẠC NỀN DYNAMIC THEO CHỦ ĐỀ & THỜI GIAN (TOPIC & TIME-ADAPTIVE BGM)
  const { selectBgm } = require('./src/audio/bgm_selector.js');
  const bgmSelection = selectBgm({
    title: aiData.title,
    category: (facts && facts.category) || aiData.category || '',
    channelId: targetChannelId,
    tags: aiData.youtubeTags || [],
    language: detectedLanguage
  });
  console.log(`🎵 Nhạc nền thích ứng: [${bgmSelection.genre}] ${bgmSelection.trackName} (${bgmSelection.bgmFile}, vol: ${bgmSelection.bgmVolume})`);

  const finalRemotionJson = {
    channelId: targetChannelId,
    bgmFile: bgmSelection.bgmFile,
    bgmVolume: bgmSelection.bgmVolume,
    language: detectedLanguage,
    title: aiData.title,
    category: (facts && facts.category) || (aiData.scenes && aiData.scenes[0] && aiData.scenes[0].tag),
    themeColor: aiData.themeColor,
    bgStyle: aiData.bgStyle,
    totalDurationInFrames: globalStart,
    scenes: finalScenes,
    outro: finalOutro
  };

  fs.writeFileSync(path.join(__dirname, 'src', 'dynamic_news.json'), JSON.stringify(finalRemotionJson, null, 2));
  console.log(`✅ Đồng bộ Frame hoàn tất. Tổng thời lượng: ${globalStart} frames (~${Math.round(globalStart/FPS)}s)`);

  console.log(`\n🎬 BƯỚC 4: Đang Render Video hoàn chỉnh (Remotion)...`);

  // 2. Cấu trúc thư mục theo Ngày (YYYY-MM-DD) và Kênh (channel_domestic / channel_tech)
  const todayFolder = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const channelFolder = targetChannelId;
  const targetVideosDir = path.join(__dirname, 'out', 'videos', todayFolder, channelFolder);
  if (!fs.existsSync(targetVideosDir)) {
    fs.mkdirSync(targetVideosDir, { recursive: true });
  }

  // Tạo slug sạch từ tiêu đề video để tên file video phản ánh đúng nội dung, dễ tìm kiếm và đối chiếu
  const sanitizeSlug = (str) => {
    return (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Bỏ dấu tiếng Việt
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 60);
  };
  const titleSlug = sanitizeSlug(aiData.youtubeTitle || aiData.title || (aiData.scenes && aiData.scenes[0] && aiData.scenes[0].headline) || 'video');
  const renderId = `RN-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const videoFileName = `${renderId}_${titleSlug}.mp4`;
  // Sử dụng forward slash cho đường dẫn Remotion CLI
  const relativeVideoPath = `out/videos/${todayFolder}/${channelFolder}/${videoFileName}`;
  const uniqueVideoPath = path.join(targetVideosDir, videoFileName);
  const previewVideoPath = path.join(__dirname, 'out', 'auto_news_result.mp4');

  console.log(`Đang chạy: npx remotion render DynamicNews ${relativeVideoPath}`);

  // 0. Đảm bảo toàn vẹn dữ liệu Media trước khi Remotion khởi chạy (tránh crash do file rỗng)
  if (finalScenes && finalScenes.length > 0) {
    for (let i = 0; i < finalScenes.length; i++) {
      const sc = finalScenes[i];
      const audPath = path.join(publicDir, sc.audioFile || `dynamic_${i+1}.mp3`);
      if (!fs.existsSync(audPath) || fs.statSync(audPath).size < 500) {
        console.warn(`⚠️ Phục hồi audio cảnh ${i+1}: file thiếu hoặc rỗng. Gán silence an toàn...`);
        const silencePath = path.join(publicDir, 'silence.mp3');
        if (fs.existsSync(silencePath)) fs.copyFileSync(silencePath, audPath);
      }
      if (sc.imageFile) {
        const imgPath = path.join(publicDir, sc.imageFile);
        if (!fs.existsSync(imgPath) || fs.statSync(imgPath).size < 500) {
          sc.imageFile = undefined;
        }
      }
    }
  }

  const recoverInProgress = () => {
    if (fs.existsSync(uniqueVideoPath) && fs.statSync(uniqueVideoPath).size > 1000000) return true;
    try {
      if (fs.existsSync(targetVideosDir)) {
        const inProgressFiles = fs.readdirSync(targetVideosDir)
          .filter(f => f.startsWith(path.basename(videoFileName)) && f.includes('.remotion-in-progress'))
          .map(f => path.join(targetVideosDir, f))
          .filter(fp => fs.existsSync(fp) && fs.statSync(fp).size > 1000000);
        if (inProgressFiles.length > 0) {
          const latestFile = inProgressFiles[0];
          console.log(`🔧 [REMOTION AUTO-RECOVERY] Khôi phục file video từ file in-progress: ${latestFile}`);
          try {
            fs.copyFileSync(latestFile, uniqueVideoPath);
            fs.unlinkSync(latestFile);
            return true;
          } catch(err) {
            console.warn(`⚠️ Không thể copy file in-progress: ${err.message}`);
          }
        }
      }
    } catch(e) {}
    return false;
  };

  const renderCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  
  // Tự động điều tiết CPU Priority của Chromium về BelowNormal trên Windows
  // để Node.js Dashboard và Web Server luôn mượt mà 100%, không bị giật lag
  let cpuThrottlerTimer = null;
  if (process.platform === 'win32') {
    cpuThrottlerTimer = setInterval(() => {
      try {
        const { exec } = require('child_process');
        exec(`powershell -NoProfile -Command "Get-Process | Where-Object { ($_.ProcessName -match 'chrome|chromium') -and $_.PriorityClass -ne 'BelowNormal' } | ForEach-Object { try { $_.PriorityClass = 'BelowNormal' } catch {} }"`, { windowsHide: true });
      } catch(e) {}
    }, 8000);
  }

  // CHIẾN LƯỢC TỰ PHỤC HỒI RENDER (Self-Healing Render Strategy):
  // Lần 1: Chạy chuẩn với concurrency linh hoạt theo cấu hình (mặc định 3 luồng tối ưu Ryzen 5)
  const configuredConcurrency = config.REMOTION_CONCURRENCY || 3;
  console.log(`Đang chạy: npx remotion render DynamicNews "${relativeVideoPath}" --concurrency=${configuredConcurrency}`);
  let renderProcess = spawnSync(`${renderCmd} remotion render DynamicNews "${relativeVideoPath}" --concurrency=${configuredConcurrency}`, {
    stdio: 'inherit',
    shell: true,
    windowsHide: true
  });

  let hasVideoFile = recoverInProgress();

  // Nếu Lần 1 gặp sự cố (RAM cao hoặc lỗi driver GPU), tự động kích hoạt Lần 2 với chế độ An Toàn (Concurrency 1)
  if (!hasVideoFile) {
    console.warn(`\n⚠️ [REMOTION AUTO-RECOVERY] Render lần 1 chưa có file (mã: ${renderProcess.status}). Đang tự động chuyển sang chế độ An Toàn (Concurrency 1)...`);
    
    // Tạm dừng 2s để giải phóng tài nguyên Chromium
    spawnSync(process.platform === 'win32' ? 'timeout /t 2 /nobreak' : 'sleep 2', { shell: true, stdio: 'ignore' });

    renderProcess = spawnSync(`${renderCmd} remotion render DynamicNews "${relativeVideoPath}" --concurrency=1`, {
      stdio: 'inherit',
      shell: true,
      windowsHide: true
    });

    hasVideoFile = recoverInProgress();
  }

  // Lần 3: Chế độ Software Rendering (Tắt GPU Acceleration để tránh lỗi driver AMD / DirectComposition 0x80004005)
  if (!hasVideoFile) {
    console.warn(`\n⚠️ [REMOTION AUTO-RECOVERY] Render lần 2 chưa có file. Đang thử Lần 3 với chế độ Software Rendering (Tắt GPU Acceleration)...`);
    spawnSync(process.platform === 'win32' ? 'timeout /t 2 /nobreak' : 'sleep 2', { shell: true, stdio: 'ignore' });

    renderProcess = spawnSync(`${renderCmd} remotion render DynamicNews "${relativeVideoPath}" --disable-hardware-acceleration --concurrency=1`, {
      stdio: 'inherit',
      shell: true,
      windowsHide: true
    });

    hasVideoFile = recoverInProgress();
  }

  // Kiểm tra file video độc lập được render
  if (cpuThrottlerTimer) {
    try { clearInterval(cpuThrottlerTimer); } catch(e) {}
  }

  if (!hasVideoFile) {
    if (renderProcess.error) throw renderProcess.error;
    throw new Error(`Remotion Render thất bại với mã lỗi ${renderProcess.status}!`);
  }

  // Tự động giải tỏa trạng thái lỗi trong data/last_error.json khi render thành công
  try {
    const errorFile = path.join(__dirname, 'data', 'last_error.json');
    if (fs.existsSync(errorFile)) {
      const errData = JSON.parse(fs.readFileSync(errorFile, 'utf-8'));
      if (errData.status === 'UNRESOLVED') {
        errData.status = 'RESOLVED';
        errData.resolvedAt = new Date().toISOString();
        fs.writeFileSync(errorFile, JSON.stringify(errData, null, 2), 'utf-8');
      }
    }
  } catch(e) {}

  // Tạo bản sao sang out/auto_news_result.mp4 để Web Dashboard luôn xem được ngay
  try {
    fs.copyFileSync(uniqueVideoPath, previewVideoPath);
  } catch(e) {}

  // Tự động sao lưu lên Google Drive (Ổ G:)
  try {
    const { archiveVideo } = require('./src/storage/drive_archiver.js');
    const cloudDest = archiveVideo(uniqueVideoPath);
    if (cloudDest) {
      console.log(`☁️ Đã tự động sao lưu lên Google Drive: ${cloudDest}`);
    }
  } catch(e) {}

  // Tự động xuất ảnh Thumbnail 9:16 tùy chỉnh cho YouTube Shorts nếu bật trong config
  const uniqueThumbPath = path.join(targetVideosDir, `thumb_${renderId}.jpg`);
  if (config.ENABLE_SHORTS_CUSTOM_THUMBNAIL !== false) {
    try {
      console.log(`\n🖼️ [Thumbnail Generator] Đang tạo Custom Shorts Thumbnail 9:16 (5:4 Safe Zone)...`);
      const thumbProps = {
        title: aiData.title || 'Bản Tin Nóng 24H',
        category: aiData.category || 'Thời Sự & Xã Hội',
        themeColor: aiData.themeColor || '#f59e0b',
        imageFile: (aiData.scenes && aiData.scenes[0] && aiData.scenes[0].imageFile) ? aiData.scenes[0].imageFile : undefined,
        tag: '🔴 ĐỘC QUYỀN',
        channelName: isEnglish ? 'CURIOUS GLOBE' : (targetChannelId === 'channel_tech' ? 'KAI VIET TECH' : 'AN NEWS 24/7'),
        language: isEnglish ? 'en' : 'vi'
      };
      const tempPropsPath = path.join(__dirname, 'temp_thumb_props.json');
      fs.writeFileSync(tempPropsPath, JSON.stringify(thumbProps), 'utf-8');

      const relativeThumbPath = path.relative(process.cwd(), uniqueThumbPath);
      const stillCmd = `${renderCmd} remotion still ShortsThumbnail "${relativeThumbPath}" --props="temp_thumb_props.json"`;
      spawnSync(stillCmd, { shell: true, windowsHide: true, stdio: 'inherit' });

      if (fs.existsSync(uniqueThumbPath) && fs.statSync(uniqueThumbPath).size > 1000) {
        console.log(`🖼️ [Thumbnail Generator] ✅ Đã tạo thành công Shorts Thumbnail: ${uniqueThumbPath}`);
      }
      try { fs.unlinkSync(tempPropsPath); } catch(e) {}
    } catch(err) {
      console.warn(`⚠️ [Thumbnail Generator] Không thể tạo thumbnail: ${err.message}`);
    }
  }

  console.log(`\n🎉 HOÀN TẤT PIPELINE TỰ ĐỘNG!`);
  console.log(`Video lưu riêng biệt tại: ${uniqueVideoPath}`);

  // V3 VIDEO QUALITY ASSURANCE & QUALITY MEMORY
  try {
    const { VideoQA } = require('./src/ai/agents/video_qa.js');
    const { QualityMemory } = require('./src/ai/agents/quality_memory.js');
    const videoQA = new VideoQA();
    const qaReport = videoQA.inspect({
      videoPath: uniqueVideoPath,
      renderPayload: finalRemotionJson,
      videoPlan: videoPlan
    });

    const memory = new QualityMemory();
    memory.saveRecord({
      videoId: renderId,
      channelId: targetChannelId,
      videoPlan,
      qaResult: qaReport,
      fixesApplied: []
    });
    console.log(`🛡️ [VideoQA] Báo cáo chất lượng: Điểm ${qaReport.score}/100 | Trạng thái: [${qaReport.status}]`);
  } catch (qaErr) {
    console.warn(`⚠️ [VideoQA] Bỏ qua kiểm định QA: ${qaErr.message}`);
  }

  const storyId = `ST-AUTO-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  const durationSec = Number((globalStart / 30).toFixed(1));

  // Ghi nhận video render vào database NGAY LẬP TỨC kèm Layout Tracking
  try {
    const db = require('./src/storage/db.js').getDb();
    const layoutVer = aiData.scenes && aiData.scenes.length >= 5 ? 'v2.0-narrative-5-7s' : 'v1.0-short-3s';
    const layoutTypeList = aiData.scenes ? aiData.scenes.map(s => s.layoutType || 'list') : ['list'];
    const layoutTypesJson = JSON.stringify(layoutTypeList);
    const sceneNum = aiData.scenes ? aiData.scenes.length : 0;

    db.prepare('INSERT OR IGNORE INTO events (eventId, canonicalTopic) VALUES (?, ?)')
      .run('EV-AUTO', 'Auto Pipeline News');
    db.prepare('INSERT OR IGNORE INTO stories (storyId, eventId) VALUES (?, ?)')
      .run(storyId, 'EV-AUTO');
    db.prepare('INSERT OR REPLACE INTO renders (renderId, storyId, storyVersion, renderProfile, videoPath, layoutVersion, layoutTypes, sceneCount, durationSeconds) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(renderId, storyId, 1, 'master', uniqueVideoPath, layoutVer, layoutTypesJson, sceneNum, durationSec);
  } catch(e) {
    console.error("Lỗi ghi nhận render vào database:", e.message);
  }

  console.log(`\n🌐 BƯỚC 5: ĐANG CHUẨN BỊ PUBLISH LÊN ĐA NỀN TẢNG (Multi-Platform)...`);
  try {
    const { Publisher } = require('./src/publishing/publisher.js');
    const publisher = new Publisher();

    let scheduledCount = 0;

    let ytTitle = (aiData.youtubeTitle || '').trim();
    if (!ytTitle) {
      const ytTitleSuffix = isEnglish ? ' #shorts #breakingnews' : ' #shorts #tintuc';
      ytTitle = `${aiData.title}${ytTitleSuffix}`;
    } else if (!ytTitle.toLowerCase().includes('#shorts')) {
      ytTitle = `${ytTitle} #shorts`;
    }
    // Giới hạn độ dài tiêu đề YouTube (tối đa 100 ký tự)
    if (ytTitle.length > 95) {
      ytTitle = ytTitle.substring(0, 90).trim() + '... #shorts';
    }

    const defaultHashtags = isEnglish
      ? '#shorts #breakingnews #tech #trending'
      : '#shorts #tintuc #thoisu #xuhuong';
    const hashtags = aiData.youtubeTags && Array.isArray(aiData.youtubeTags)
      ? aiData.youtubeTags.map(t => `#${t.replace(/^#/, '')}`).join(' ')
      : defaultHashtags;
    const ytCaption = (aiData.youtubeDescription || aiData.title) + '\n\n' + hashtags;

    const enableYouTube = config.ENABLE_YOUTUBE !== undefined ? config.ENABLE_YOUTUBE : true;
    const enableTikTok = config.ENABLE_TIKTOK !== undefined ? config.ENABLE_TIKTOK : false;
    const enableInstagram = config.ENABLE_INSTAGRAM !== undefined ? config.ENABLE_INSTAGRAM : false;
    const enableFacebook = config.ENABLE_FACEBOOK !== undefined ? config.ENABLE_FACEBOOK : false;

    const priorityScore = parseFloat(process.env.PIPELINE_SCORE) || 8.0;
    const extraPubMeta = {
      layoutVersion: 'v2.0-narrative-5-7s',
      sceneCount: finalScenes.length,
      durationSeconds: Math.round(durationSec * 10) / 10,
      priorityScore: priorityScore
    };

    let commonSlot = null;
    const hasYouTube = fs.existsSync(path.join(__dirname, 'tokens.json')) || fs.existsSync(path.join(__dirname, 'client_secret.json'));
    if (hasYouTube && enableYouTube) {
      console.log(`- Lên lịch đăng YouTube Shorts (${detectedLanguage === 'en' ? 'Giờ vàng US' : 'Giờ vàng VN'}) cho [${channelMeta.badge}]...`);
      const pubRes = publisher.createPublication(storyId, renderId, 'youtube', ytTitle, ytCaption, [], detectedLanguage, null, targetChannelId, extraPubMeta);
      if (pubRes && pubRes.scheduledAt) {
        commonSlot = pubRes.scheduledAt;
        const schedD = new Date(pubRes.scheduledAt);
        const schedStr = schedD.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ngày ' + schedD.toLocaleDateString('vi-VN');
        console.log(`  ⏰ ĐÃ HẸN GIỜ VÀNG: ${schedStr} (${detectedLanguage === 'en' ? 'Thị trường Mỹ/Quốc tế' : 'Thị trường Việt Nam'}) [${channelMeta.badge}]`);
      }
      scheduledCount++;
    }

    const isVietnamese = (detectedLanguage === 'vi' && targetChannelId !== 'channel_global');

    if (enableTikTok) {
      if (isVietnamese) {
        console.log(`- Lên lịch đăng TikTok (đồng bộ giờ vàng với video: ${commonSlot ? 'Cùng giờ' : 'Độc lập'})...`);
        publisher.createPublication(storyId, renderId, 'tiktok', ytTitle, ytCaption, [], detectedLanguage, commonSlot, targetChannelId, extraPubMeta);
        scheduledCount++;
      } else {
        console.log(`- Bỏ qua TikTok: Video tiếng Anh (${targetChannelId}) chỉ đăng riêng cho YouTube Kênh 3 (Curious Globe).`);
      }
    }

    if (config.IG_ACCOUNT_ID && config.META_ACCESS_TOKEN && enableInstagram) {
      if (isVietnamese) {
        console.log(`- Lên lịch đăng Instagram Reels...`);
        publisher.createPublication(storyId, renderId, 'instagram', ytTitle, ytCaption, [], detectedLanguage, commonSlot, targetChannelId, extraPubMeta);
        scheduledCount++;
      } else {
        console.log(`- Bỏ qua Instagram Reels: Video tiếng Anh chỉ đăng riêng cho YouTube Kênh 3.`);
      }
    }

    if (config.META_PAGE_ID && config.META_ACCESS_TOKEN && enableFacebook) {
      if (isVietnamese) {
        console.log(`- Lên lịch đăng Facebook Reels...`);
        publisher.createPublication(storyId, renderId, 'facebook', ytTitle, ytCaption, [], detectedLanguage, commonSlot, targetChannelId, extraPubMeta);
        scheduledCount++;
      } else {
        console.log(`- Bỏ qua Facebook Reels: Video tiếng Anh (${targetChannelId}) chỉ đăng riêng cho YouTube Kênh 3 (Curious Globe).`);
      }
    }

    if (scheduledCount === 0) {
      console.log(`\nℹ️ Không có nền tảng nào được cấu hình API. Bỏ qua lên lịch xuất bản.`);
    } else {
      const autoPublish = config.AUTO_PUBLISH === undefined ? false : config.AUTO_PUBLISH;
      if (autoPublish) {
        console.log(`\n⏰ [AUTO_PUBLISH=ON] Video đã được lưu vào hàng đợi Hẹn Giờ Vàng. Hệ thống sẽ tự động đăng lên YouTube đúng khung giờ này.`);
      } else {
        console.log(`\n⏸️ [AUTO_PUBLISH=OFF] CHỜ DUYỆT THỦ CÔNG: Video đã lưu và hẹn khung giờ vàng trong hàng đợi. Bạn có thể bấm "Duyệt & Đăng" trên Dashboard nếu muốn xuất bản ngay.`);
      }

      // Tự động tối ưu và sắp xếp lại toàn bộ khung giờ vàng trong ngày theo độ ưu tiên HOT
      try {
        publisher.compactSchedule(targetChannelId);
      } catch(e) {}
    }

    // Ghi nhận vào lịch sử để chống trùng lặp tin tức trên toàn hệ thống
    try {
      const { recordPublished } = require('./trend_bot.js');
      recordPublished(aiData.title, urlArg);
    } catch (e) {}
  } catch (err) {
    console.log(`⚠️ Lỗi hệ thống Publisher: ${err.message}.`);
    recordError('Publisher Phase', err);
  }

  // Tự động dọn dẹp các video cũ hơn 24 giờ trên máy (chạy ở cuối để không ảnh hưởng luồng chính)
  try {
    const { cleanupOldVideos } = require('./src/utils/cleanup.js');
    cleanupOldVideos(24);
  } catch(e) {}
}

main().catch(err => {
  console.error(err);
  recordError('Global Catch', err);
});