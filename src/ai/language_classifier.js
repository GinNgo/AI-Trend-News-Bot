const { getModelsForTask, blockModel, getModelBlockTimeRemaining } = require('./model_router');

/**
 * Source metadata map — maps RSS feed domains to region + default language.
 * Used by the Language Classifier to determine video language.
 */
const SOURCE_METADATA = {
  'news.ycombinator.com':    { region: 'international', defaultLang: 'en', name: 'Hacker News' },
  'hnrss.org':               { region: 'international', defaultLang: 'en', name: 'Hacker News' },
  'techcrunch.com':          { region: 'international', defaultLang: 'en', name: 'TechCrunch' },
  'theverge.com':            { region: 'international', defaultLang: 'en', name: 'The Verge' },
  'venturebeat.com':         { region: 'international', defaultLang: 'en', name: 'VentureBeat' },
  'arxiv.org':               { region: 'international', defaultLang: 'en', name: 'ArXiv' },
  'reuters.com':             { region: 'international', defaultLang: 'en', name: 'Reuters' },
  'bbc.com':                 { region: 'international', defaultLang: 'en', name: 'BBC' },
  'news.google.com':         { region: 'vietnam',       defaultLang: 'vi', name: 'Google News VN' },
  'vnexpress.net':           { region: 'vietnam',       defaultLang: 'vi', name: 'VnExpress' },
  'tuoitre.vn':              { region: 'vietnam',       defaultLang: 'vi', name: 'Tuổi Trẻ' },
  'thanhnien.vn':            { region: 'vietnam',       defaultLang: 'vi', name: 'Thanh Niên' },
  'dantri.com.vn':           { region: 'vietnam',       defaultLang: 'vi', name: 'Dân Trí' },
  'vietnamnet.vn':           { region: 'vietnam',       defaultLang: 'vi', name: 'VietnamNet' },
};

/**
 * Resolve source metadata from a URL string.
 * @param {string} url - The article URL or RSS feed URL
 * @returns {{ region: string, defaultLang: string, name: string } | null}
 */
function getSourceMetadata(url) {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    // Try exact match first
    if (SOURCE_METADATA[hostname]) return SOURCE_METADATA[hostname];
    // Try partial match (e.g., feeds.techcrunch.com → techcrunch.com)
    for (const [domain, meta] of Object.entries(SOURCE_METADATA)) {
      if (hostname.includes(domain) || hostname.endsWith(domain)) {
        return meta;
      }
    }
  } catch (e) {
    // Invalid URL, try string matching
    for (const [domain, meta] of Object.entries(SOURCE_METADATA)) {
      if (url.includes(domain)) return meta;
    }
  }
  return null;
}

/**
 * Language Classifier AI Agent
 * Automatically determines whether the video should be in English or Vietnamese
 * based on source origin, article content, and impact scope.
 *
 * @param {import('@google/generative-ai').GoogleGenerativeAI} genAI
 * @param {object} params
 * @param {string} params.sourceUrl - The original article URL
 * @param {object} params.facts - Extracted facts from Stage 1
 * @param {string} [params.rawText] - Optional raw article text for extra context
 * @param {function} [params.logFn] - Logger function
 * @returns {Promise<{ language: 'en'|'vi', confidence: number, reasoning: string }>}
 */
async function classifyLanguage(genAI, { sourceUrl, facts, rawText, logFn = console.log }) {
  logFn(`\n🌐 LANGUAGE CLASSIFIER: Đang phân tích ngôn ngữ phù hợp cho video...`);

  const sourceMeta = getSourceMetadata(sourceUrl);
  const sourceRegion = sourceMeta ? sourceMeta.region : 'unknown';
  const sourceDefaultLang = sourceMeta ? sourceMeta.defaultLang : 'vi';
  const sourceName = sourceMeta ? sourceMeta.name : 'Unknown';

  logFn(`  📡 Nguồn: ${sourceName} (${sourceRegion}, default: ${sourceDefaultLang})`);

  // Fast path: International sources → English (no AI call needed)
  if (sourceRegion === 'international') {
    logFn(`  ⚡ Fast path: Nguồn quốc tế → English`);
    return {
      language: 'en',
      confidence: 0.95,
      reasoning: `Source "${sourceName}" is an international publication. Defaulting to English for global audience reach.`
    };
  }

  // For Vietnamese sources, use AI to determine if the impact is international
  const prompt = `Bạn là chuyên gia phân loại ngôn ngữ cho video tin tức ngắn (YouTube Shorts).
Dựa vào thông tin bài báo bên dưới, hãy quyết định video nên bằng TIẾNG ANH (en) hay TIẾNG VIỆT (vi).

## QUY TẮC (ĐỌC KỸ):
1. Nguồn VN + tin ảnh hưởng QUỐC TẾ (IPO quốc tế, sản phẩm bán toàn cầu, hội nghị quốc tế, giải thưởng quốc tế, breakthrough khoa học published bằng tiếng Anh) → "en"
2. Nguồn VN + tin ảnh hưởng NỘI ĐỊA (giao thông, đời sống, chính sách VN, giáo dục VN, y tế VN, tội phạm VN, thể thao VN, giải trí VN) → "vi"
3. Tin có TÊN CÔNG TY / SẢN PHẨM quốc tế là chủ thể chính (Apple, Google, Tesla, etc.) nhưng viết cho audience VN → "vi" (vì bài từ nguồn VN, audience VN)
4. Tin VN viết về CÔNG TY VN vươn ra quốc tế (VinFast IPO NASDAQ, FPT hợp đồng quốc tế) → "en"
5. KHI KHÔNG CHẮC CHẮN → mặc định "vi"

## THÔNG TIN BÀI BÁO:
- Nguồn: ${sourceName}
- Tóm tắt: ${facts.summary || 'N/A'}
- Thể loại: ${facts.category || 'N/A'}
- Ảnh hưởng: ${facts.impact || 'N/A'}
- Sự kiện chính: ${(facts.keyFacts || []).slice(0, 3).join('; ')}

## TRẢ VỀ JSON (KHÔNG giải thích thêm):
{
  "language": "en" | "vi",
  "confidence": 0.0 - 1.0,
  "reasoning": "Giải thích ngắn gọn 1 câu"
}`;

  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const fallbackModels = getModelsForTask('CLASSIFY', process.env.GEMINI_MODEL);

    for (const modelName of fallbackModels) {
      const blockTime = getModelBlockTimeRemaining(modelName);
      if (blockTime > 0) continue;

      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        });

        let jsonStr = result.response.text();
        jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(jsonStr);

        // Validate response
        const language = parsed.language === 'en' ? 'en' : 'vi';
        const confidence = typeof parsed.confidence === 'number'
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.7;

        logFn(`  ✅ Kết quả: ${language === 'en' ? '🇬🇧 English' : '🇻🇳 Tiếng Việt'} (confidence: ${(confidence * 100).toFixed(0)}%)`);
        logFn(`  💬 Lý do: ${parsed.reasoning || 'N/A'}`);

        return {
          language,
          confidence,
          reasoning: parsed.reasoning || `AI classified as ${language}`
        };
      } catch (err) {
        if (err.message && (err.message.includes('429') || err.message.includes('Quota'))) {
          blockModel(modelName, 60);
        }
        logFn(`  ⚠️ Model ${modelName} thất bại: ${err.message}`);
      }
    }

    // All models failed → fallback to default
    logFn(`  ⚠️ AI thất bại, fallback → ${sourceDefaultLang}`);
    return {
      language: sourceDefaultLang,
      confidence: 0.5,
      reasoning: `AI classification failed. Falling back to source default: ${sourceDefaultLang}`
    };
  } catch (err) {
    logFn(`  ❌ Language classifier error: ${err.message}. Fallback → ${sourceDefaultLang}`);
    return {
      language: sourceDefaultLang,
      confidence: 0.5,
      reasoning: `Error in language classification. Falling back to source default: ${sourceDefaultLang}`
    };
  }
}

module.exports = { classifyLanguage, getSourceMetadata, SOURCE_METADATA };
