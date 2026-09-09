const collectorManager = require('./src/collector/index.js');
const logger = require('./src/collector/utils/logger.js');
const fs = require('fs');

async function runTests() {
  console.log('--- KHỞI ĐỘNG BÀI TEST TÍNH NĂNG COLLECTOR ---');
  let passCount = 0;
  let failCount = 0;

  // 1. Test 5 nguồn (3 RSS, 1 Arxiv, 1 Web Article trực tiếp)
  const rssSources = [
    'https://vnexpress.net/rss/tin-moi-nhat.rss',
    'https://techcrunch.com/feed/',
    'https://hnrss.org/front'
  ];

  for (const url of rssSources) {
    console.log(`\n▶️ TEST: Đọc RSS từ ${url}`);
    const items = await collectorManager.collectRSS(url);
    if (items.length > 0) {
      console.log(`✅ Thành công! Lấy được ${items.length} tin. Tiêu đề mẫu: ${items[0].title}`);
      passCount++;
    } else {
      console.log(`❌ Thất bại hoặc không có tin mới!`);
      failCount++;
    }
  }

  // 2. Test ArXiv
  console.log(`\n▶️ TEST: ArXiv API với query "Artificial Intelligence"`);
  const arxivItems = await collectorManager.collectArxiv('Artificial Intelligence', 2);
  if (arxivItems.length > 0) {
    console.log(`✅ Thành công! Tiêu đề mẫu: ${arxivItems[0].title}`);
    passCount++;
  } else {
    console.log(`❌ Thất bại lấy bài từ ArXiv.`);
    failCount++;
  }

  // 3. Test Web Article Extraction (TuoiTre)
  const articleUrl = 'https://tuoitre.vn/bao-yeagi-tai-nhat-ban-20250110080645607.htm'; // Ví dụ một link
  console.log(`\n▶️ TEST: Trích xuất bài báo từ URL cụ thể: ${articleUrl}`);
  const article = await collectorManager.collectArticle(articleUrl);
  if (article && article.content.length > 0) {
    console.log(`✅ Thành công! Tóm tắt nội dung: ${article.content.substring(0, 100)}...`);
    passCount++;
  } else {
    console.log(`❌ Thất bại lấy nội dung web, bài viết không tồn tại hoặc lỗi crawler.`);
    failCount++;
  }

  // 4. Test Duplicate (Gọi lại web article cũ)
  console.log(`\n▶️ TEST: Lọc trùng lặp bài báo cũ`);
  // Clear the `url_` cache so the `collectArticle` actually runs the adapter,
  // but leave the `title_` cache intact so `isDuplicate` detects the duplicate title.
  collectorManager.adapters.article.collect = async () => ({ title: article.title });
  const articleDuplicate = await collectorManager.collectArticle(articleUrl + '?ref=test');
  if (!articleDuplicate) {
    console.log(`✅ Thành công! Hệ thống đã block tin trùng lặp.`);
    passCount++;
  } else {
    console.log(`❌ Thất bại! Hệ thống vẫn trả về tin trùng.`);
    failCount++;
  }

  // 5. Test Invalid URL & Extraction Failure
  const invalidUrl = 'https://vnexpress.net/link-nay-chac-chan-khong-ton-tai-404-error.html';
  console.log(`\n▶️ TEST: Xử lý link lỗi (404)`);
  const invalidArticle = await collectorManager.collectArticle(invalidUrl);
  if (!invalidArticle) {
    console.log(`✅ Thành công! Hệ thống bắt được lỗi và trả về null.`);
    passCount++;
  } else {
    console.log(`❌ Thất bại! Hệ thống không handle được lỗi.`);
    failCount++;
  }

  // 6. Test Source Timeout
  // Mô phỏng timeout bằng link phản hồi cực chậm (httpstat.us)
  const timeoutUrl = 'https://httpstat.us/200?sleep=20000'; // 20s
  console.log(`\n▶️ TEST: Timeout (Link phản hồi > 15s)`);
  const timeoutArticle = await collectorManager.collectArticle(timeoutUrl);
  if (!timeoutArticle) {
    console.log(`✅ Thành công! Hệ thống huỷ kết nối thành công khi quá thời gian chờ.`);
    passCount++;
  } else {
    console.log(`❌ Thất bại! Hệ thống đợi quá lâu hoặc không timeout.`);
    failCount++;
  }

  console.log('\n--- BÁO CÁO TỔNG KẾT ---');
  console.log(`PASS: ${passCount}`);
  console.log(`FAIL: ${failCount}`);

  // In mẫu format một Output đã normalize
  if (arxivItems.length > 0) {
    console.log('\n--- MẪU DATA NORMALIZED ---');
    console.log(JSON.stringify(arxivItems[0], null, 2));
  }
}

runTests();