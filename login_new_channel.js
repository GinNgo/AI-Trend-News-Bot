const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');
const { google } = require('googleapis');
const { exec } = require('child_process');

const CLIENT_SECRET_PATH = path.join(__dirname, 'client_secret.json');
const TOKEN_PATH = path.join(__dirname, 'tokens.json');
const BACKUP_TOKEN_PATH = path.join(__dirname, 'tokens_backup_old.json');

// Backup old token if exists
if (fs.existsSync(TOKEN_PATH) && !fs.existsSync(BACKUP_TOKEN_PATH)) {
  fs.copyFileSync(TOKEN_PATH, BACKUP_TOKEN_PATH);
  console.log('📦 Đã sao lưu token kênh cũ sang: tokens_backup_old.json');
}

if (!fs.existsSync(CLIENT_SECRET_PATH)) {
  console.error('❌ Không tìm thấy client_secret.json!');
  process.exit(1);
}

const rawKey = JSON.parse(fs.readFileSync(CLIENT_SECRET_PATH, 'utf-8'));
const credentials = rawKey.installed || rawKey.web;
const { client_id, client_secret } = credentials;

const AUTH_PORT = 3050;
const redirectUri = `http://localhost:${AUTH_PORT}/oauth2callback`;

const oauth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  redirectUri
);

const SCOPES = [
  'https://www.googleapis.com/auth/youtube.upload',
  'https://www.googleapis.com/auth/youtube.readonly'
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: SCOPES,
  prompt: 'select_account consent' // Buộc Google hiển thị danh sách chọn tài khoản & kênh mới
});

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/oauth2callback')) {
      const qs = new url.URL(req.url, `http://localhost:${AUTH_PORT}`).searchParams;
      const code = qs.get('code');

      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      // Lưu tokens mới vào cả 2 dự án
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
      const autoVideoCreatorTokens = path.join('C:', 'Projects', 'Auto_Video_Creator', 'tokens.json');
      fs.writeFileSync(autoVideoCreatorTokens, JSON.stringify(tokens, null, 2));

      // Lấy thông tin kênh mới để xác nhận
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
      let channelTitle = 'Kênh Mới';
      let channelId = '';
      try {
        const chRes = await youtube.channels.list({ part: ['snippet', 'statistics'], mine: true });
        if (chRes.data.items && chRes.data.items.length > 0) {
          channelTitle = chRes.data.items[0].snippet.title;
          channelId = chRes.data.items[0].id;
        }
      } catch (e) {}

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <div style="text-align: center; margin-top: 60px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
          <h1 style="color: #10b981; font-size: 28px;">🎉 KẾT NỐI KÊNH MỚI THÀNH CÔNG!</h1>
          <h2 style="color: #3b82f6;">Kênh: ${channelTitle}</h2>
          <p style="color: #6b7280; font-size: 14px;">ID Kênh: ${channelId}</p>
          <p style="margin-top: 20px; font-size: 16px;">Bạn có thể đóng tab này và quay lại Antigravity để tiếp tục.</p>
        </div>
      `);

      console.log('\n=============================================================');
      console.log(`🎉🎉🎉 KẾT NỐI THÀNH CÔNG KÊNH MỚI: "${channelTitle}" (ID: ${channelId})!`);
      console.log(`💾 Đã lưu token mới vào: ${TOKEN_PATH}`);
      console.log('=============================================================\n');

      server.destroy();
      process.exit(0);
    }
  } catch (err) {
    console.error('❌ Lỗi xác thực:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Lỗi xác thực: ${err.message}`);
    server.destroy();
    process.exit(1);
  }
}).listen(AUTH_PORT, () => {
  console.log('\n=============================================================');
  console.log('🔑 BẮT ĐẦU CẤP QUYỀN CHO KÊNH YOUTUBE MỚI');
  console.log('=============================================================');
  console.log('👉 Trình duyệt sẽ tự động mở trang đăng nhập Google.');
  console.log('👉 Nếu trình duyệt không tự mở, hãy copy đường link sau dán vào Chrome:\n');
  console.log(authUrl);
  console.log('\n⏳ Đang đợi bạn chọn tài khoản và chấp thuận quyền...');

  // Mở trình duyệt mặc định trên Windows
  exec(`start "" "${authUrl}"`);
});

server.destroy = function () {
  server.close();
};
