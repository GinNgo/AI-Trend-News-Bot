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
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => reject(err));
    });
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
  let downloadedImages = [];

  const scrapeImages = async (html, baseUrl) => {
    try {
      const $ = cheerio.load(html);
      const images = [];
      
      // Bóc meta tags ưu tiên cao (og:image, twitter:image)
      const ogImage = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content');
      if (ogImage) images.push(ogImage);

      $('img').each((i, el) => {
        let src = $(el).attr('src') || $(el).attr('data-src');
        if (!src) return;
        if (src.includes('logo') || src.includes('icon') || src.includes('avatar') || src.includes('.svg') || src.includes('base64')) return;
        try {
          if (src.startsWith('//')) src = 'https:' + src;
          else if (src.startsWith('/')) src = new URL(baseUrl).origin + src;
          else if (!src.startsWith('http')) return;
          images.push(src);
        } catch(e) {}
      });

      const uniqueImages = [...new Set(images)].slice(0, 4);
      for (let i = 0; i < uniqueImages.length; i++) {
        const filename = `crawled_img_${i+1}.jpg`;
        const dest = path.join(__dirname, 'public', filename);
        console.log(`  📸 Đang tải ảnh thực tế ${i+1}: ${uniqueImages[i].substring(0, 60)}...`);
        try {
          await downloadImage(uniqueImages[i], dest);
          if (fs.existsSync(dest) && fs.statSync(dest).size > 2000) {
            downloadedImages.push(filename);
          }
        } catch(err) {}
      }
    } catch(e) {}
  };

  if (urlArg.startsWith("http")) {
    console.log(`\n🔍 BƯỚC 1: Đang cào dữ liệu từ link...`);
    console.log(`URL: ${urlArg}`);
    try {
      const html = await fetchUrl(urlArg);
      await scrapeImages(html, urlArg);
      const $ = cheerio.load(html);

      // Xóa các script, style để lấy text thuần
      $('script, style, nav, footer, aside, header').remove();
      articleText = $('body').text().replace(/\s+/g, ' ').trim();

      if (articleText.length < 200) {
        console.warn("⚠️ Cảnh báo: Văn bản cào được rất ngắn (dưới 200 ký tự). Có thể website chặn Bot hoặc là trang động (React/Vue). AI sẽ cố gắng phân tích...");
      }

      if (articleText.length > 9000) articleText = articleText.substring(0, 9000);
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

  // TỰ ĐỘNG PHÁT HIỆN LINK TRONG PROMPT & CÀO BỔ SUNG DỮ LIỆU
  const urlMatch = articleText.match(/https?:\/\/[^\s"'\)]+/);
  if (urlMatch && !urlArg.startsWith("http")) {
    const embeddedUrl = urlMatch[0];
    console.log(`\n🔗 Phát hiện đường link bài viết trong Prompt: ${embeddedUrl}`);
    console.log(`🌐 Đang tự động cào thêm nội dung chi tiết & hình ảnh từ link để bổ sung kịch bản...`);
    try {
      const html = await fetchUrl(embeddedUrl);
      await scrapeImages(html, embeddedUrl);
      const $ = cheerio.load(html);
      $('script, style, nav, footer, aside, header').remove();
      let crawledText = $('body').text().replace(/\s+/g, ' ').trim();
      if (crawledText.length > 8000) crawledText = crawledText.substring(0, 8000);

      if (crawledText.length > 200) {
        console.log(`✅ Cào bổ sung thành công ${crawledText.length} ký tự và ${downloadedImages.length} hình ảnh từ bài báo gốc!`);
        articleText += `\n\n--- DỮ LIỆU CHI TIẾT TỰ ĐỘNG CÀO TỪ BÀI BÁO GỐC (${embeddedUrl}) ---\n${crawledText}`;
      } else {
        console.log(`⚠️ Link bài viết trả về ít dữ liệu hoặc chặn bot, tiếp tục dùng nội dung prompt gốc.`);
      }
    } catch (e) {
      console.log(`⚠️ Không thể cào từ link đính kèm: ${e.message}. Tiếp tục với prompt hiện tại.`);
    }
  }

  if (articleText.length > 10000) articleText = articleText.substring(0, 10000);

  console.log(`\n🧠 BƯỚC 2: AI đang phân tích ĐIỀU TRA CHUYÊN SÂU & Lên kịch bản có dẫn chứng, số liệu xác thực...`);
  const prompt = `
Bạn là một Phóng viên Điều tra kiêm Biên tập viên Thời sự cao cấp.
Hãy đọc kỹ toàn bộ dữ liệu bài báo dưới đây và xây dựng một kịch bản Video Ngắn (Shorts) thời lượng 45 - 60 giây.

YÊU CẦU QUAN TRỌNG VỀ GIỌNG ĐIỆU (VOICEOVER TỰ THÍCH ỨNG):
1. Tự phân tích nội dung bài viết thuộc chủ đề gì để điều chỉnh phong cách lời thoại cho phù hợp nhất.
   - Nếu là tin Công nghệ / AI / Kỹ thuật: Giọng điệu hiện đại, truyền cảm hứng, dùng từ ngữ chuyên ngành chính xác, nhịp độ nhanh.
   - Nếu là tin Kinh tế / Tội phạm / Lừa đảo: Phong cách ĐIỀU TRA SỰ THẬT, CỰC KỲ XÁC THỰC, giọng đanh thép, cảnh báo, nhấn mạnh số liệu và dẫn chứng.
   - Nếu là tin Giải trí / Đời sống / Trend mạng xã hội: Giọng điệu gần gũi, giật gân, cuốn hút, hợp gu giới trẻ.
   
2. Mỗi phân cảnh (voiceover) phải đủ dài (ít nhất 40-60 chữ) để giải thích cặn kẽ vấn đề, không viết quá ngắn.

YÊU CẦU NỘI DUNG NGHIÊM NGẶT:
1. KHÔNG NÓI CHUNG CHUNG HOẶC NÓI QUA LOA. Phải chỉ rõ:
   - Cơ quan báo chí / đài truyền hình phanh phui là ai? (Ví dụ: CBC News, Bộ Công an, cơ quan quản lý...).
   - Thủ đoạn cụ thể là gì? (Cách thức dùng AI thế nào, số lượng trang ra sao, kéo traffic kiếm tiền adsense ra sao).
   - Dẫn chứng số liệu thực tế cụ thể: số trang web, lượt follow, số tiền trục lợi, thời gian, tên công ty/địa điểm nếu có.
   - Hệ lụy và phản ứng của các bên liên quan (Meta, chính phủ, cộng đồng quốc tế).
2. Tùy theo độ dài và chi tiết của thông tin, hãy chia kịch bản thành từ 4 đến 7 CẢNH (scenes) mạch lạc, logic.
3. Luân phiên sử dụng 4 kiểu Layout:
   - "list": Trình bày các luận điểm phân tích, các bước thủ đoạn (keyTakeaways).
   - "stat": Nổi bật con số chứng cứ lớn (statNumber, statLabel).
   - "quote": Trích dẫn nguyên văn phát biểu đanh thép của chuyên gia, báo đài, nạn nhân (quoteText, quoteAuthor).
   - "image": Dành cho cảnh cần đối chiếu tài liệu, hình ảnh hiện trường, bằng chứng điều tra.

${downloadedImages.length > 0 ? `LƯU Ý VỀ ẢNH: Hệ thống đã tải về các ảnh thực chứng: ${downloadedImages.join(', ')}. Hãy gán các ảnh này vào trường "imageFile" của các cảnh phù hợp (đặc biệt là layoutType 'image').` : ''}

YÊU CẦU TRẢ VỀ DƯỚI DẠNG JSON HỢP LỆ (Không Markdown, KHÔNG BỌC \`\`\`json):
{
  "title": "Tiêu đề ngắn 3-5 từ cho video",
  "themeColor": "#ef4444", // Chọn 1 mã HEX phù hợp (tin nóng/điều tra nên dùng đỏ #ef4444, cam #f97316 hoặc xanh dương #06b6d4)
  "bgStyle": "grid", // "grid" hoặc "hud" hoặc "particles"
  "scenes": [
    {
      "tag": "THẺ PHÂN LOẠI (vd: ĐIỀU TRA ĐỘC QUYỀN, THỦ ĐOẠN, SỐ LIỆU BẰNG CHỨNG, PHẢN ỨNG)",
      "layoutType": "list" | "stat" | "quote" | "image",
      "imageFile": "${downloadedImages[0] || ''}", // Nếu có layoutType là image
      "headline": "Tiêu đề cô đọng, giật mình của cảnh",
      "keyTakeaways": ["Luận điểm chứng cứ 1", "Luận điểm chứng cứ 2"],
      "statNumber": "55 Triệu" (Nếu layoutType là stat),
      "statLabel": "Lượt theo dõi bị thao túng" (Nếu layoutType là stat),
      "quoteText": "Trích dẫn nguyên văn bằng chứng..." (Nếu layoutType là quote),
      "quoteAuthor": "Đại diện CBC News / Chuyên gia bảo mật" (Nếu layoutType là quote),
      "voiceover": "Đoạn thoại dài 15-25 giây đọc bằng AI, giọng đanh thép, chuyên nghiệp, dẫn chứng cụ thể, không giật gân rẻ tiền."
    }
  ]
}

Dữ liệu đầu vào:
${articleText}
  `;

  const fallbackModels = [
    config.GEMINI_MODEL,
    "gemini-3.7-flash",
    "gemini-3.6-flash",
    "gemini-3.8-flash",
    "gemini-3.5-flash"
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
      imageFile: (() => {
        const img = s.imageFile || (downloadedImages.length > 0 ? downloadedImages[i % downloadedImages.length] : undefined);
        return (img && require('fs').existsSync(require('path').join(__dirname, 'public', img))) ? img : undefined;
      })(),
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
  const renderCmd = `npx remotion render DynamicNews out/auto_news_result.mp4`;
  console.log(`Đang chạy: ${renderCmd}`);
  execSync(renderCmd, { stdio: 'inherit' });

  console.log(`\n🎉 HOÀN TẤT PIPELINE TỰ ĐỘNG!`);
  console.log(`Video của bạn đã sẵn sàng tại: out/auto_news_result.mp4`);
  console.log(`👉 BƯỚC TIẾP THEO: Gõ lệnh 'node upload_youtube.js' để tải video lên YouTube!`);
}

main().catch(console.error);
