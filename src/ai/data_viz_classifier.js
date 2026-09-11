const { getModelsForTask, blockModel, getModelBlockTimeRemaining } = require('./model_router');

/**
 * Data Visualization Classifier AI Agent
 *
 * Analyzes generated script scenes and determines which scenes
 * would benefit from animated data visualization (charts, counters, etc.)
 *
 * @param {import('@google/generative-ai').GoogleGenerativeAI} genAI
 * @param {Array} scenes - Generated scenes from generateScript()
 * @param {object} facts - Extracted facts from extractFacts()
 * @param {function} [logFn] - Logger function
 * @returns {Promise<Array>} - Enhanced scenes with chart data
 */
async function classifyDataViz(genAI, scenes, facts, logFn = console.log) {
  logFn(`\n📊 DATA VIZ CLASSIFIER: Đang phân tích cảnh nào cần animation dữ liệu...`);

  // Quick check: does this article even have quantitative data?
  const hasNumbers = (facts.keyFacts || []).some(f => /\d/.test(f));
  const hasStats = scenes.some(s => s.statNumber || s.layoutType === 'stat');

  if (!hasNumbers && !hasStats) {
    logFn(`  ℹ️ Bài không có dữ liệu số → bỏ qua data viz classification.`);
    return scenes;
  }

  const prompt = `Bạn là chuyên gia data visualization cho video tin tức ngắn (YouTube Shorts, 1080x1920).
Phân tích các SCENES dưới đây và quyết định scene nào phù hợp với animation dữ liệu.

## QUY TẮC:
1. Nếu scene có 2+ SỐ LIỆU SO SÁNH → layoutType: "bar_chart", cung cấp chartData [{label, value}]
2. Nếu scene có % hoặc TỶ LỆ PHẦN TRĂM → layoutType: "progress_ring", cung cấp progressValue (0-100) + progressLabel
3. Nếu scene có SỐ LIỆU THEO THỜI GIAN (năm, quý, tháng) → layoutType: "line_chart", cung cấp chartData [{label, value}]
4. Nếu scene có 1 CON SỐ NỔI BẬT (doanh thu, người dùng, vốn hóa) → layoutType: "animated_counter", cung cấp counterTarget (con số thuần), counterPrefix (ký hiệu tiền tệ nếu có), counterSuffix (đơn vị)
5. Nếu scene có BEFORE/AFTER hoặc SO SÁNH 2 GIÁ TRỊ → layoutType: "comparison", cung cấp comparisonData
6. Nếu scene KHÔNG có data rõ ràng hoặc data không chính xác → GIỮ NGUYÊN layoutType gốc, KHÔNG thay đổi
7. TỐI ĐA 3 scenes được chuyển thành chart (không nên quá nhiều chart trong 1 video)
8. KHÔNG BỊA SỐ LIỆU. Chỉ dùng data có trong scene/facts.

## FACTS (nguồn dữ liệu chính):
${JSON.stringify({ keyFacts: facts.keyFacts, impact: facts.impact }, null, 2)}

## SCENES HIỆN TẠI:
${JSON.stringify(scenes.map((s, i) => ({
    index: i,
    layoutType: s.layoutType,
    headline: s.headline,
    statNumber: s.statNumber,
    statLabel: s.statLabel,
    keyTakeaways: s.keyTakeaways,
  })), null, 2)}

## TRẢ VỀ JSON (mảng các thay đổi, CHỈ bao gồm scenes cần thay đổi):
[
  {
    "index": 0,
    "layoutType": "animated_counter",
    "counterTarget": 2500000000,
    "counterPrefix": "$",
    "counterSuffix": "",
    "chartData": null,
    "progressValue": null,
    "progressLabel": null,
    "comparisonData": null
  }
]

Nếu KHÔNG có scene nào phù hợp, trả về mảng rỗng: []`;

  try {
    const fallbackModels = getModelsForTask('WRITE', process.env.GEMINI_MODEL);

    for (const modelName of fallbackModels) {
      const blockTime = getModelBlockTimeRemaining(modelName);
      if (blockTime > 0) continue;

      try {
        logFn(`  🔄 Đang thử model: ${modelName}...`);
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        });

        let jsonStr = result.response.text();
        jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
        const changes = JSON.parse(jsonStr);

        if (!Array.isArray(changes)) {
          logFn(`  ⚠️ Response không phải mảng, bỏ qua.`);
          return scenes;
        }

        // Apply changes to scenes
        let changedCount = 0;
        for (const change of changes) {
          const idx = change.index;
          if (idx < 0 || idx >= scenes.length) continue;

          const validTypes = ['animated_counter', 'bar_chart', 'progress_ring', 'line_chart', 'comparison'];
          if (!validTypes.includes(change.layoutType)) continue;

          scenes[idx].layoutType = change.layoutType;

          if (change.counterTarget != null) scenes[idx].counterTarget = Number(change.counterTarget);
          if (change.counterPrefix) scenes[idx].counterPrefix = String(change.counterPrefix);
          if (change.counterSuffix) scenes[idx].counterSuffix = String(change.counterSuffix);
          if (change.progressValue != null) scenes[idx].progressValue = Number(change.progressValue);
          if (change.progressLabel) scenes[idx].progressLabel = String(change.progressLabel);
          if (Array.isArray(change.chartData)) {
            scenes[idx].chartData = change.chartData.map(d => ({
              label: String(d.label),
              value: Number(d.value),
              color: d.color || undefined,
            }));
          }
          if (change.comparisonData && change.comparisonData.before && change.comparisonData.after) {
            scenes[idx].comparisonData = {
              before: { label: String(change.comparisonData.before.label), value: String(change.comparisonData.before.value) },
              after: { label: String(change.comparisonData.after.label), value: String(change.comparisonData.after.value) },
            };
          }

          changedCount++;
          logFn(`  📊 Scene ${idx + 1}: "${scenes[idx].headline}" → ${change.layoutType}`);
        }

        logFn(`  ✅ Data Viz classification hoàn tất: ${changedCount}/${scenes.length} scenes được nâng cấp.`);
        return scenes;
      } catch (err) {
        if (err.message && (err.message.includes('429') || err.message.includes('Quota'))) {
          blockModel(modelName, 60);
        }
        logFn(`  ⚠️ Model ${modelName} thất bại: ${err.message}`);
      }
    }

    logFn(`  ⚠️ Tất cả model đều thất bại. Giữ nguyên layout gốc.`);
    return scenes;
  } catch (err) {
    logFn(`  ❌ Data viz classifier error: ${err.message}. Giữ nguyên.`);
    return scenes;
  }
}

module.exports = { classifyDataViz };
