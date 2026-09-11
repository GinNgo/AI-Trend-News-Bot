const { getModelsForTask, blockModel, getModelBlockTimeRemaining } = require('./model_router');

/**
 * Groups similar news articles by semantic similarity using AI.
 * Takes an array of news items (with title, link, snippet) and returns
 * deduplicated groups where each group represents the same event.
 *
 * @param {GoogleGenerativeAI} genAI
 * @param {Array<{title: string, link: string, snippet: string}>} articles
 * @param {function} logFn
 * @returns {Promise<Array<{representative: object, duplicates: object[]}>>}
 */
async function deduplicateBySemantics(genAI, articles, logFn = console.log) {
  // If fewer than 3 articles, no point in dedup — each is its own group
  if (!articles || articles.length < 3) {
    return articles.map(a => ({ representative: a, duplicates: [] }));
  }

  logFn(`  🔍 Semantic dedup: analyzing ${articles.length} articles...`);

  // Batch articles into groups of 20 max for AI processing
  const BATCH_SIZE = 20;
  const batches = [];
  for (let i = 0; i < articles.length; i += BATCH_SIZE) {
    batches.push(articles.slice(i, i + BATCH_SIZE));
  }

  let allGroups = [];

  for (let batchIdx = 0; batchIdx < batches.length; batchIdx++) {
    const batch = batches[batchIdx];
    logFn(`  📦 Processing batch ${batchIdx + 1}/${batches.length} (${batch.length} articles)...`);

    const result = await classifyBatch(genAI, batch, batchIdx, logFn);
    allGroups = allGroups.concat(result);
  }

  logFn(`  ✅ Semantic dedup complete: ${articles.length} articles → ${allGroups.length} unique topics.`);
  return allGroups;
}

/**
 * Send a batch of articles to the AI for semantic grouping.
 */
async function classifyBatch(genAI, batch, batchIdx, logFn) {
  // Build numbered list of articles for the prompt
  const articleList = batch.map((a, i) => {
    const snippet = (a.snippet || '').substring(0, 200);
    return `[${i}] Title: ${a.title}\n    Snippet: ${snippet}`;
  }).join('\n');

  const prompt = `You are a news deduplication engine. Given the following numbered news articles, group them by the EVENT or TOPIC they cover. Articles about the same event/topic (even from different sources or with slightly different wording) should be in the same group.

For each group:
- Pick the BEST representative article (most detailed title, most informative snippet).
- List the remaining articles in that group as duplicates.

Articles:
${articleList}

Respond ONLY with a valid JSON array. Each element is an object with:
- "representative": the index number of the best article in the group
- "duplicates": array of index numbers of the other articles in the same group

Example response:
[{"representative": 0, "duplicates": [3, 5]}, {"representative": 1, "duplicates": []}, {"representative": 2, "duplicates": [4]}]

Rules:
- Every article index (0 to ${batch.length - 1}) must appear exactly once, either as a representative or in a duplicates array.
- Articles that are unique (no duplicates) should still appear as a group with an empty duplicates array.
- Output ONLY the JSON array, no markdown fences, no explanation.`;

  const models = getModelsForTask('CLASSIFY');

  for (const modelName of models) {
    const cooldown = getModelBlockTimeRemaining(modelName);
    if (cooldown > 0) continue;

    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const text = result.response.text().trim();

      // Parse the JSON response
      const parsed = parseGroupingResponse(text, batch);
      if (parsed) {
        logFn(`  ✅ Batch ${batchIdx + 1} grouped by ${modelName}: ${parsed.length} unique topics.`);
        return parsed;
      }

      logFn(`  ⚠️ Model ${modelName} returned unparseable response, trying next model...`);
    } catch (err) {
      const msg = err.message || '';
      if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
        const waitSecs = extractRetryAfter(msg) || 60;
        blockModel(modelName, waitSecs);
        logFn(`  ⏳ Model ${modelName} rate-limited, blocked for ${waitSecs}s.`);
      } else {
        logFn(`  ⚠️ Model ${modelName} error: ${msg}`);
      }
    }
  }

  // Fallback: if all models fail, treat each article as its own group
  logFn(`  ⚠️ All models failed for semantic dedup batch ${batchIdx + 1}. Falling back to no dedup.`);
  return batch.map(a => ({ representative: a, duplicates: [] }));
}

/**
 * Parse the AI's JSON grouping response and map indices back to article objects.
 * Returns null if parsing fails.
 */
function parseGroupingResponse(text, batch) {
  try {
    // Strip markdown code fences if present
    let cleaned = text;
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    const groups = JSON.parse(cleaned);

    if (!Array.isArray(groups)) return null;

    // Validate: every index from 0..batch.length-1 should appear exactly once
    const seen = new Set();
    for (const group of groups) {
      if (typeof group.representative !== 'number') return null;
      seen.add(group.representative);
      if (Array.isArray(group.duplicates)) {
        for (const d of group.duplicates) {
          seen.add(d);
        }
      }
    }

    // Allow partial coverage (AI might miss some), but representative must be valid
    const result = [];
    const coveredIndices = new Set();

    for (const group of groups) {
      const repIdx = group.representative;
      if (repIdx < 0 || repIdx >= batch.length) continue;

      coveredIndices.add(repIdx);

      const duplicates = (group.duplicates || [])
        .filter(d => typeof d === 'number' && d >= 0 && d < batch.length && d !== repIdx)
        .map(d => {
          coveredIndices.add(d);
          return batch[d];
        });

      result.push({
        representative: batch[repIdx],
        duplicates
      });
    }

    // Add any uncovered articles as their own group
    for (let i = 0; i < batch.length; i++) {
      if (!coveredIndices.has(i)) {
        result.push({ representative: batch[i], duplicates: [] });
      }
    }

    return result;
  } catch {
    return null;
  }
}

/**
 * Try to extract a retry-after duration from an error message.
 */
function extractRetryAfter(errorMsg) {
  // Look for patterns like "retry after 30s" or "retryDelay: 45"
  const match = errorMsg.match(/retry\s*(?:after|delay)[:\s]*(\d+)/i);
  if (match) return parseInt(match[1], 10);
  return null;
}

module.exports = { deduplicateBySemantics };
