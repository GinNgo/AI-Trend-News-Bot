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
  const targetScenes = Math.max(4, Math.min(8, numFacts + numQuotes + 1));
  const prompt = `
${language === 'en' ? "CRITICAL: YOU MUST WRITE THE VIDEO SCRIPT ENTIRELY IN ENGLISH! The voiceover, headlines, tags, and takeaways MUST BE IN ENGLISH! Target audience is Global/US." : "BẮT BUỘC: VIẾT HOÀN TOÀN BẰNG TIẾNG VIỆT."}

Dựa vào DỮ LIỆU ĐÃ ĐƯỢC KIỂM CHỨNG dưới đây, hãy xây dựng kịch bản Video Ngắn (Shorts) thời lượng 45 - 60 giây.

DỮ LIỆU KIỂM CHỨNG (FACTS):
- Tóm tắt: ${facts.summary}
- Thể loại: ${facts.category}
- Sự kiện chính: ${facts.keyFacts.join('; ')}
- Trích dẫn: ${facts.quotes.map(q => `"${q.text}" - ${q.author}`).join(' | ')}
- Ảnh hưởng: ${facts.impact}

YÊU CẦU GIỌNG ĐIỆU:
Nếu là tin Công nghệ: Hiện đại, nhanh. Nếu Kinh tế/Tội phạm: Đanh thép, điều tra. Nếu Giải trí: Gần gũi, cuốn hút.
Mỗi voiceover khoảng 40-60 chữ. KHÔNG ĐƯỢC BỊA THÊM SỐ LIỆU ngoài phần FACTS ở trên.

SỐ LƯỢNG CẢNH (SCENES): BẮT BUỘC kịch bản phải có đúng ${targetScenes} CẢNH (scenes) để truyền tải hết dữ liệu.
Luân phiên 4 kiểu Layout: "list", "stat", "quote", "image" (có thể lặp lại hoặc kết hợp tự do để đủ ${targetScenes} cảnh).

${images.length > 0 ? `ẢNH THỰC CHỨNG ĐÃ TẢI: ${images.join(', ')}. Gán tên ảnh vào trường "imageFile" của các cảnh phù hợp.` : ''}

YÊU CẦU JSON HỢP LỆ:
{
  "title": "Tiêu đề ngắn 3-5 từ",
  "themeColor": "#ef4444",
  "bgStyle": "grid",
  "scenes": [
    {
      "tag": "THẺ PHÂN LOẠI",
      "layoutType": "list" | "stat" | "quote" | "image",
      "imageFile": "${images[0] || ''}",
      "headline": "Tiêu đề cô đọng của cảnh",
      "keyTakeaways": ["Luận điểm 1", "Luận điểm 2"],
      "statNumber": "55 Triệu",
      "statLabel": "Lượt theo dõi",
      "quoteText": "Trích dẫn nguyên văn...",
      "quoteAuthor": "Đại diện cơ quan",
      "voiceover": "Đoạn thoại 15-25 giây..."
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