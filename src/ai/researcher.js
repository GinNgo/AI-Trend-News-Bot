const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');
const path = require('path');
const { StorySchema, ClaimSchema, EventSchema, ImpactSchema } = require('./schemas');
const logger = require('../collector/utils/logger');

// Retry wrapper cho LLM call
async function callGeminiWithRetry(genAI, prompt, schema, maxRetries = 3) {
  const models = [
    process.env.GEMINI_MODEL,
    'gemini-3.5-flash-lite',
    'gemini-3.6-flash',
    'gemini-flash-latest',
    'gemini-3.5-flash',
    'gemini-2.5-flash-lite'
  ].filter(Boolean);
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    for (const modelName of models) {
      try {
        logger.info(`[Attempt ${attempt}/${maxRetries}] Đang gọi AI model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });

        // Use JSON mode
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        });

        let rawText = result.response.text();
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

        const parsed = JSON.parse(rawText);

        // Validate with Zod
        if (schema) {
          return schema.parse(parsed);
        }
        return parsed;

      } catch (err) {
        lastError = err;
        logger.warn(`Lỗi ở model ${modelName} (Attempt ${attempt}): ${err.message}`);
        if (err.message.includes('429') || err.message.includes('Quota') || err.message.includes('retry in')) {
          let waitSecs = 2; // default
          const match = err.message.match(/retry in ([0-9.]+)s/i) || err.message.match(/retryDelay":"([0-9]+)s"/i);
          if (match) {
            waitSecs = Math.ceil(parseFloat(match[1])) + 1; // +1s buffer
          }
          logger.warn(`⏳ Bị chặn Rate Limit. Đang chờ ${waitSecs}s trước khi đổi model...`);
          await new Promise(r => setTimeout(r, waitSecs * 1000));
        } else if (err.message.includes('503')) {
          await new Promise(r => setTimeout(r, 3000));
        }
        // Nếu lỗi do Zod validation, prompt lại AI để sửa format (tùy chọn)
        if (err.name === 'ZodError') {
          prompt += `\n\n[LỖI HỆ THỐNG]: Lần chạy trước bạn trả về JSON không đúng Schema. Lỗi chi tiết: ${JSON.stringify(err.errors)}. Vui lòng sửa lại.`;
        }
      }
    }
  }
  throw new Error(`AI Pipeline thất bại sau ${maxRetries} lần thử. Lỗi cuối: ${lastError.message}`);
}

class EvidenceResearcher {
  constructor(apiKey) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * 1. EVENT CLUSTER & CLAIM EXTRACTION
   */
  async extractClaims(normalizedArticles) {
    logger.info(`[PIPELINE] Bắt đầu Trích xuất Claim từ ${normalizedArticles.length} nguồn.`);
    const sourcesData = normalizedArticles.map(a => `
[SOURCE_ID]: ${a.sourceId}
[SOURCE_NAME]: ${a.sourceName}
[URL]: ${a.url}
[CONTENT]: ${a.content}
    `).join('\n---\n');

    const prompt = `
Bạn là một AI Fact-Checker và Điều tra viên độc lập.
Dưới đây là các tài liệu nguồn (NORMALIZED ARTICLES). Tuyệt đối KHÔNG tự sáng tạo thêm bất kỳ thông tin nào không có trong này.
Hãy phân tích và trả về định dạng JSON gồm:
1. "event": Định nghĩa cụm sự kiện chính.
2. "claims": Các luận điểm/tuyên bố rút ra từ tài liệu.

Yêu cầu Schema JSON:
{
  "event": {
    "eventId": "String",
    "topic": "String",
    "description": "String",
    "timeframe": "String",
    "entities": ["String"]
  },
  "claims": [
    {
      "id": "claim_1",
      "statement": "String",
      "status": "UNVERIFIED",
      "evidence": [
        {
          "sourceId": "String (Trùng với SOURCE_ID ở trên)",
          "url": "String",
          "quote": "String (Trích dẫn nguyên văn)",
          "context": "String"
        }
      ]
    }
  ]
}

Nếu một claim KHÔNG CÓ quote cụ thể từ nguồn, hãy để empty evidence [].

TÀI LIỆU NGUỒN:
${sourcesData}
    `;

    // No Zod schema strict parse here because we will map it manually or we can parse.
    return await callGeminiWithRetry(this.genAI, prompt);
  }

  /**
   * 2. EVIDENCE MAPPING & FACT CHECK
   */
  factCheckClaims(extractedData) {
    logger.info(`[PIPELINE] Đang Fact-check và Mapping Evidence...`);
    const verifiedClaims = [];
    const unverifiedClaims = [];

    for (const claim of extractedData.claims) {
      if (!claim.evidence || claim.evidence.length === 0) {
        claim.status = 'UNVERIFIED';
        unverifiedClaims.push(claim);
        logger.warn(`[UNVERIFIED] Claim bị loại bỏ vì không có nguồn: "${claim.statement}"`);
      } else {
        // Kiểm tra xem sourceId có hợp lệ không
        const hasValidSource = claim.evidence.some(e => e.sourceId && e.quote);
        if (hasValidSource) {
          claim.status = 'VERIFIED';
          verifiedClaims.push(claim);
        } else {
          claim.status = 'UNVERIFIED';
          unverifiedClaims.push(claim);
          logger.warn(`[UNVERIFIED] Claim bị loại vì source mapping sai: "${claim.statement}"`);
        }
      }
    }

    return {
      event: extractedData.event,
      verifiedClaims,
      unverifiedClaims
    };
  }

  /**
   * 3. IMPACT ANALYSIS
   */
  async analyzeImpact(factCheckedData) {
    logger.info(`[PIPELINE] Đang phân tích Impact...`);
    const verifiedText = factCheckedData.verifiedClaims.map(c => `- ${c.statement}`).join('\n');
    const prompt = `
Dựa vào các SỰ THẬT ĐÃ ĐƯỢC KIỂM CHỨNG dưới đây, hãy đánh giá tác động.
KHÔNG sử dụng các fact chưa được kiểm chứng.

SỰ THẬT:
${verifiedText}

Yêu cầu Schema JSON:
{
  "severity": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "affectedGroups": ["Nhóm 1", "Nhóm 2"],
  "shortTermEffects": "String",
  "longTermImplications": "String"
}
    `;

    return await callGeminiWithRetry(this.genAI, prompt, ImpactSchema);
  }

  /**
   * 4. STORY PACKAGE
   */
  async packageStory(factCheckedData, impactData) {
    logger.info(`[PIPELINE] Đang đóng gói Kịch bản cuối (Story Package)...`);

    const scriptPrompt = `
DỰA HOÀN TOÀN TRÊN SỰ THẬT ĐÃ KIỂM CHỨNG dưới đây, hãy lên kịch bản video mang phong cách: professional documentary / newsroom / technology journalism.

QUY TẮC RETENTION & STORYTELLING:
1. KHÔNG dùng generic AI narration (Tuyệt đối KHÔNG bắt đầu bằng "Xin chào mọi người", "Hôm nay chúng ta sẽ...").
2. KHÔNG dùng clickbait giả, fake urgency, exaggerated claims, hoặc generic conclusion.
3. Mỗi 15-30 giây PHẢI có ít nhất một thông tin mới (new fact/visual/question/implication/context).
4. Xây dựng cốt truyện theo đúng cấu trúc Narrative Arc:
   HOOK -> CONTEXT -> EVENT -> EVIDENCE -> WHY IT MATTERS -> SURPRISING IMPLICATION -> IMPACT -> VIETNAM ANGLE (nếu có) -> FUTURE -> CONCLUSION.
5. Voiceover phải mang tính phân tích chuyên sâu, tránh lặp từ (repetitive wording).
6. Tự đánh giá MẬT ĐỘ THÔNG TIN:
   - Nếu chủ đề đơn giản: Chọn thời lượng 30s hoặc 60s.
   - Nếu chủ đề phức tạp: Tự động chọn 90s, 3m, 5m, 8m hoặc 10m.
7. KHÔNG cắt facts quan trọng chỉ để vừa 60 giây. Nới rộng thời lượng tương ứng.
8. BẤT KỲ CÂU VOICE-OVER NÀO CHỨA SỐ LIỆU ĐỀU PHẢI NẰM TRONG DANH SÁCH SỰ THẬT.
9. KHÔNG ĐƯỢC BỊA THÊM SỐ LIỆU, THỜI GIAN, GIÁ TIỀN.
10. Mỗi cảnh (scene) phải có "durationSec" (số giây) hợp lý.
11. Tạo một "retentionPlan" giải thích chiến lược giữ chân khán giả.

SỰ THẬT KIỂM CHỨNG:
${JSON.stringify(factCheckedData.verifiedClaims, null, 2)}

ĐÁNH GIÁ TÁC ĐỘNG:
${JSON.stringify(impactData, null, 2)}

Yêu cầu Schema JSON:
{
  "title": "Tiêu đề video",
  "themeColor": "#ef4444",
  "bgStyle": "grid",
  "targetDurationSec": 90,
  "storyAngle": "Góc nhìn",
  "retentionPlan": {
    "hookStrategy": "Chiến lược 3 giây đầu",
    "pacingSeconds": 15,
    "visualStrategy": "Chiến lược hình ảnh (ưu tiên real footage, charts, maps)",
    "vietnamAngleIncluded": true
  },
  "scenes": [
    {
      "id": 1,
      "narrativeArc": "HOOK", // Chọn 1 trong: HOOK, CONTEXT, EVENT, EVIDENCE, WHY_IT_MATTERS, SURPRISING_IMPLICATION, IMPACT, VIETNAM_ANGLE, FUTURE, CONCLUSION
      "layoutType": "list", // "list", "stat", "quote", "image", "chart"
      "headline": "Tiêu đề cảnh",
      "keyTakeaways": ["Luận điểm 1"],
      "statNumber": "Số liệu nếu có",
      "statLabel": "Mô tả số",
      "quoteText": "Trích dẫn",
      "quoteAuthor": "Nguồn",
      "voiceover": "Câu thoại đi thẳng vào vấn đề...",
      "durationSec": 15
    }
  ]
}
    `;

    const rawStory = await callGeminiWithRetry(this.genAI, scriptPrompt);

    const finalStory = {
      title: rawStory.title,
      themeColor: rawStory.themeColor,
      bgStyle: rawStory.bgStyle,
      targetDurationSec: rawStory.targetDurationSec,
      storyAngle: rawStory.storyAngle,
      retentionPlan: rawStory.retentionPlan,
      event: factCheckedData.event,
      verifiedClaims: factCheckedData.verifiedClaims,
      unverifiedClaims: factCheckedData.unverifiedClaims,
      impact: impactData,
      scenes: rawStory.scenes
    };

    return StorySchema.parse(finalStory);
  }

  /**
   * ENTRY POINT: Run Full Pipeline
   */
  async runPipeline(normalizedArticles) {
    if (!normalizedArticles || normalizedArticles.length === 0) {
      throw new Error("Không có bài viết đầu vào.");
    }

    // 1. Trích xuất Claim
    const rawData = await this.extractClaims(normalizedArticles);

    // 2. Mapping & Kiểm chứng chéo
    const factCheckedData = this.factCheckClaims(rawData);

    // 3. Đánh giá tác động
    const impactData = await this.analyzeImpact(factCheckedData);

    // 4. Lên kịch bản dựa trên Fact
    const storyPackage = await this.packageStory(factCheckedData, impactData);

    logger.info(`[PIPELINE] Thành công! Story Package có ${storyPackage.verifiedClaims.length} verified claims và ${storyPackage.scenes.length} scenes.`);
    return storyPackage;
  }
}

module.exports = { EvidenceResearcher };