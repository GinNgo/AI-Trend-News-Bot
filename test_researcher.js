const { EvidenceResearcher } = require('./src/ai/researcher');
const fs = require('fs');

async function testHallucination() {
  console.log('--- KHỞI ĐỘNG BÀI TEST GEMINI RESEARCH PIPELINE (HALLUCINATION TEST) ---');

  // Khởi tạo config
  const config = JSON.parse(fs.readFileSync('config.json'));
  const researcher = new EvidenceResearcher(config.GEMINI_API_KEY);

  // Tạo dữ liệu mồi cố tình THIẾU SỐ LIỆU và THIẾU BẰNG CHỨNG
  const syntheticArticles = [
    {
      sourceId: 'src_001',
      sourceName: 'WebArticle',
      url: 'https://fake-news.com/tech-boom',
      content: 'Công ty ABC vừa ra mắt một sản phẩm mới. Giám đốc cho biết sản phẩm rất tuyệt vời và có nhiều người mua. Gần đây trên mạng đồn rằng công ty này đã đạt doanh thu tỷ đô, nhưng công ty từ chối bình luận.'
    }
  ];

  console.log('\n▶️ TEST 1: Cố tình bóc tách Claim từ dữ liệu thiếu bằng chứng');
  try {
    const rawData = await researcher.extractClaims(syntheticArticles);
    console.log('✅ Bước Extract thành công. RAW CLAIMS:');
    rawData.claims.forEach(c => {
      console.log(` - Mệnh đề: "${c.statement}"`);
      console.log(` - Status do AI đánh giá: ${c.status}`);
      console.log(` - Evidence: ${c.evidence.length} nguồn`);
    });

    console.log('\n▶️ TEST 2: Đưa qua Fact-checker (Evidence Mapping)');
    const factCheckedData = researcher.factCheckClaims(rawData);

    console.log(`\n📊 VERIFIED CLAIMS (${factCheckedData.verifiedClaims.length}):`);
    factCheckedData.verifiedClaims.forEach(c => console.log(`   + ${c.statement}`));

    console.log(`\n🚫 UNVERIFIED CLAIMS (${factCheckedData.unverifiedClaims.length}):`);
    factCheckedData.unverifiedClaims.forEach(c => console.log(`   - ${c.statement}`));

    // Nếu tin đồn tỷ đô nằm trong Verified, đó là lỗi Hallucination
    const hasHallucination = factCheckedData.verifiedClaims.some(c => c.statement.toLowerCase().includes('tỷ đô'));
    if (hasHallucination) {
      console.log('\n❌ THẤT BẠI: Model đã Hallucinate và đưa tin đồn vào Verified Claims!');
    } else {
      console.log('\n✅ THÀNH CÔNG: Model đã loại bỏ tin đồn (không có evidence) khỏi danh sách Verified Claims.');
    }

    console.log('\n▶️ TEST 3: Generate Story Package (Test Zod Schema Validation)');
    const impactData = await researcher.analyzeImpact(factCheckedData);
    const story = await researcher.packageStory(factCheckedData, impactData);

    console.log(`\n✅ THÀNH CÔNG: Kịch bản được tạo và PASS Zod Validation.`);
    console.log(`Tiêu đề: ${story.title}`);
    console.log(`Số Scenes: ${story.scenes.length}`);

    // Kiểm tra xem Voiceover có chứa tin đồn không
    const scriptText = story.scenes.map(s => s.voiceover).join(' ').toLowerCase();
    if (scriptText.includes('tỷ đô')) {
       console.log('\n❌ THẤT BẠI: Mặc dù loại khỏi Verified Claims, kịch bản (Voiceover) vẫn chứa thông tin hallucinate.');
    } else {
       console.log('\n✅ THÀNH CÔNG: Voiceover tuân thủ nghiêm ngặt dữ liệu VERIFIED, không bịa thông tin.');
    }

  } catch (error) {
    console.error('\n❌ LỖI TRONG QUÁ TRÌNH CHẠY PIPELINE:', error.message);
  }
}

testHallucination();