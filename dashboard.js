const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const app = express();

let logClients = [];
app.get('/api/logs', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  logClients.push(res);
  req.on('close', () => {
    logClients = logClients.filter(c => c !== res);
  });
});
function broadcastLog(msg) {
  console.log(msg);
  logClients.forEach(c => c.write(`data: ${JSON.stringify({ message: msg })}

`));
}

const PORT = 4000;

app.use(express.static('public'));
app.use(express.json({ limit: '50mb' }));
// Also serve the out directory to preview the video
app.use('/out', express.static(path.join(__dirname, 'out')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.post('/api/prepare', (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Missing content' });

  // Save long text to a temporary file
  const tempPath = path.join(__dirname, 'temp_input.txt');
  fs.writeFileSync(tempPath, content, 'utf-8');
  res.json({ ok: true, file: 'temp_input.txt' });
});

app.get('/api/run', (req, res) => {
  const target = req.query.target; // Either a URL or "temp_input.txt"
  if (!target) return res.status(400).send('Missing target');

  // Set headers for Server-Sent Events (SSE)
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const sendEvent = (type, data) => {
    res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
  };

  sendEvent('log', { message: '🚀 Đã tiếp nhận yêu cầu đầu vào.' });

  // SPAWN AUTO PIPELINE
  sendEvent('step', { step: 'crawler', status: 'running', info: 'Đang xử lý đầu vào...' });
  const child = spawn('node', ['auto_pipeline.js', target], { cwd: __dirname });

  child.stdout.on('data', (data) => {
    const text = data.toString();
    const lines = text.split('\n').filter(l => l.trim().length > 0);

    lines.forEach(line => {
      sendEvent('log', { message: line });

      if (line.includes('BƯỚC 1: Đang cào dữ liệu')) {
        sendEvent('step', { step: 'crawler', status: 'running', info: 'Đang trích xuất văn bản...' });
      }
      if (line.includes('Lấy thành công')) {
        sendEvent('step', { step: 'crawler', status: 'success', info: 'Đã cào xong văn bản sạch.' });
        sendEvent('step', { step: 'ai', status: 'running', info: 'Đang gửi sang Gemini 3.x...' });
      }
      if (line.includes('Đang thử kết nối model:')) {
        const modelMatch = line.match(/model:\s*(.+)\.\.\./);
        if (modelMatch) {
          sendEvent('step', { step: 'ai', status: 'running', info: `Đang kết nối: ${modelMatch[1]}` });
        }
      }
      if (line.includes('AI đã chia thành')) {
        const match = line.match(/thành (\d+) cảnh/);
        sendEvent('step', { step: 'ai', status: 'success', info: `Tạo kịch bản ${match ? match[1] : 'N'} cảnh.` });
        sendEvent('step', { step: 'tts', status: 'running', info: 'Khởi động Neural Edge-TTS...' });
      }
      if (line.includes('Đồng bộ Frame hoàn tất')) {
        sendEvent('step', { step: 'tts', status: 'success', info: 'Audio sync hoàn tất.' });
        sendEvent('step', { step: 'render', status: 'running', info: 'Render Remotion GPU...' });
      }
      // Remotion progress comes from stdout usually with percentage, but we just wait
      if (line.includes('HOÀN TẤT PIPELINE')) {
        sendEvent('step', { step: 'render', status: 'success', info: 'Render xong: auto_news_result.mp4' });
      }
    });
  });

  child.stderr.on('data', (data) => {
    sendEvent('log', { message: '⚠️ ' + data.toString().trim() });
  });

  child.on('close', (code) => {
    if (code !== 0) {
      sendEvent('error', { message: `Tiến trình kết thúc với mã lỗi ${code}` });
      res.end();
      return;
    }

    sendEvent('log', { message: '🎬 Render xong! Mời bạn xem trước video và xác nhận đăng.' });

    // Đọc thông tin kịch bản AI đã sinh ra để làm metadata gợi ý cho YouTube
    let aiMeta = null;
    try {
      const jsonStr = fs.readFileSync(path.join(__dirname, 'src', 'dynamic_news.json'), 'utf-8');
      aiMeta = JSON.parse(jsonStr);
    } catch(e) {}

    // Dừng tiến trình tự động, chuyển sang trạng thái chờ Duyệt (Review)
    sendEvent('step', { step: 'youtube', status: 'idle', info: 'Chờ duyệt đăng...' });

    // Gửi event done kèm url và metadata cho giao diện
    sendEvent('done', {
      videoUrl: '/out/auto_news_result.mp4',
      metadata: aiMeta
    });
    res.end();
  });

});

app.get('/api/check-youtube', (req, res) => {
  if (fs.existsSync(path.join(__dirname, 'tokens.json'))) {
    res.json({ authorized: true });
  } else {
    res.json({ authorized: false });
  }
});

app.post('/api/auth-youtube', (req, res) => {
  const child = spawn('node', ['upload_youtube.js'], { cwd: __dirname });
  // It will open the browser automatically.
  res.json({ ok: true, message: 'Đã mở trình duyệt đăng nhập YouTube! Vui lòng kiểm tra các cửa sổ Chrome.' });
});

app.post('/api/confirm-upload', (req, res) => {
  const { title, description, tags, privacyStatus } = req.body;
  if (!title || !description) return res.status(400).json({ error: 'Thiếu tiêu đề hoặc mô tả' });

  // Lưu thông tin meta vào file để upload_youtube.js đọc
  fs.writeFileSync(path.join(__dirname, 'youtube_meta.json'), JSON.stringify({
    title, description, tags, privacyStatus
  }, null, 2), 'utf-8');

  // Gửi lại event stream cho tiến trình upload
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  const sendEvent = (type, data) => res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);

  sendEvent('log', { message: '🚀 Bắt đầu quá trình tải video lên YouTube...' });
  sendEvent('step', { step: 'youtube', status: 'running', info: 'Đang upload...' });

  const child = spawn('node', ['upload_youtube.js'], { cwd: __dirname });
  child.stdout.on('data', (d) => {
    const text = d.toString().trim();
    if (text) {
      sendEvent('log', { message: '[YT] ' + text });
      if (text.includes('TẢI LÊN THÀNH CÔNG')) {
         sendEvent('step', { step: 'youtube', status: 'success', info: 'Đăng thành công!' });
      }
      if (text.includes('Link xem YouTube Short')) {
         const match = text.match(/https:\/\/youtube\.com\/shorts\/\S+/);
         if (match) {
            sendEvent('done', { shortUrl: match[0] });
         }
      }
    }
  });

  child.stderr.on('data', (d) => {
    sendEvent('log', { message: '⚠️ ' + d.toString().trim() });
  });

  child.on('close', (code) => {
    if (code !== 0) {
      sendEvent('error', { message: `Upload kết thúc với mã lỗi ${code}` });
    }
    res.end();
  });
});

// ============================================
// AUTO-TREND BOT INTEGRATION
// ============================================
let trendBotInterval = null;
let trendBotStatus = false;
let trendBotLastRun = null;
let trendBotNextRun = null;
let isBotExecuting = false;

// Đọc động require để không bị lỗi nếu trend_bot.js chưa có
let trendBot;
try {
  trendBot = require('./trend_bot');
} catch (e) {
  console.warn("Chưa tải được trend_bot.js");
}

app.get('/api/bot/status', (req, res) => {
  res.json({
    active: trendBotStatus,
    lastRun: trendBotLastRun,
    nextRun: trendBotNextRun,
    history: trendBot ? trendBot.getHistory() : null
  });
});

app.post('/api/bot/toggle', (req, res) => {
  trendBotStatus = !trendBotStatus;

  if (trendBotStatus) {
    console.log('\n🤖 Bật Auto Trend Bot! Đang lên lịch chạy mỗi 10 phút.');
    executeTrendCheck(); // Chạy ngay lần đầu
    trendBotInterval = setInterval(executeTrendCheck, 10 * 60 * 1000); // 10 phút
  } else {
    console.log('\n🛑 Tắt Auto Trend Bot.');
    if (trendBotInterval) clearInterval(trendBotInterval);
    trendBotNextRun = null;
  }

  res.json({ active: trendBotStatus, nextRun: trendBotNextRun });
});

async function executeTrendCheck() {
  if (isBotExecuting || !trendBotStatus) return;
  isBotExecuting = true;
  trendBotLastRun = new Date().toISOString();
  trendBotNextRun = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  console.log(`\n[AUTO TREND BOT] 🔍 Đang quét tin lúc ${new Date().toLocaleTimeString()}...`);

  try {
    const result = await trendBot.runTrendCheck((msg) => broadcastLog(msg));

    if (result && trendBotStatus) {
      console.log(`\n[BOT] 🎬 Bắt đầu render Video TỰ ĐỘNG cho bài: ${result.title}`);

      const child = spawn('node', ['auto_pipeline.js', result.link], { cwd: __dirname });
      child.stdout.on('data', (d) => process.stdout.write(`[BOT-PIPELINE] ${d}`));
      child.stderr.on('data', (d) => process.stderr.write(`[BOT-PIPELINE-ERR] ${d}`));

      child.on('close', (code) => {
        if (code === 0 && trendBotStatus) {
          console.log(`\n[BOT] ✅ Render xong! Chuẩn bị Đăng YouTube Tự động...`);

          fs.writeFileSync(path.join(__dirname, 'youtube_meta.json'), JSON.stringify({
            title: `${result.title.substring(0, 80)} #shorts`,
            description: `Bản Tin Nóng: ${result.title}\n\n${result.reason}\n\nNguồn: ${result.link}\n\n#shorts #tintuc #xuhuong #vietnam #news`,
            tags: ['shorts', 'tin tức', 'xu hướng', 'việt nam', 'news'],
            privacyStatus: 'public'
          }, null, 2), 'utf-8');

          const yt = spawn('node', ['upload_youtube.js'], { cwd: __dirname });
          yt.stdout.on('data', (d) => process.stdout.write(`[BOT-YT] ${d}`));
          yt.on('close', (ytCode) => {
             if (ytCode === 0) {
               console.log(`\n[BOT] 🎉 Đã XUẤT BẢN THÀNH CÔNG lên YouTube! Lưu vào lịch sử.`);
               trendBot.recordPublished(result.title, result.link);
             }
             isBotExecuting = false;
          });
        } else {
          isBotExecuting = false;
        }
      });
    } else {
      isBotExecuting = false;
    }
  } catch (err) {
    console.error(`[BOT] Lỗi:`, err);
    isBotExecuting = false;
  }
}

app.listen(PORT, () => {
  console.log(`\n==============================================`);
  console.log(`🚀 DASHBOARD TRỰC QUAN ĐANG CHẠY TẠI: http://localhost:${PORT}`);
  console.log(`==============================================\n`);
});
