const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const configPath = path.join(__dirname, 'config.json');
let config = {};
if (fs.existsSync(configPath)) {
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (e) {}
}

console.log(`
=====================================================
🔑 CÔNG CỤ CẬP NHẬT FACEBOOK ACCESS TOKEN TỰ ĐỘNG
=====================================================
`);

rl.question('👉 Hãy dán Access Token mới (lấy từ Graph API Explorer) vào đây:\n> ', async (token) => {
  const newToken = token.trim();
  if (!newToken) {
    console.log('❌ Bạn chưa nhập Token. Đã hủy.');
    rl.close();
    return;
  }

  console.log('\n🔍 Đang kiểm tra token với Meta Graph API...');
  try {
    const { inspectAndResolvePageToken } = require('./src/publishing/providers/meta_token_helper');
    const result = await inspectAndResolvePageToken(newToken, config.META_PAGE_ID);

    if (!result.ok) {
      console.log(`❌ ${result.message || result.error}`);
      rl.close();
      return;
    }

    console.log(`\n${result.message}`);

    // Cập nhật vào config.json với token đã được trích xuất (Page token vĩnh viễn)
    config.META_ACCESS_TOKEN = result.token;
    if (result.pageId && !config.META_PAGE_ID) {
      config.META_PAGE_ID = result.pageId;
    }
    config.ENABLE_FACEBOOK = true;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

    console.log('💾 Đã lưu META_ACCESS_TOKEN (Vĩnh viễn) vào config.json thành công!');
    console.log('🎉 Hệ thống đã sẵn sàng tự động xuất bản Facebook Reels & Fanpage!');
  } catch (err) {
    console.error('❌ Lỗi xử lý token:', err.message);
  } finally {
    rl.close();
  }
});
