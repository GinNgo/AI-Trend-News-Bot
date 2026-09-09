const { GoogleGenerativeAI } = require('@google/generative-ai');

async function callGemini(genAI, prompt, isJson = false, logFn = console.log) {
  // Use models that actually exist and are powerful
  const fallbackModels = [
    "gemini-3.5-flash",
    "gemini-3.6-flash",
    "gemini-3.7-flash",
    "gemini-2.5-flash",
    "gemini-2.5-pro",
  ];

  let resultText = "";
  let success = false;

  for (const modelName of fallbackModels) {
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
      logFn(`  ⚠️ Model ${modelName} thất bại: ${err.message}. Đang thử model tiếp theo...`);
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
async function extractFacts(genAI, rawText, logFn = console.log) {
  logFn(`\n🧠 BƯỚC 2A: AI đang phân tích ĐIỀU TRA CHUYÊN SÂU & Bóc tách sự kiện...`);
  const prompt = `
Bạn là một Phóng viên Điều tra. Dưới đây là nội dung văn bản thô cào được từ một bài báo.
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

  const jsonStr = await callGemini(genAI, prompt, true, logFn);
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
async function generateScript(genAI, facts, images = [], logFn = console.log) {
  logFn(`\n🧠 BƯỚC 2B: AI đang lên kịch bản Video dựa trên Facts đã được kiểm chứng...`);
  const prompt = `
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

Tùy theo độ chi tiết, chia thành 4 đến 7 CẢNH (scenes).
Luân phiên 4 kiểu Layout: "list", "stat", "quote", "image".

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

  const jsonStr = await callGemini(genAI, prompt, true, logFn);
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    logFn(`  ❌ Lỗi parse JSON ở Bước 2B: ${jsonStr}`);
    throw e;
  }
}

module.exports = { extractFacts, generateScript };