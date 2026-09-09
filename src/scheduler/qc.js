const { GoogleGenerativeAI } = require('@google/generative-ai');
const logger = require('../collector/utils/logger');

class AIQualityControl {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async runQC(storyPackage) {
    logger.info(`[AI QC] Bắt đầu kiểm duyệt tự động cho video: "${storyPackage.title}"`);

    const prompt = `
Bạn là AI Trưởng ban Biên tập. Bạn cần Audit (Kiểm duyệt) một Kịch bản Video sắp được phát hành.
Nhiệm vụ của bạn là kiểm tra xem kịch bản có vi phạm bất kỳ nguyên tắc báo chí nào không.

TIÊU CHÍ KIỂM DUYỆT (FATAL ERRORS - TỪ CHỐI NGAY LẬP TỨC):
1. Có câu "Xin chào", "Hôm nay chúng ta sẽ", "AI avatar", "Clickbait giả" trong Voiceover không?
2. Có chứa số liệu/tên riêng nào bịa đặt không có trong Verified Claims không?
3. Có cảm xúc bị cường điệu hóa (fake urgency) không?
4. Thiếu New Fact hoặc Information Density quá loãng (câu giờ) không?

KỊCH BẢN HIỆN TẠI:
${JSON.stringify(storyPackage, null, 2)}

YÊU CẦU TRẢ VỀ ĐỊNH DẠNG JSON:
{
  "passed": true/false,
  "confidenceScore": 95, // 0-100
  "fatalErrors": ["Lỗi 1", "Lỗi 2"], // Trống nếu passed
  "warnings": ["Cảnh báo nhẹ"],
  "feedback": "Phản hồi tổng quan gửi cho người duyệt cuối"
}
    `;

    const model = this.genAI.getGenerativeModel({ model: "gemini-3.5-flash" }); // Sử dụng model ổn định

    try {
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' }
      });

      let rawText = result.response.text();
      rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

      const qcResult = JSON.parse(rawText);

      if (qcResult.passed) {
        logger.info(`[AI QC] ✅ PASSED (Score: ${qcResult.confidenceScore}). Phản hồi: ${qcResult.feedback}`);
      } else {
        logger.error(`[AI QC] ❌ FAILED! Lỗi nghiêm trọng: ${qcResult.fatalErrors.join(' | ')}`);
      }

      return qcResult;

    } catch (error) {
      logger.error(`[AI QC] Lỗi hệ thống khi gọi AI kiểm duyệt: ${error.message}`);
      throw error;
    }
  }
}

module.exports = { AIQualityControl };