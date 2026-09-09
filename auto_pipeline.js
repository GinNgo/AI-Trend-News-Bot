const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cheerio = require('cheerio');
const http = require('http');
const https = require('https');

// Helper to get audio duration using ffprobe (which comes with Remotion's setup usually, or we can use a pure JS module)
// Actually we can use music-metadata or simply calculate from file if needed.
// A safe way without installing extra is to use edge-tts directly and read the generated file, but node doesn't have a built-in MP3 duration reader.
// Let's install 'music-metadata' via npm.
// Since we don't have it, let's write a python snippet to get durations to ensure accuracy, and call it via execSync.
// Wait, we can just use the previous python approach but embedded in Node.

// Load config
const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: config.GEMINI_MODEL });

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

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
      // Bọc giá trị rate và pitch trong nháy kép để tránh Windows CMD phân giải nhầm dấu %
      execSync(`edge-tts --voice ${voice} -f "${tempFile}" --write-media "${outputPath}" --rate="${rate}" --pitch="${pitch}"`, { stdio: 'pipe' });
      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 500) {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        return; // Success
      }
    } catch (e) {
      console.warn(`    ⚠️ Thử lại lần ${attempt}/3 do lỗi TTS: ${e.message.substring(0, 50)}...`);
      // Đợi 2s trước khi thử lại để tránh bị Microsoft block
      execSync('timeout /t 2 /nobreak >nul 2>&1 || ping -n 3 127.0.0.1 >nul');
    }
  }
  if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
  console.warn(`    ❌ Cảnh báo: Sinh âm thanh thất bại, tạo file âm thanh giả để tránh lỗi.`);
  // Tạo file trống (hoặc copy bgm) để Remotion không bị crash
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

  if (urlArg.startsWith("http")) {
    console.log(`\n🔍 BƯỚC 1: Đang cào dữ liệu từ link...`);
    console.log(`URL: ${urlArg}`);
    try {
      const html = await fetchUrl(urlArg);
      const $ = cheerio.load(html);

      // Xóa các script, style để lấy text thuần
      $('script, style, nav, footer, aside, header').remove();
      articleText = $('body').text().replace(/\s+/g, ' ').trim();

      if (articleText.length < 200) {
         console.warn("⚠️ Cảnh báo: Văn bản cào được rất ngắn (dưới 200 ký tự). Có thể website chặn Bot hoặc là trang động (React/Vue). AI sẽ cố gắng phân tích...");
      }

      if (articleText.length > 8000) articleText = articleText.substring(0, 8000); // Tăng giới hạn số từ cho Gemini 3.x
      console.log(`✅ Lấy thành công ${articleText.length} ký tự.`);
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

  // TỰ ĐỘNG PHÁT HIỆN LINK TRONG PROMPT & CÀO BỔ SUNG DỮ LIỆU
  const urlMatch = articleText.match(/https?:\/\/[^\s"'\)]+/);
  if (urlMatch && !urlArg.startsWith("http")) {
    const embeddedUrl = urlMatch[0];
    console.log(`\n🔗 Phát hiện đường link bài viết trong Prompt: ${embeddedUrl}`);
    console.log(`🌐 Đang tự động cào thêm nội dung chi tiết từ link để bổ sung kịch bản...`);
    try {
      const html = await fetchUrl(embeddedUrl);
      const $ = cheerio.load(html);
      $('script, style, nav, footer, aside, header').remove();
      let crawledText = $('body').text().replace(/\s+/g, ' ').trim();
      if (crawledText.length > 6000) crawledText = crawledText.substring(0, 6000);

      if (crawledText.length > 200) {
        console.log(`✅ Cào bổ sung thành công ${crawledText.length} ký tự từ link bài báo!`);
        articleText += `\n\n--- DỮ LIỆU CHI TIẾT TỰ ĐỘNG CÀO TỪ BÀI BÁO GỐC (${embeddedUrl}) ---\n${crawledText}`;
      } else {
        console.log(`⚠️ Link bài viết trả về ít dữ liệu hoặc chặn bot, tiếp tục dùng nội dung prompt gốc.`);
      }
    } catch (e) {
      console.log(`⚠️ Không thể cào từ link đính kèm: ${e.message}. Tiếp tục với prompt hiện tại.`);
    }
  }

  if (articleText.length > 9000) articleText = articleText.substring(0, 9000);

  console.log(`\n🧠 BƯỚC 2: AI đang phân tích & lên kịch bản JSON (co giãn N-Cảnh & Đa dạng Layout)...`);
  const prompt = `
Hãy đọc nội dung sau và tạo kịch bản video ngắn (Shorts) thời lượng 30 - 60 giây.
Tuỳ thuộc vào độ dài nội dung, hãy chia kịch bản thành 3 đến 8 cảnh (scenes).
Mỗi cảnh gồm 1 ý chính, đoạn thoại khoảng 10-15 giây đọc.

ĐẶC BIỆT: Để video không bị nhàm chán, hãy luân phiên sử dụng 3 kiểu Layout cho các cảnh:
1. "list": Cho các thông tin liệt kê các luận điểm (có keyTakeaways).
2. "stat": Dành cho cảnh có con số nổi bật, chỉ số tăng trưởng, tiền bạc, số lượng (yêu cầu điền thêm statNumber và statLabel).
3. "quote": Dành cho các phát biểu, trích dẫn của chuyên gia, chính phủ, người nổi tiếng (yêu cầu điền quoteText và quoteAuthor).

YÊU CẦU TRẢ VỀ DƯỚI DẠNG JSON HỢP LỆ (Không Markdown, KHÔNG BỌC \`\`\`json):
{
  "title": "Tiêu đề ngắn 3-5 từ cho video",
  "themeColor": "#38bdf8", // Trả về 1 mã màu HEX ngẫu nhiên nổi bật phù hợp với chủ đề video (Vd: #eab308, #22c55e, #ef4444, #a855f7)
  "bgStyle": "hud", // Trả về 1 kiểu background: "hud" (công nghệ), "particles" (hạt nổi), "grid" (lưới lưới) hoặc "minimal" (tối giản)
  "scenes": [
    {
      "tag": "THẺ PHÂN LOẠI (ví dụ: SỐ LIỆU KHỦNG, PHÁT BIỂU, ĐIỂM NHẤN)",
      "layoutType": "list" | "stat" | "quote",
      "headline": "Tiêu đề chính của cảnh",
      "keyTakeaways": ["Ý chính 1", "Ý chính 2"],
      "statNumber": "5.000.000+" (Nếu layoutType là stat),
      "statLabel": "Người dùng tiếp cận" (Nếu layoutType là stat),
      "quoteText": "Trích dẫn nguyên văn câu nói..." (Nếu layoutType là quote),
      "quoteAuthor": "Chuyên gia / Tên tác giả" (Nếu layoutType là quote),
      "voiceover": "Lời đọc (Đoạn thoại dài để đọc bằng AI, giọng tự nhiên, lôi cuốn, không viết tắt)."
    }
  ]
}

Nội dung:
${articleText}
  `;

  const fallbackModels = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-3-flash-preview",
    "gemini-2.5-flash"
  ];

  let jsonResult = "";
  let usedModel = "";

  for (const modelName of fallbackModels) {
    try {
      console.log(`  🔄 Đang thử kết nối model: ${modelName}...`);
      const currentModel = genAI.getGenerativeModel({ model: modelName });
      const result = await currentModel.generateContent(prompt);
      jsonResult = result.response.text();
      // Clean up markdown block if any
      jsonResult = jsonResult.replace(/```json/g, '').replace(/```/g, '').trim();
      usedModel = modelName;
      console.log(`  ✅ Thành công với model ${usedModel}!`);
      break; // Thoát vòng lặp khi thành công
    } catch (err) {
      console.log(`  ⚠️ Model ${modelName} thất bại: ${err.message}. Đang thử model tiếp theo...`);
    }
  }

  if (!jsonResult) {
    console.error("❌ Tất cả các model đều thất bại. Vui lòng kiểm tra lại API Key hoặc kết nối mạng.");
    process.exit(1);
  }

  let aiData;
  try {
    aiData = JSON.parse(jsonResult);
    console.log(`✅ AI đã chia thành ${aiData.scenes.length} cảnh.`);
  } catch (e) {
    console.error("❌ Lỗi parse JSON từ AI:", jsonResult);
    process.exit(1);
  }

  console.log(`\n🎙️ BƯỚC 3: Đang sinh Audio & Đồng bộ Khung hình (Edge-TTS)...`);
  const FPS = 30;
  const padding = 20; // 20 frames rest
  let globalStart = 0;

  const colors = ["#38bdf8", "#a855f7", "#eab308", "#22c55e", "#ef4444", "#ec4899", "#f97316"];

  const finalScenes = [];

  for (let i = 0; i < aiData.scenes.length; i++) {
    const s = aiData.scenes[i];
    const audioName = `dynamic_${i+1}.mp3`;
    const audioPath = path.join(__dirname, 'public', audioName);

    console.log(`  Đang sinh audio cảnh ${i+1}...`);
    const voiceText = s.voiceover || s.voiceoverScript || s.headline;
    generateAudioSafe(voiceText, audioPath, config.TTS_VOICE, config.TTS_RATE, config.TTS_PITCH);

    const durSec = getAudioDurationPython(audioPath);
    const frames = Math.round(durSec * FPS);

    const seqDur = frames + padding + (i < aiData.scenes.length - 1 ? 20 : 0);

    // Automatically space out takeaways
    const takeaways = s.keyTakeaways || [];
    const takeawayStarts = takeaways.map((_, idx) => 60 + idx * Math.floor(frames / (takeaways.length + 1)));

    finalScenes.push({
      id: i + 1,
      tag: s.tag,
      layoutType: s.layoutType || 'list',
      headline: s.headline,
      keyTakeaways: s.keyTakeaways || [],
      statNumber: s.statNumber,
      statLabel: s.statLabel,
      quoteText: s.quoteText,
      quoteAuthor: s.quoteAuthor,
      audioFile: audioName,
      audioFrames: frames,
      globalStart: globalStart,
      seqDuration: seqDur,
      color: colors[i % colors.length],
      takeawayStarts: takeawayStarts
    });

    globalStart += frames + padding;
  }

  // OUTRO
  console.log(`  Đang sinh audio Outro...`);
  const outroVoiceover = "Hãy nhấn Like và Đăng ký theo dõi kênh để không bỏ lỡ các thông tin số mới nhất hàng ngày. Xin chào và hẹn gặp lại!";
  const outroAudio = 'dynamic_outro.mp3';
  const outroPath = path.join(__dirname, 'public', outroAudio);
  generateAudioSafe(outroVoiceover, outroPath, config.TTS_VOICE, config.TTS_RATE, config.TTS_PITCH);

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
  const renderCmd = `C:/Users/PC/AppData/Roaming/nvm/v22.14.0/npx.cmd remotion render DynamicNews out/auto_news_result.mp4`;
  console.log(`Đang chạy: ${renderCmd}`);
  execSync(renderCmd, { stdio: 'inherit' });

  console.log(`\n🎉 HOÀN TẤT PIPELINE TỰ ĐỘNG!`);
  console.log(`Video của bạn đã sẵn sàng tại: out/auto_news_result.mp4`);
  console.log(`👉 BƯỚC TIẾP THEO: Gõ lệnh 'node upload_youtube.js' để tải video lên YouTube!`);
}

main().catch(console.error);
