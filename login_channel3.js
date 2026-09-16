const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');
const { google } = require('googleapis');
const { exec } = require('child_process');

const CLIENT_SECRET_PATH = path.join(__dirname, 'client_secret.json');
const TOKEN_CHANNEL3_PATH = path.join(__dirname, 'tokens_channel3.json');

if (!fs.existsSync(CLIENT_SECRET_PATH)) {
  console.error('❌ Không tìm thấy client_secret.json tại thư mục gốc!');
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
  prompt: 'select_account consent'
});

let server;
server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/oauth2callback')) {
      const qs = new url.URL(req.url, `http://localhost:${AUTH_PORT}`).searchParams;
      const code = qs.get('code');

      if (!code) {
        throw new Error('Không nhận được authorization code từ Google.');
      }

      const { tokens } = await oauth2Client.getToken(code);
      oauth2Client.setCredentials(tokens);

      // Lưu tokens vào tokens_channel3.json (bảo toàn 100% tokens.json và tokens_channel2.json)
      fs.writeFileSync(TOKEN_CHANNEL3_PATH, JSON.stringify(tokens, null, 2));

      // Lấy thông tin kênh mới để xác nhận
      const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
      let channelTitle = 'Kênh 3 (Curious Globe / US & International)';
      let channelId = '';
      let subCount = '0';
      let videoCount = '0';

      try {
        const chRes = await youtube.channels.list({ part: ['snippet', 'statistics'], mine: true });
        if (chRes.data.items && chRes.data.items.length > 0) {
          const ch = chRes.data.items[0];
          channelTitle = ch.snippet.title;
          channelId = ch.id;
          subCount = ch.statistics?.subscriberCount || '0';
          videoCount = ch.statistics?.videoCount || '0';
        }
      } catch (e) {
        console.warn('Không thể đọc thông tin chi tiết kênh:', e.message);
      }

      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html lang="vi">
        <head>
          <meta charset="UTF-8">
          <title>Kết Nối Kênh 3 Thành Công</title>
        </head>
        <body style="background: #0b0f19; color: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0;">
          <div style="text-align: center; max-width: 520px; padding: 40px; background: rgba(255,255,255,0.03); border: 1px solid rgba(0, 242, 254, 0.3); border-radius: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.8);">
            <div style="font-size: 54px; margin-bottom: 16px;">🎉</div>
            <h1 style="color: #00f2fe; font-size: 26px; margin: 0 0 10px 0;">KẾT NỐI KÊNH 3 THÀNH CÔNG!</h1>
            <h2 style="color: #fff; font-size: 20px; margin: 0 0 15px 0;">🇺🇸 Curious Globe: ${channelTitle}</h2>
            <div style="background: rgba(0,0,0,0.4); border-radius: 12px; padding: 15px; margin: 20px 0; text-align: left; font-size: 13px; line-height: 1.8; color: #cbd5e1;">
              <div><strong>• Channel ID:</strong> <span style="color: #38bdf8; font-family: monospace;">${channelId}</span></div>
              <div><strong>• Người đăng ký:</strong> ${Number(subCount).toLocaleString()} subs</div>
              <div><strong>• Tổng video:</strong> ${videoCount} videos</div>
              <div><strong>• File lưu trữ:</strong> <span style="color: #10b981; font-weight: bold;">tokens_channel3.json</span></div>
            </div>
            <p style="color: #94a3b8; font-size: 13px;">Kênh 1 (Thời Sự VN) và Kênh 2 (Kai Viet) vẫn được bảo toàn nguyên vẹn.</p>
            <p style="color: #10b981; font-weight: bold; margin-top: 25px;">✅ Bạn có thể đóng tab này và quay lại Dashboard.</p>
          </div>
        </body>
        </html>
      `);

      console.log('\n=============================================================');
      console.log(`🎉🎉🎉 KẾT NỐI THÀNH CÔNG KÊNH 3: "${channelTitle}" (ID: ${channelId})!`);
      console.log(`📊 Thống kê: ${subCount} subs • ${videoCount} videos`);
      console.log(`💾 Đã lưu token Kênh 3 vào: ${TOKEN_CHANNEL3_PATH}`);
      console.log('🔒 Token Kênh 1 (tokens.json) và Kênh 2 (tokens_channel2.json) bảo toàn 100%!');
      console.log('=============================================================\n');

      setTimeout(() => {
        server.close();
        process.exit(0);
      }, 1500);
    }
  } catch (err) {
    console.error('❌ Lỗi xác thực:', err);
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Lỗi xác thực: ' + err.message);
    setTimeout(() => {
      server.close();
      process.exit(1);
    }, 1000);
  }
}).listen(AUTH_PORT, () => {
  console.log('\n=============================================================');
  console.log('🔑 BẮT ĐẦU CẤP QUYỀN CHO KÊNH YOUTUBE THỨ 3 (CURIOUS GLOBE)');
  console.log('👉 Vui lòng đăng nhập tài khoản / chọn Kênh thứ 3 trong trình duyệt');
  console.log('=============================================================\n');
  console.log('Đang tự động mở trình duyệt...');
  console.log(`\nNếu trình duyệt không tự mở, hãy copy liên kết này dán vào Chrome:\n${authUrl}\n`);

  // Tự động mở trình duyệt trên Windows
  exec(`start "" "${authUrl}"`);
});
