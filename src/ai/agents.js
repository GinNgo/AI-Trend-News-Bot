const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getModelsForTask, blockModel, getModelBlockTimeRemaining } = require('./model_router');

async function callGemini(genAI, prompt, isJson = false, logFn = console.log, taskType = 'DEFAULT') {
  const fallbackModels = getModelsForTask(taskType, process.env.GEMINI_MODEL);

  let resultText = "";
  let success = false;

  for (const modelName of fallbackModels) {
    // Double check blacklist before trying
    const blockTime = getModelBlockTimeRemaining(modelName);
    if (blockTime > 0) {
      logFn(`  ⏭️ Model ${modelName} đang bị chặn tạm thời, tự động bỏ qua...`);
      continue;
    }

    try {
      logFn(`  🔄 Đang thử kết nối model: ${modelName}...`);
      const model = genAI.getGenerativeModel({ model: modelName });

      const generationConfig = isJson ? { responseMimeType: "application/json" } : {};

      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig
      });

      resultText = result.response.text();

      if (isJson) {
        resultText = resultText.replace(/```json/g, '').replace(/```/g, '').trim();
      }

      logFn(`  ✅ Thành công với model ${modelName}!`);
      success = true;
      break;
    } catch (err) {
      logFn(`  ⚠️ Model ${modelName} thất bại: ${err.message}.`);
      if (err.message.includes("429") || err.message.includes("Quota") || err.message.includes("retry in")) {
        let waitSecs = 60; // default blacklist time
        const match = err.message.match(/retry in ([0-9.]+)s/i) || err.message.match(/retryDelay":"([0-9]+)s"/i);
        if (match) {
          waitSecs = Math.ceil(parseFloat(match[1])) + 1; // +1s buffer
        }

        logFn(`  🚫 Đưa ${modelName} vào danh sách cấm (Blacklist) trong ${waitSecs}s. Sẽ chuyển ngay sang model khác!`);
        blockModel(modelName, waitSecs);
        // Không gọi delay nữa, trực tiếp nhảy vòng lặp sang model khác
      } else if (err.message.includes("503")) {
        logFn(`  ⏳ Quá tải server (503). Đang chờ 3s trước khi thử model tiếp theo...`);
        await new Promise(r => setTimeout(r, 3000));
      } else {
        logFn(`  ⏭️ Đang thử model tiếp theo...`);
      }
    }
  }

  if (!success) {
    throw new Error("❌ Tất cả các model đều thất bại. Vui lòng kiểm tra lại API Key hoặc mạng.");
  }

  return resultText;
}

/**
 * Stage 1: Extract and structure facts from the raw article text.
 */
async function extractFacts(genAI, rawText, language = 'vi', logFn = console.log) {
  logFn(`\n🧠 BƯỚC 2A: AI đang phân tích ĐIỀU TRA CHUYÊN SÂU & Bóc tách sự kiện...`);
  const prompt = `
Bạn là một Phóng viên Điều tra.

${language === 'en' ? "CRITICAL: YOU MUST TRANSLATE AND WRITE THE OUTPUT COMPLETELY IN ENGLISH! All text, summaries, and facts must be in English." : "BẮT BUỘC: VIẾT HOÀN TOÀN BẰNG TIẾNG VIỆT."}

. Dưới đây là nội dung văn bản thô cào được từ một bài báo.
Nhiệm vụ của bạn là bóc tách các sự kiện, số liệu, dẫn chứng thực tế một cách khách quan, chính xác nhất. KHÔNG BỊA ĐẶT SỐ LIỆU. Nếu không có số liệu, hãy nói rõ là không có.

YÊU CẦU TRẢ VỀ JSON:
{
  "summary": "Tóm tắt ngắn gọn vụ việc/sự kiện (3-4 câu).",
  "category": "Kinh tế / Công nghệ / Tội phạm / Đời sống / Giải trí",
  "keyFacts": ["Fact 1 có số liệu", "Fact 2 có nhân vật", "Fact 3 có địa điểm/cơ quan"],
  "quotes": [{"author": "Tên người", "text": "Câu trích dẫn ngắn"}],
  "impact": "Hệ lụy hoặc ảnh hưởng của sự kiện này."
}

NỘI DUNG BÀI BÁO:
${rawText.length > 15000 ? rawText.substring(0, 15000) : rawText}
  `;

  const jsonStr = await callGemini(genAI, prompt, true, logFn, 'EXTRACT');
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    logFn(`  ❌ Lỗi parse JSON ở Bước 2A: ${jsonStr}`);
    throw e;
  }
}

/**
 * Stage 2: Generate the video script based on the extracted facts.
 */
async function generateScript(genAI, facts, images = [], language = 'vi', logFn = console.log) {
  logFn(`\n🧠 BƯỚC 2B: AI đang lên kịch bản Video dựa trên Facts đã được kiểm chứng...`);
  const numFacts = (facts.keyFacts && Array.isArray(facts.keyFacts)) ? facts.keyFacts.length : 0;
  const numQuotes = (facts.quotes && Array.isArray(facts.quotes)) ? facts.quotes.length : 0;
  // Cấu hình số cảnh chuẩn vàng để tối đa hóa Watch Time và Giữ Chân Người Xem (45 - 60 giây): 5 đến 7 cảnh
  const targetScenes = Math.max(5, Math.min(7, numFacts + numQuotes + 2));
  const isEnglish = (language === 'en');
  const prompt = isEnglish ? `
CRITICAL: YOU MUST WRITE THE VIDEO SCRIPT ENTIRELY IN NATURAL, HIGH-ENERGY AMERICAN ENGLISH!
Target audience: Global / United States YouTube Shorts & TikTok audience.
Follow the proven viral storytelling formula (The 4-Part Narrative Arc from top YouTube faceless channels):

FACTS TO ADAPT:
- Summary: ${facts.summary}
- Category: ${facts.category}
- Key Facts: ${facts.keyFacts.join('; ')}
- Quotes: ${facts.quotes.map(q => `"${q.text}" - ${q.author}`).join(' | ')}
- Impact: ${facts.impact}

STRUCTURE (EXACTLY ${targetScenes} SCENES | 45-55 SECONDS):
1. SCENE 1 (THE 3-SECOND RETENTION HOOK - 0-3s | 14-20 words):
   - STRICTLY BANNED REPETITIVE AI CLICHÉS (Scripts using these will be immediately rejected):
     ❌ "The real reason behind..."
     ❌ "A secret breakthrough just changed..."
     ❌ "Stop believing [common myth]..."
     ❌ "The exact moment the entire operation imploded..."
     ❌ "Did you know that..." / "Few people know that..."
     ❌ Greetings ("Hey guys", "Welcome"), dates, slow build-ups, or channel intros.
   - MANDATORY ENTITY-FIRST STORYTELLING: Jump straight into the heart of the specific story using concrete names, entities, or shocking paradoxes unique to this article!
     * Example Tech: "Samsung and SK Hynix just launched an unprecedented fast-track program, handing college students six-figure salaries before they even graduate!"
     * Example Economy: "Why are major airlines reporting record-breaking profits while summer airfares just skyrocketed to an all-time high?"
     * Example Science: "NASA's James Webb telescope just detected an anomalous massive signal from deep space that shatters our current laws of physics!"
     * Example Alert: "A massive multi-vehicle collision just shut down the entire highway as emergency responders race against the clock!"
2. SCENE 2 (THE HIGH-STAKES CONTEXT - 3-12s | 22-28 words):
   - Paint the scene with urgent, concrete details (who, what, high stakes, dollars or consequences).
3. SCENES 3 to ${targetScenes - 1} (RELENTLESS PACING BREAKDOWN | 20-26 words each):
   - Relentless forward momentum. Every 2 seconds must deliver a new visual/factual beat.
   - Punchy American English, conversational newsroom style (e.g., "Here is where it gets crazy...", "And that was just the beginning.").
   - Short sentences only. Avoid passive voice.
4. FINAL SCENE (THE SEAMLESS RETENTION LOOP | 18-24 words):
   - Deliver the ultimate revelation.
   - CRITICAL RETENTION REQUIREMENT (THE ENDLESS LOOP): The very last sentence MUST seamlessly bridge and connect grammatically/logically back into the opening hook sentence of Scene 1!
     Example: If Scene 1 begins with "Samsung and SK Hynix just launched an unprecedented...", then Scene Final must end with "...And the intense race to capture top talent began with the moment when..." so the viewer rewatches Scene 1 without noticing!
   - BANNED: Never say "Thanks for watching", "Like and subscribe", or "See you next time". Those are exit signs!

RULES FOR TAGS & LAYOUTS (SPEC-05):
- Scene tags MUST be bold punchy uppercase headlines: "THE DISCOVERY", "MIND-BLOWING", "HARD EVIDENCE", "THE ANOMALY", "THE TWIST", "UNEXPLAINED", "THE VERDICT".
- Alternate layouts dynamically: "stat" (for numerical data/records), "quote" (for scientist/expert statements), "list" (for points/key arguments), "image" (for visual evidence).
${images.length > 0 ? `- AVAILABLE IMAGES: ${images.join(', ')}. Assign an image ONLY to Scene 1 (Hook) or Scene 2/3 (Evidence). DO NOT duplicate the same image across all scenes.` : ''}

VIRAL YOUTUBE SHORTS TITLE (youtubeTitle):
- 55 to 80 characters, high curiosity gap, dramatic capitalization of 1-2 keywords, emoji, ends with #shorts.
- Example: "Archaeologists Shocked By Ancient Weapon Made of ALIEN Metal! 🌌 #shorts"

JSON FORMAT:
{
  "title": "Short punchy 3-5 word title",
  "youtubeTitle": "Viral curiosity gap title with emoji ending in #shorts",
  "youtubeTags": ["shorts", "science", "mystery", "discovery", "history", "curiosity"],
  "themeColor": "#00f2fe",
  "bgStyle": "grid",
  "voicePreset": "NEWS_ANCHOR" | "MYSTERY" | "BREAKING_ALERT" | "TECH_HYPE" | "FINANCE_EXPERT" | "STORYTELLING" | "SATIRICAL_MEME" | "CINEMATIC_DOC",
  "scenes": [
    {
      "tag": "THE DISCOVERY",
      "speaker": "anchor" | "reporter",
      "layoutType": "image" | "list" | "stat" | "quote",
      "imageFile": "${images[0] || ''}",
      "headline": "Punchy scene headline under 7 words",
      "keyTakeaways": ["Point 1", "Point 2"],
      "statNumber": "3,000 YRS",
      "statLabel": "Ancient Origin",
      "quoteText": "Direct quote if applicable...",
      "quoteAuthor": "Lead Scientist",
      "voiceover": "Fast, captivating English voiceover between 18-26 words..."
    }
  ]
}
` : `
BẮT BUỘC: VIẾT HOÀN TOÀN BẰNG TIẾNG VIỆT.

Dựa vào DỮ LIỆU ĐÃ ĐƯỢC KIỂM CHỨNG dưới đây, hãy xây dựng kịch bản Video Ngắn (YouTube Shorts / TikTok / Reels) thời lượng chuẩn VÀNG ĂN ĐỀ XUẤT: 45 - 55 GIÂY theo công thức Viral Retention 2026: Hook giật gân, Nhịp độ dồn dập (Relentless Pacing) và Vòng lặp Vô tận (The Endless Loop).

DỮ LIỆU KIỂM CHỨNG (FACTS):
- Tóm tắt: ${facts.summary}
- Thể loại: ${facts.category}
- Sự kiện chính: ${facts.keyFacts.join('; ')}
- Trích dẫn: ${facts.quotes.map(q => `"${q.text}" - ${q.author}`).join(' | ')}
- Ảnh hưởng: ${facts.impact}

QUY TẮC BẮT BUỘC VỀ KỊCH BẢN (${targetScenes} CẢNH | 45 - 55 GIÂY):
1. CẢNH 1 (HOOK 3 GIÂY ĐẦU - QUYẾT ĐỊNH GIỮ CHÂN):
   - TUYỆT ĐỐI CẤM CÁC MẪU CÂU KHUÔN MẪU SÁO RỖNG SAU (Nếu vi phạm kịch bản sẽ bị loại bỏ ngay):
     ❌ "Lý do thực sự đằng sau..."
     ❌ "Một biến cố chưa từng có tiền lệ..."
     ❌ "Hầu hết mọi người đều tưởng..."
     ❌ "Khoảnh khắc mà toàn bộ sụp đổ..."
     ❌ "Bạn có biết rằng..." / "Ít ai biết rằng..."
     ❌ Lời chào ("Xin chào"), ngày tháng, hay phần giới thiệu dông dài.
   - BẮT BUỘC MỞ ĐẦU BẰNG "THỰC THỂ CỤ THỂ + SỰ KIỆN / CON SỐ GÂY SỐC" CỦA BÀI BÁO (Độc bản 100%, tự nhiên, bắt tai):
     * Cực kỳ tự nhiên, giàu năng lượng, đi thẳng vào tâm bão câu chuyện.
     * Ví dụ Công nghệ/Samsung: "Sinh viên ngành này tại Hàn Quốc vừa nhận được một đặc quyền gây sốt: chưa tốt nghiệp đã cầm chắc suất vào Samsung với mức lương hàng tỷ đồng!"
     * Ví dụ Kinh tế/Vé máy bay: "Tại sao các hãng hàng không liên tục báo lãi kỷ lục, nhưng giá vé máy bay hè năm nay lại đắt đỏ đến mức người dân phải quay xe?"
     * Ví dụ Điện thoại/iPhone: "Nếu đang định đổi điện thoại thì đây là tin cực sốc: một mẫu iPhone từng bán rất chạy vừa bất ngờ giảm giá chạm đáy chỉ còn hơn 13 triệu!"
     * Ví dụ Thời sự/Tai nạn: "Toàn bộ đoạn cao tốc đang bị phong tỏa nghiêm ngặt sau một vụ va chạm liên hoàn giữa 5 phương tiện vào rạng sáng nay!"
     * Ví dụ Khoa học/Vũ trụ: "Kính viễn vọng James Webb vừa bắt được một tín hiệu bí ẩn từ khoảng không sâu thẳm, thách thức toàn bộ định luật vật lý hiện đại!"
2. CÁC CẢNH TIẾP THEO (NHỊP ĐỘ DỒN DẬP - RELENTLESS PACING | 20 - 28 TỪ/CẢNH):
   - Cảnh 2: Bối cảnh & nguồn cơn câu chuyện.
   - Cảnh 3: Tình tiết cao trào hoặc chứng cứ mấu chốt.
   - Cảnh 4: Số liệu giật mình hoặc trích dẫn đắt giá từ cơ quan/người trong cuộc.
   - Cảnh 5-6: Hệ quả chấn động hoặc cú quay xe bất ngờ.
   - Mỗi câu thoại ngắn gọn, dùng động từ mạnh, không dùng từ đệm sáo rỗng.
3. CẢNH CUỐI CÙNG (CẦU NỐI VÒNG LẶP VÔ TẬN - THE ENDLESS LOOP):
   - Đưa ra kết luận đắt giá và câu hỏi kích thích tranh luận trong comment.
   - QUY TẮC RETENTION VÀNG: Câu thoại cuối cùng BẮT BUỘC phải là một vế câu lửng hoặc liên từ nối khớp 100% về câu Hook đầu tiên của Cảnh 1!
     (Ví dụ: Cảnh cuối kết bằng "...Và cuộc chạy đua săn lùng nhân tài này chỉ bắt đầu khi..." -> video tự động loop lại Cảnh 1 "Sinh viên ngành này tại Hàn Quốc vừa nhận được...").
   - TUYỆT ĐỐI CẤM: Cảm ơn, chào tạm biệt, hẹn gặp lại, xin like/sub. Đây là các "Exit Signs" khiến người xem lướt đi làm hỏng chỉ số retention!
4. THẺ PHÂN LOẠI (tag):
   - TUYỆT ĐỐI KHÔNG để bài nào cũng là "TIN NÓNG"! Thẻ tag phải ngắn gọn 2-4 từ, phản ánh chính xác điểm nhấn độc đáo của cảnh:
     Ví dụ: "ĐẶC QUYỀN HIẾM", "GIẢM GIÁ SỐC", "NGHỊCH LÝ GIÁ", "CƠN SỐT AI", "KỶ LỤC MỚI", "BÍ MẬT HẬU TRƯỜNG", "CẢNH BÁO NÓNG", "BÍ ẨN VŨ TRỤ", "CÚ QUAY XE".

PHÂN BỔ LAYOUT ĐA DẠNG & THÔNG MINH (SPEC-05):
Luân phiên linh hoạt các kiểu Layout: "list", "stat", "quote", "image". Cảnh có số liệu ưu tiên dùng "stat", trích dẫn dùng "quote", luận điểm dùng "list".
${images.length > 0 ? `ẢNH THỰC CHỨNG KHẢ DỤNG: ${images.join(', ')}. CHỈ gán ảnh vào Cảnh 1 (Hook) hoặc Cảnh 2/3 (Chứng cứ). TUYỆT ĐỐI KHÔNG gán lặp lại cùng 1 ảnh cho tất cả các cảnh.` : ''}

YÊU CẦU TIÊU ĐỀ YOUTUBE SHORTS (youtubeTitle):
- Tiêu đề giật tít, tò mò, viết hoa 1-2 từ khóa then chốt, kèm emoji, kết thúc bằng #shorts (50 - 80 ký tự).

YÊU CẦU JSON HỢP LỆ:
{
  "title": "Tiêu đề ngắn 3-5 từ",
  "youtubeTitle": "Tiêu đề YouTube Shorts giật tít kết thúc bằng #shorts",
  "youtubeTags": ["thoisu", "tintuc", "xuhuong"],
  "themeColor": "#ef4444",
  "bgStyle": "grid",
  "voicePreset": "NEWS_ANCHOR" | "MYSTERY" | "BREAKING_ALERT" | "TECH_HYPE" | "FINANCE_EXPERT" | "STORYTELLING" | "SATIRICAL_MEME" | "CINEMATIC_DOC",
  "scenes": [
    {
      "tag": "THẺ PHÂN LOẠI",
      "speaker": "anchor" | "reporter",
      "layoutType": "image" | "list" | "stat" | "quote",
      "imageFile": "${images[0] || ''}",
      "headline": "Tiêu đề cô đọng của cảnh (dưới 8 từ)",
      "keyTakeaways": ["Luận điểm 1", "Luận điểm 2"],
      "statNumber": "55 Triệu",
      "statLabel": "Lượt theo dõi",
      "quoteText": "Trích dẫn nguyên văn...",
      "quoteAuthor": "Đại diện cơ quan",
      "voiceover": "Đoạn thoại ngắn dồn dập 18-26 từ bắt tai..."
    }
  ]
}
`;

  const jsonStr = await callGemini(genAI, prompt, true, logFn, 'WRITE');
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    logFn(`  ❌ Lỗi parse JSON ở Bước 2B: ${jsonStr}`);
    throw e;
  }
}

module.exports = { extractFacts, generateScript };