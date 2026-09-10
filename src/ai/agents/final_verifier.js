const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../../collector/utils/logger');

class FinalVerifier {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey || process.env.GEMINI_API_KEY);
  }

  async verify(storyPackage, claimRegistry, timeline) {
    logger.info(`[FinalVerifier] Bắt đầu Final Fact Check cho Story ${storyPackage.storyId}...`);

    const prompt = `
Bạn là một Biên tập viên Kiểm duyệt Độc lập (Independent Verifier).
Nhiệm vụ của bạn là đối chiếu Kịch bản Video (Story Package) với Kho chứng cứ (Claim Registry) và Dòng thời gian (Timeline) để đảm bảo không có thông tin sai lệch nào được công bố.

YÊU CẦU:
- Không được có con số bịa đặt (unsupported numbers).
- Không được có trích dẫn tự bịa (invented quotes).
- Không sai ngày tháng, tên người, hoặc quan hệ nhân quả.
- Lời văn không được phóng đại thái quá, không khẳng định chắc chắn những điều còn nghi vấn.

KỊCH BẢN (STORY):
${JSON.stringify(storyPackage, null, 2)}

KHO CHỨNG CỨ (CLAIMS):
${JSON.stringify(claimRegistry, null, 2)}

DÒNG THỜI GIAN (TIMELINE):
${JSON.stringify(timeline, null, 2)}

TRẢ VỀ ĐỊNH DẠNG JSON NGHIÊM NGẶT THEO SCHEMA:
{
  "status": "PASS" | "FAIL" | "REVIEW",
  "reason": "Giải thích tóm tắt",
  "findings": [
    {
      "type": "unsupported_number" | "invented_quote" | "wrong_date" | "exaggeration" | "contradiction",
      "detail": "Mô tả chi tiết lỗi",
      "sceneId": "ID của cảnh chứa lỗi (nếu có)"
    }
  ]
}
`;

    const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const model = this.genAI.getGenerativeModel({ model: modelName });

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        });

        let rawText = result.response.text();
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

        const parsed = JSON.parse(rawText);

        if (parsed.status === 'PASS') {
          logger.info(`[FinalVerifier] ✅ Đạt (PASS) - Story ${storyPackage.storyId}`);
        } else {
          logger.warn(`[FinalVerifier] ❌ Thất bại (${parsed.status}): ${parsed.reason}`);
        }

        return parsed;
      } catch (err) {
        logger.warn(`[FinalVerifier] Lỗi gọi AI (Attempt ${attempt}): ${err.message}`);
      }
    }

    throw new Error('FinalVerifier AI failed permanently');
  }
}

module.exports = { FinalVerifier };
