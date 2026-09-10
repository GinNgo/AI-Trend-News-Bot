const { recordError } = require('./src/utils/error_recorder.js');
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const { scrapeArticleDeep } = require('./src/scraper/browser.js');
const { extractFacts, generateScript } = require('./src/ai/agents.js');

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
    const output = execSync(`python -c "${pyCode}" "${filePath}"`).toString().trim();
    const dur = parseFloat(output);
    return isNaN(dur) || dur <= 0 ? 10 : dur;
  } catch (e) {
    console.error("Lỗi khi đọc duration audio:", e.message);
    return 10; // Fallback 10s
  }
}

function generateAudioSafe(text, outputPath, voice, rate, pitch) {
  const tempFile = path.join(__dirname, 'temp_tts.txt');

  // Xử lý text để tránh rỗng hoặc các ký tự đặc biệt gây lỗi
  let safeText = text || "Nội dung đang được cập nhật.";
  safeText = safeText.replace(/[%&*#]/g, ' ').trim();
  if (safeText.length === 0) safeText = "Không có nội dung.";

  // Write text to a temp file
  fs.writeFileSync(tempFile, safeText, 'utf-8');

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      execSync(`edge-tts --voice ${voice} -f "${tempFile}" --write-media "${outputPath}" --rate="${rate}" --pitch="${pitch}"`, { stdio: 'pipe' });
      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 500) {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        return; // Success
      }
    } catch (e) {
      console.warn(`    ⚠️ Thử lại lần ${attempt}/3 do lỗi TTS: ${e.message.substring(0, 50)}...`);
      execSync('timeout /t 2 /nobreak >nul 2>&1 || ping -n 3 127.0.0.1 >nul');
    }
  }
  if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  console.warn(`    ❌ Cảnh báo: Sinh âm thanh thất bại, tạo file âm thanh giả để tránh lỗi.`);
  const bgmPath = path.join(__dirname, 'public', 'bgm.mp3');
  if (fs.existsSync(bgmPath)) {
    fs.copyFileSync(bgmPath, outputPath);
  } else {
    fs.writeFileSync(outputPath, "dummy audio");
  }
}

async function main() {
  const urlArg = process.argv[2];
  if (!urlArg) {
    console.error("❌ Vui lòng cung cấp link bài báo hoặc nội dung/prompt! Vd: node auto_pipeline.js <URL_HOAC_TEXT>");
    process.exit(1);
  }

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

  let facts;
  try {
    facts = await extractFacts(genAI, articleText, config.LANGUAGE || 'vi');
    console.log(`  ✅ Bóc tách sự kiện thành công!`);
    console.log(`  📎 Tóm tắt: ${facts.summary}`);
  } catch (err) {
    console.error("❌ AI không thể trích xuất sự kiện:", err.message);
    process.exit(1);
  }

  let aiData;
  try {
    aiData = await generateScript(genAI, facts, downloadedImages, config.LANGUAGE || 'vi');
    console.log(`  ✅ AI đã viết kịch bản gồm ${aiData.scenes.length} cảnh.`);
  } catch (err) {
    console.error("❌ AI không thể tạo kịch bản:", err.message);
    process.exit(1);
  }

  console.log(`\n🎙️ BƯỚC 3: Đang sinh Audio & Đồng bộ Khung hình (Edge-TTS)...`);
  const isEnglish = (config.LANGUAGE === 'en');
  const FPS = 30;
  const padding = 20; // 20 frames rest
  let globalStart = 0;
  const colors = ["#38bdf8", "#a855f7", "#eab308", "#22c55e", "#ef4444", "#ec4899", "#f97316"];
  const finalScenes = [];

  for (let i = 0; i < aiData.scenes.length; i++) {
    const s = aiData.scenes[i];
    const audioName = `dynamic_${i+1}.mp3`;
    const audioPath = path.join(publicDir, audioName);

    console.log(`  Đang sinh audio cảnh ${i+1}...`);
    const voiceText = s.voiceover || s.voiceoverScript || s.headline;
    generateAudioSafe(voiceText, audioPath, isEnglish ? 'en-US-ChristopherNeural' : config.TTS_VOICE, config.TTS_RATE, config.TTS_PITCH);

    const durSec = getAudioDurationPython(audioPath);
    const frames = Math.round(durSec * FPS);
    const seqDur = frames + padding + (i < aiData.scenes.length - 1 ? 20 : 0);
    const takeaways = s.keyTakeaways || [];
    const takeawayStarts = takeaways.map((_, idx) => 60 + idx * Math.floor(frames / (takeaways.length + 1)));

    let assignedImage = s.imageFile;
    if ((!assignedImage || !fs.existsSync(path.join(publicDir, assignedImage))) && downloadedImages.length > 0) {
      assignedImage = downloadedImages[i % downloadedImages.length];
    }

    finalScenes.push({
      id: i + 1,
      tag: s.tag,
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
      takeawayStarts: takeawayStarts
    });

    globalStart += frames + padding;
  }

  console.log(`  Đang sinh audio Outro...`);
  const outroVoiceover = isEnglish
    ? "Hit the Like button and Subscribe to our channel so you never miss out on the latest breaking updates. See you next time!"
    : "Hãy nhấn Like và Đăng ký theo dõi kênh để không bỏ lỡ các thông tin nóng nhất hàng ngày. Xin chào và hẹn gặp lại!";
  const outroAudio = 'dynamic_outro.mp3';
  const outroPath = path.join(publicDir, outroAudio);
  generateAudioSafe(outroVoiceover, outroPath, isEnglish ? 'en-US-ChristopherNeural' : config.TTS_VOICE, config.TTS_RATE, config.TTS_PITCH);

  const outroDur = getAudioDurationPython(outroPath);
  const outroFrames = Math.round(outroDur * FPS);
  const outroSeqDur = outroFrames + padding;

  const finalOutro = {
    title: aiData.title,
    subtitle: "Cập nhật tin tức nhanh và chính xác nhất",
    audioFile: outroAudio,
    audioFrames: outroFrames,
    globalStart: globalStart,
    seqDuration: outroSeqDur
  };

  globalStart += outroFrames + padding;

  const finalRemotionJson = {
    language: config.LANGUAGE || 'vi',
    title: aiData.title,
    themeColor: aiData.themeColor,
    bgStyle: aiData.bgStyle,
    totalDurationInFrames: globalStart,
    scenes: finalScenes,
    outro: finalOutro
  };

  fs.writeFileSync(path.join(__dirname, 'src', 'dynamic_news.json'), JSON.stringify(finalRemotionJson, null, 2));
  console.log(`✅ Đồng bộ Frame hoàn tất. Tổng thời lượng: ${globalStart} frames (~${Math.round(globalStart/FPS)}s)`);

  console.log(`\n🎬 BƯỚC 4: Đang Render Video hoàn chỉnh (Remotion)...`);
  console.log(`Đang chạy: npx remotion render DynamicNews out/auto_news_result.mp4`);

  // Xóa video cũ trước khi render để tránh lấp liếm
  const videoOutputPath = path.join(__dirname, 'out', 'auto_news_result.mp4');
  if (fs.existsSync(videoOutputPath)) {
    fs.unlinkSync(videoOutputPath);
  }

  const renderProcess = spawnSync('npx', ['remotion', 'render', 'DynamicNews', 'out/auto_news_result.mp4'], { stdio: 'inherit', shell: true });
  if (renderProcess.status !== 0) {
    throw new Error(`Remotion Render thất bại với mã lỗi ${renderProcess.status}!`);
  }

  console.log(`\n🎉 HOÀN TẤT PIPELINE TỰ ĐỘNG!`);
  console.log(`Video của bạn đã sẵn sàng tại: out/auto_news_result.mp4`);

  console.log(`\n🌐 BƯỚC 5: ĐANG CHUẨN BỊ PUBLISH LÊN ĐA NỀN TẢNG (Multi-Platform)...`);
  try {
    const { Publisher } = require('./src/publishing/publisher.js');
    const publisher = new Publisher();

    const storyId = `ST-AUTO-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const renderId = `RN-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // Ghi nhận video render vào database trước khi tạo publication
    const db = require('./src/storage/db.js').getDb();
    db.prepare('INSERT OR IGNORE INTO events (eventId, canonicalTopic) VALUES (?, ?)')
      .run('EV-AUTO', 'Auto Pipeline News');
    db.prepare('INSERT OR IGNORE INTO stories (storyId, eventId) VALUES (?, ?)')
      .run(storyId, 'EV-AUTO');
    db.prepare('INSERT OR REPLACE INTO renders (renderId, storyId, storyVersion, renderProfile, videoPath) VALUES (?, ?, ?, ?, ?)')
      .run(renderId, storyId, 1, 'master', path.join(__dirname, 'out', 'auto_news_result.mp4'));

    let scheduledCount = 0;

    const ytTitle = aiData.youtubeTitle || `${aiData.title} | Tin Tức Mới Nhất #shorts`;
    const hashtags = aiData.youtubeTags && Array.isArray(aiData.youtubeTags)
      ? aiData.youtubeTags.map(t => `#${t.replace(/^#/, '')}`).join(' ')
      : '#shorts #tintuc #thoisu #xuhuong';
    const ytCaption = (aiData.youtubeDescription || aiData.title) + '\n\n' + hashtags;

    const hasYouTube = fs.existsSync(path.join(__dirname, 'tokens.json')) || fs.existsSync(path.join(__dirname, 'client_secret.json'));
    if (hasYouTube) {
      console.log(`- Lên lịch đăng YouTube Shorts...`);
      publisher.createPublication(storyId, renderId, 'youtube', ytTitle, ytCaption);
      scheduledCount++;
    }

    if (config.TIKTOK_CLIENT_KEY && config.TIKTOK_CLIENT_SECRET) {
      console.log(`- Lên lịch đăng TikTok...`);
      publisher.createPublication(storyId, renderId, 'tiktok', ytTitle, ytCaption);
      scheduledCount++;
    }

    if (config.IG_ACCOUNT_ID && config.META_ACCESS_TOKEN) {
      console.log(`- Lên lịch đăng Instagram Reels...`);
      publisher.createPublication(storyId, renderId, 'instagram', ytTitle, ytCaption);
      scheduledCount++;
    }

    if (config.META_PAGE_ID && config.META_ACCESS_TOKEN) {
      console.log(`- Lên lịch đăng Facebook Reels...`);
      publisher.createPublication(storyId, renderId, 'facebook', ytTitle, ytCaption);
      scheduledCount++;
    }

    if (scheduledCount === 0) {
      console.log(`\nℹ️ Không có nền tảng nào được cấu hình API. Bỏ qua lên lịch xuất bản.`);
    } else {
      // Kích hoạt push queue
      const autoPublish = config.AUTO_PUBLISH === undefined ? false : config.AUTO_PUBLISH;
      if (autoPublish) {
        console.log(`\n🚀 [AUTO_PUBLISH=ON] TIẾN HÀNH PUBLISH TỰ ĐỘNG ĐA NỀN TẢNG NGAY LẬP TỨC...`);
        await publisher.processQueue();
        console.log(`\n✅ QUÁ TRÌNH PHÂN PHỐI ĐÃ HOÀN TẤT (Xem chi tiết trên log SQLite Publisher)`);
      } else {
        console.log(`\n⏸️ [AUTO_PUBLISH=OFF] CHỜ DUYỆT BẰNG TAY: Video đã được đưa vào Queue. Vui lòng bấm "Duyệt & Đăng" trên Dashboard.`);
      }
    }
  } catch (err) {
    console.log(`⚠️ Lỗi hệ thống Publisher: ${err.message}.`);
    recordError('Publisher Phase', err);
  }
}

main().catch(err => {
  console.error(err);
  recordError('Global Catch', err);
});