const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');
const { google } = require('googleapis');
const { exec } = require('child_process');

const CLIENT_SECRET_PATH = path.join(__dirname, 'client_secret.json');
const TOKEN_CHANNEL2_PATH = path.join(__dirname, 'tokens_channel2.json');

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

let server;
server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/oauth2callback')) {
      const qs = new url.URL(req.url, `http://localhost:${AUTH_PORT}`).searchParams;
      const code = qs.get('code');

      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      // Lưu tokens vào tokens_channel2.json (bảo toàn 100% tokens.json của Kênh 1)
      fs.writeFileSync(TOKEN_CHANNEL2_PATH, JSON.stringify(tokens, null, 2));

      // Lấy thông tin kênh mới để xác nhận
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
      let channelTitle = 'Kênh 2 (Công Nghệ / Quốc Tế)';
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
          <h1 style="color: #10b981; font-size: 28px;">🎉 KẾT NỐI KÊNH 2 THÀNH CÔNG!</h1>
          <h2 style="color: #3b82f6;">🚀 Kênh Tech & Quốc Tế: ${channelTitle}</h2>
          <p style="color: #6b7280; font-size: 14px;">ID Kênh: ${channelId}</p>
          <p style="color: #10b981; font-weight: bold;">File lưu: tokens_channel2.json</p>
          <p style="margin-top: 20px; font-size: 16px;">Kênh 1 (Thời Sự VN) vẫn được bảo toàn nguyên vẹn tại tokens.json.</p>
          <p>Bạn có thể đóng tab này và quay lại Dashboard.</p>
        </div>
      `);

      console.log('\n=============================================================');
      console.log(`🎉🎉🎉 KẾT NỐI THÀNH CÔNG KÊNH 2: "${channelTitle}" (ID: ${channelId})!`);
      console.log(`💾 Đã lưu token Kênh 2 vào: ${TOKEN_CHANNEL2_PATH}`);
      console.log('🔒 Token Kênh 1 (tokens.json) vẫn được bảo vệ nguyên vẹn 100%!');
      console.log('=============================================================\n');

      setTimeout(() => {
        server.close();
        process.exit(0);
      }, 1000);
    }
  } catch (err) {
    console.error('❌ Lỗi xác thực:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`Lỗi xác thực: ${err.message}`);
    setTimeout(() => {
      server.close();
      process.exit(1);
    }, 1000);
  }
}).listen(AUTH_PORT, () => {
  console.log('\n=============================================================');
  console.log('🔑 BẮT ĐẦU CẤP QUYỀN CHO KÊNH YOUTUBE THỨ 2 (TECH & GLOBAL)');
  console.log('👉 Vui lòng đăng nhập tài khoản / chọn Kênh thứ 2 trong trình duyệt');
  console.log('=============================================================\n');
  console.log('Đang tự động mở trình duyệt...');
  console.log(`\nNếu trình duyệt không tự mở, hãy copy liên kết này dán vào Chrome:\n${authUrl}\n`);

  // Tự động mở trình duyệt trên Windows
  exec(`start "" "${authUrl}"`);
});
