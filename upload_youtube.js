const fs = require('fs');
const path = require('path');
const http = require('http');
const url = require('url');
const { google } = require('googleapis');
const { exec } = require('child_process');

const CLIENT_SECRET_PATH = path.join(__dirname, 'client_secret.json');
const TOKEN_PATH = path.join(__dirname, 'tokens.json');
const VIDEO_PATH = path.join(__dirname, 'out', 'auto_news_result.mp4');

// Scope for uploading videos
const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];

async function main() {
  if (!fs.existsSync(CLIENT_SECRET_PATH)) {
    console.error('\n❌ Không tìm thấy file "client_secret.json"!');
    console.log(`
👉 Vui lòng làm theo các bước sau để lấy file client_secret.json:
1. Vào Google Cloud Console: https://console.cloud.google.com/
2. Tạo một Project mới (hoặc chọn project có sẵn).
3. Vào menu "APIs & Services" > "Library" > Tìm "YouTube Data API v3" và nhấn "ENABLE".
4. Vào "APIs & Services" > "OAuth consent screen":
   - Chọn "External" và điền tên ứng dụng, email của bạn.
   - Ở mục "Test users", thêm địa chỉ Gmail của kênh YouTube bạn muốn upload.
5. Vào "APIs & Services" > "Credentials":
   - Nhấn "+ CREATE CREDENTIALS" > Chọn "OAuth client ID".
   - Application type: Chọn "Desktop app" (Ứng dụng trên máy tính tính) hoặc "Web application" với Redirect URI là:
     http://localhost:3000/oauth2callback
   - Tải file JSON vừa tạo về, đổi tên thành "client_secret.json" và đặt vào thư mục gốc của dự án này:
     ${__dirname}
`);
    process.exit(1);
  }

  if (!fs.existsSync(VIDEO_PATH)) {
    console.error(`\n❌ Không tìm thấy file video tại: ${VIDEO_PATH}`);
    process.exit(1);
  }

  const rawKey = JSON.parse(fs.readFileSync(CLIENT_SECRET_PATH, 'utf-8'));
  const credentials = rawKey.installed || rawKey.web;

  if (!credentials) {
    console.error('\n❌ Định dạng client_secret.json không hợp lệ.');
    process.exit(1);
  }

  const { client_id, client_secret } = credentials;
  // Dùng cổng 3050 để tránh bị trùng với Remotion Studio (cổng 3000) và Dashboard (cổng 4000)
  const AUTH_PORT = 3050;
  const redirectUri = `http://localhost:${AUTH_PORT}/oauth2callback`;

  const oauth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirectUri
  );

  // Check if token exists
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    oauth2Client.setCredentials(token);
    console.log('✅ Đã tìm thấy token xác thực cũ.');
  } else {
    console.log('🔑 Cần cấp quyền đăng nhập YouTube lần đầu...');
    await authenticate(oauth2Client, redirectUri, AUTH_PORT);
  }

  // Upload video
  console.log('\n🚀 Đang tải video lên YouTube Shorts...');
  const youtube = google.youtube({ version: 'v3', auth: oauth2Client });

  const fileSize = fs.statSync(VIDEO_PATH).size;

  // Đọc meta do người dùng nhập từ dashboard (nếu có)
  let videoTitle = 'Bản Tin Công Nghệ & Chuyển Đổi Số Việt Nam 2026 #shorts';
  let videoDesc = 'Bản Tin Công Nghệ & Chuyển Đổi Số Việt Nam\n#shorts #congnghe #chuyendoiso #ai #vietnam';
  let videoTags = ['shorts', 'công nghệ', 'chuyển đổi số', 'ai', 'việt nam'];
  let privacyStatus = 'public';
  let videoLanguage = 'vi'; // Default language

  const metaPath = path.join(__dirname, 'youtube_meta.json');
  if (fs.existsSync(metaPath)) {
    try {
      const customMeta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
      if (customMeta.title) videoTitle = customMeta.title;
      if (customMeta.description) videoDesc = customMeta.description;
      if (customMeta.tags && Array.isArray(customMeta.tags)) videoTags = customMeta.tags;
      if (customMeta.privacyStatus) privacyStatus = customMeta.privacyStatus;
      if (customMeta.language) videoLanguage = customMeta.language;
    } catch(e) {
      console.warn('Không thể đọc youtube_meta.json, sử dụng mặc định.');
    }
  }

  // Also try reading language from the dynamic_news.json (auto-detected)
  try {
    const dynamicJsonPath = path.join(__dirname, 'src', 'dynamic_news.json');
    if (fs.existsSync(dynamicJsonPath)) {
      const dynamicData = JSON.parse(fs.readFileSync(dynamicJsonPath, 'utf-8'));
      if (dynamicData.language) videoLanguage = dynamicData.language;
    }
  } catch(e) {}

  try {
    const res = await youtube.videos.insert(
      {
        part: 'snippet,status',
        requestBody: {
          snippet: {
            title: videoTitle,
            description: videoDesc,
            tags: videoTags,
            categoryId: '28', // Science & Technology
            defaultLanguage: videoLanguage,
            defaultAudioLanguage: videoLanguage,
          },
          status: {
            privacyStatus: privacyStatus, // 'public', 'unlisted', 'private'
            selfDeclaredMadeForKids: false,
          },
        },
        media: {
          body: fs.createReadStream(VIDEO_PATH),
        },
      },
      {
        onUploadProgress: (evt) => {
          const progress = (evt.bytesRead / fileSize) * 100;
          process.stdout.write(`\r📤 Tiến trình tải lên: ${Math.round(progress)}%`);
        },
      }
    );

    console.log('\n\n🎉 TẢI LÊN THÀNH CÔNG!');
    console.log(`🆔 Video ID: ${res.data.id}`);
    console.log(`🔗 Link xem YouTube Short: https://youtube.com/shorts/${res.data.id}`);
  } catch (error) {
    console.error('\n❌ Lỗi khi upload video:', error.message);
    if (error.errors) {
      console.error(error.errors);
    }
  }
}

function authenticate(oauth2Client, redirectUri, port) {
  return new Promise((resolve, reject) => {
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    });

    const parsedRedirect = url.parse(redirectUri);

    const server = http
      .createServer(async (req, res) => {
        try {
          if (req.url.startsWith(parsedRedirect.pathname || '/oauth2callback')) {
            const qs = new url.URL(req.url, `http://localhost:${port}`).searchParams;
            const code = qs.get('code');

            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(`
              <div style="text-align: center; margin-top: 50px; font-family: sans-serif;">
                <h1 style="color: #22c55e;">Xác thực thành công!</h1>
                <p>Bạn có thể đóng tab này và quay lại cửa sổ lệnh.</p>
              </div>
            `);
            server.destroy();

            const { tokens } = await oauth2Client.getToken(code);
            oauth2Client.setCredentials(tokens);
            fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
            console.log('✅ Đã lưu token đăng nhập vào "tokens.json"!');
            resolve(tokens);
          }
        } catch (e) {
          reject(e);
        }
      })
      .listen(port, () => {
        console.log('\n🌐 Vui lòng mở trình duyệt và đăng nhập đường dẫn sau để cấp quyền:');
        console.log(`\n👉 ${authUrl}\n`);

        // Tự động mở trình duyệt trên Windows
        exec(`start "" "${authUrl}"`);
      });

    // Handle destroy
    server.destroy = function () {
      server.close();
    };
  });
}

main();
