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
    const res = await fetch(`https://graph.facebook.com/v19.0/me?access_token=${newToken}`);
    const data = await res.json();

    if (data.error) {
      console.log(`❌ Token không hợp lệ: ${data.error.message}`);
      rl.close();
      return;
    }

    console.log(`✅ Token hợp lệ! Xin chào: ${data.name || data.id}`);

    // Cập nhật vào config.json
    config.META_ACCESS_TOKEN = newToken;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

    console.log('💾 Đã lưu META_ACCESS_TOKEN mới vào config.json thành công!');
    console.log('🎉 Bạn có thể quay lại Dashboard và bấm nút [🔌 Test] để kiểm tra!');
  } catch (err) {
    console.error('❌ Lỗi kết nối:', err.message);
  } finally {
    rl.close();
  }
});
