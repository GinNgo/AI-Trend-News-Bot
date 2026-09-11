const { classifyLanguage, getSourceMetadata, SOURCE_METADATA } = require('./src/ai/language_classifier.js');

let passed = 0, failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    console.log(`  ❌ ${name}`);
    console.log(`     Expected: ${err.expected}`);
    console.log(`     Received: ${err.actual}`);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    const err = new Error(message || 'Assertion failed');
    err.actual = JSON.stringify(actual);
    err.expected = JSON.stringify(expected);
    throw err;
  }
}

function assertDeepEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    const err = new Error(message || 'Deep assertion failed');
    err.actual = a;
    err.expected = b;
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════
// 1. getSourceMetadata() tests — pure function, no AI needed
// ═══════════════════════════════════════════════════════════════
console.log('\n📋 getSourceMetadata() tests\n');

test('TechCrunch → international, en', () => {
  const meta = getSourceMetadata('https://techcrunch.com/2026/09/10/some-article');
  assertEqual(meta.region, 'international');
  assertEqual(meta.defaultLang, 'en');
});

test('VnExpress → vietnam, vi', () => {
  const meta = getSourceMetadata('https://vnexpress.net/bai-viet-123.html');
  assertEqual(meta.region, 'vietnam');
  assertEqual(meta.defaultLang, 'vi');
});

test('Tuổi Trẻ → vietnam, vi', () => {
  const meta = getSourceMetadata('https://tuoitre.vn/tin-tuc-456.htm');
  assertEqual(meta.region, 'vietnam');
  assertEqual(meta.defaultLang, 'vi');
});

test('Hacker News RSS (hnrss.org) → international, en', () => {
  const meta = getSourceMetadata('https://hnrss.org/front');
  assertEqual(meta.region, 'international');
  assertEqual(meta.defaultLang, 'en');
});

test('The Verge → international, en', () => {
  const meta = getSourceMetadata('https://theverge.com/tech/2026/ai-update');
  assertEqual(meta.region, 'international');
  assertEqual(meta.defaultLang, 'en');
});

test('Unknown site → null', () => {
  const meta = getSourceMetadata('https://unknown-site.com/article');
  assertEqual(meta, null);
});

test('VentureBeat feeds subdomain (partial match) → international', () => {
  const meta = getSourceMetadata('https://feeds.venturebeat.com/VentureBeat');
  assertEqual(meta.region, 'international');
  assertEqual(meta.defaultLang, 'en');
});

test('Empty string → null', () => {
  const meta = getSourceMetadata('');
  assertEqual(meta, null);
});

// ═══════════════════════════════════════════════════════════════
// 2. classifyLanguage() fast-path test — international = EN
//    The genAI mock should NOT be called for international sources
// ═══════════════════════════════════════════════════════════════
console.log('\n📋 classifyLanguage() fast-path tests\n');

(async () => {
  // Create a mock genAI that throws if ever called — proves fast path skips AI
  let genAICalled = false;
  const mockGenAI = {
    getGenerativeModel() {
      genAICalled = true;
      throw new Error('genAI should NOT be called for international sources!');
    }
  };

  const silentLog = () => {}; // suppress log output during tests

  test('International source (TechCrunch) → fast path returns EN without AI call', async () => {
    const result = await classifyLanguage(mockGenAI, {
      sourceUrl: 'https://techcrunch.com/2026/09/10/openai-funding',
      facts: {
        summary: 'OpenAI raises $2.5B in new funding round',
        category: 'AI/ML',
        impact: 'Global',
        keyFacts: ['OpenAI valued at $150B', 'Led by Thrive Capital']
      },
      logFn: silentLog
    });

    assertEqual(result.language, 'en');
    assertEqual(result.confidence, 0.95);
    assertEqual(genAICalled, false, 'genAI should not have been called');
  });

  // Final results
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${'═'.repeat(50)}\n`);

  process.exit(failed > 0 ? 1 : 0);
})();
