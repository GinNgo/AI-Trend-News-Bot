const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getDb } = require('./src/storage/db.js');
const { JobRepository } = require('./src/storage/repositories/JobRepository.js');
const { Publisher } = require('./src/publishing/publisher.js');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.static('public'));
app.use(express.json({ limit: '50mb' }));
app.use('/out', express.static(path.join(__dirname, 'out')));

const jobRepo = new JobRepository();
const publisher = new Publisher();

// Khởi động worker nội bộ để xử lý hàng đợi
const { DurableWorker } = require('./src/scheduler/worker.js');
const worker = new DurableWorker(5000);
worker.start();

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// KEEP API PREPARE FOR FRONTEND COMPATIBILITY
app.post('/api/prepare', (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Missing content' });

  const tempPath = path.join(__dirname, 'temp_input.txt');
  fs.writeFileSync(tempPath, content, 'utf-8');
  res.json({ ok: true, file: 'temp_input.txt' });
});

app.get('/api/run', (req, res) => {
  const target = req.query.target;
  if (!target) return res.status(400).send('Missing target');

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
        sendEvent('step', { step: 'ai', status: 'running', info: 'Đang gửi sang AI Pipeline...' });
      }
      if (line.includes('Đang thử kết nối model:')) {
        const modelMatch = line.match(/model:\s*(.+)\.\.\./);
        if (modelMatch) {
          sendEvent('step', { step: 'ai', status: 'running', info: `Đang kết nối: ${modelMatch[1]}` });
        }
      }
      if (line.includes('AI đã viết kịch bản')) {
        sendEvent('step', { step: 'ai', status: 'success', info: `Tạo kịch bản hoàn tất.` });
        sendEvent('step', { step: 'tts', status: 'running', info: 'Khởi động Neural Edge-TTS...' });
      }
      if (line.includes('Đồng bộ Frame hoàn tất')) {
        sendEvent('step', { step: 'tts', status: 'success', info: 'Audio sync hoàn tất.' });
        sendEvent('step', { step: 'render', status: 'running', info: 'Render Remotion GPU...' });
      }
      if (line.includes('BƯỚC 5: ĐANG CHUẨN BỊ PUBLISH LÊN ĐA NỀN TẢNG')) {
        sendEvent('step', { step: 'render', status: 'success', info: 'Render xong: auto_news_result.mp4' });
        sendEvent('step', { step: 'youtube', status: 'running', info: 'Đang phân phối (Multi-Platform)...' });
      }
      if (line.includes('QUÁ TRÌNH PHÂN PHỐI ĐÃ HOÀN TẤT')) {
        sendEvent('step', { step: 'youtube', status: 'success', info: 'Đăng Đa nền tảng OK.' });
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

    sendEvent('log', { message: '🎬 Quy trình hoàn tất! Mời bạn xem trước video.' });

    let aiMeta = null;
    try {
      const dbData = fs.readFileSync(path.join(__dirname, 'src', 'dynamic_news.json'), 'utf-8');
      aiMeta = JSON.parse(dbData);
    } catch (e) {}

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
  res.json({ ok: true, message: 'Đã mở trình duyệt đăng nhập YouTube! Vui lòng kiểm tra cửa sổ trình duyệt (Chrome/Edge).' });
});

app.post('/api/jobs', (req, res) => {
  const { sourceUrl, content } = req.body;
  if (!sourceUrl && !content) return res.status(400).json({ error: 'Missing sourceUrl or content' });

  const jobId = `JOB-${Date.now()}`;
  jobRepo.createJob({
    jobId,
    stage: 'COLLECTING',
    payload: { sourceUrl, content }
  });
  res.json({ ok: true, jobId });
});

app.get('/api/jobs', (req, res) => {
  const db = getDb();
  const jobs = db.prepare('SELECT * FROM jobs ORDER BY createdAt DESC LIMIT 50').all();
  res.json(jobs);
});

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

setInterval(() => {
  const db = getDb();
  const recentJobs = db.prepare('SELECT jobId, stage, status, updatedAt FROM jobs ORDER BY updatedAt DESC LIMIT 5').all();
  const publications = db.prepare('SELECT publicationId, platform, status, url FROM publications ORDER BY updatedAt DESC LIMIT 10').all();

  const msg = JSON.stringify({
    type: 'status_sync',
    jobs: recentJobs,
    publications: publications
  });

  logClients.forEach(c => c.write(`data: ${msg}\n\n`));
}, 2000);

// ============================================
// AUTO-TREND BOT INTEGRATION
// ============================================
let trendBotInterval = null;
let trendBotStatus = false;
let trendBotLastRun = null;
let trendBotNextRun = null;
let isBotExecuting = false;

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
    const result = await trendBot.runTrendCheck((msg) => console.log(msg));

    if (result && trendBotStatus) {
      console.log(`\n[BOT] 🎬 Bắt đầu render Video TỰ ĐỘNG cho bài: ${result.title}`);

      // Ghi thẳng vào SQLite theo luồng V2
      const jobId = `JOB-BOT-${Date.now()}`;
      jobRepo.createJob({
        jobId,
        stage: 'COLLECTING',
        payload: { sourceUrl: result.link, content: null }
      });
      console.log(`[BOT] Đã đưa vào SQLite Job Queue (V2): ${jobId}`);

      trendBot.recordPublished(result.title, result.link);
    }
  } catch (err) {
    console.error(`[BOT] Lỗi:`, err);
  } finally {
    isBotExecuting = false;
  }
}


// ============================================
// SETTINGS & MULTI-PLATFORM PUBLISHER CONFIG
// ============================================
const configPath = path.join(__dirname, 'config.json');

app.get('/api/settings', (req, res) => {
  let conf = {};
  if (fs.existsSync(configPath)) {
    try {
      conf = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch(e) {}
  }
  res.json(conf);
});

app.post('/api/settings', (req, res) => {
  let conf = {};
  if (fs.existsSync(configPath)) {
    try {
      conf = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch(e) {}
  }
  
  const updatedConf = { ...conf, ...req.body };
  fs.writeFileSync(configPath, JSON.stringify(updatedConf, null, 2), 'utf-8');
  res.json({ ok: true, settings: updatedConf });
});

app.post('/api/publish-queue', async (req, res) => {
  try {
    const { Publisher } = require('./src/publishing/publisher.js');
    const pub = new Publisher();
    await pub.processQueue();
    res.json({ ok: true, message: 'Đã kích hoạt đẩy hàng đợi Đa nền tảng.' });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/publish-queue/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM publications WHERE publicationId = ?').run(req.params.id);
    res.json({ ok: true, message: 'Đã xóa khỏi hàng đợi.' });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/publish-queue', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM publications').run();
    res.json({ ok: true, message: 'Đã dọn dẹp toàn bộ hàng đợi.' });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});


app.get('/api/last-error', (req, res) => {
  const errorFile = path.join(__dirname, 'data', 'last_error.json');
  if (fs.existsSync(errorFile)) {
    try {
      const errData = JSON.parse(fs.readFileSync(errorFile, 'utf-8'));
      return res.json(errData);
    } catch(e) {}
  }
  res.json({ status: 'NONE' });
});



// ============================================
// HỢP NHẤT: AUTONOMOUS TREND ENGINE & UI CACHE
// (Chạy ngầm độc lập 24/7, Giao diện Dashboard chỉ hiển thị & tương tác)
// ============================================
let cachedTrends = null;
let trendScanning = false;

async function runAutonomousTrendCycle() {
  if (trendScanning) return;
  trendScanning = true;
  
  let conf = {};
  if (fs.existsSync(configPath)) {
    try { conf = JSON.parse(fs.readFileSync(configPath, 'utf-8')); } catch(e) {}
  }

  const timeoutSec = conf.AUTO_DECISION_TIMEOUT_SECONDS === undefined ? 300 : parseInt(conf.AUTO_DECISION_TIMEOUT_SECONDS, 10);
  const autoAction = conf.AUTO_DECISION_ACTION || 'auto_pick';

  try {
    const { getTrendSuggestions } = require('./trend_bot.js');
    console.log("[TREND-ENGINE] 📡 Bắt đầu chu kỳ quét tin tức tự động...");
    const result = await getTrendSuggestions(console.log);

    if (result && result.status === 'SUCCESS' && result.suggestions.length > 0) {
      console.log(`[TREND-ENGINE] 🔥 Tìm thấy ${result.suggestions.length} tin tức xu hướng HOT!`);
      cachedTrends = {
        fetchTime: Date.now(),
        data: result,
        autoAction: autoAction,
        timeoutSec: timeoutSec,
        expiresAt: Date.now() + (timeoutSec * 1000),
        actionTaken: false
      };
    } else {
      console.log("[TREND-ENGINE] 💤 Chưa có tin tức nào đạt điểm HOT trong chu kỳ này.");
      cachedTrends = {
        fetchTime: Date.now(),
        data: result || { status: 'NO_HOT_NEWS', suggestions: [] },
        autoAction: autoAction,
        timeoutSec: timeoutSec,
        expiresAt: Date.now(),
        actionTaken: true
      };
    }
  } catch (err) {
    console.error("[TREND-ENGINE] ❌ Lỗi quét tin:", err.message);
  } finally {
    trendScanning = false;
  }
}

// Kiểm tra đếm ngược mỗi 5 giây ở server (hoạt động ngay cả khi tắt trình duyệt)
setInterval(() => {
  if (!cachedTrends || cachedTrends.actionTaken) return;
  
  const remaining = Math.floor((cachedTrends.expiresAt - Date.now()) / 1000);
  if (remaining <= 0 && cachedTrends.timeoutSec > 0) {
    cachedTrends.actionTaken = true;
    if (cachedTrends.autoAction === 'auto_pick' && cachedTrends.data && cachedTrends.data.suggestions && cachedTrends.data.suggestions.length > 0) {
      const topNews = cachedTrends.data.suggestions[0];
      console.log(`\n⚡ [TREND-ENGINE] Hết hạn chờ người dùng! Tự động chọn TOP 1: "${topNews.title}"`);
      console.log(`🚀 [TREND-ENGINE] Kích hoạt Pipeline sản xuất video: ${topNews.link}`);
      
      const { spawn } = require('child_process');
      const child = spawn(process.execPath, ['auto_pipeline.js', topNews.link], {
        detached: true,
        stdio: 'inherit'
      });
      child.unref();
      
      // Ghi nhận lịch sử
      const { recordPublished } = require('./trend_bot.js');
      recordPublished(topNews.title, topNews.link);
    } else {
      console.log("\\n[TREND-ENGINE] Hết hạn chờ người dùng! Tự động bỏ qua theo cấu hình.");
    }
  }
}, 5000);

// Chu kỳ quét tự động mỗi 30 phút một lần
setInterval(runAutonomousTrendCycle, 30 * 60 * 1000);
// Khởi chạy quét lần đầu sau 10 giây khi khởi động server
setTimeout(runAutonomousTrendCycle, 10000);

app.get('/api/trends', async (req, res) => {
  if (trendScanning && !cachedTrends) {
    return res.json({ status: 'LOADING' });
  }

  if (cachedTrends) {
    const remaining = Math.floor((cachedTrends.expiresAt - Date.now()) / 1000);
    cachedTrends.remainingSeconds = remaining > 0 ? remaining : 0;
  }

  res.json(cachedTrends || { status: 'LOADING' });
});

app.post('/api/trends/dismiss', (req, res) => {
  if (cachedTrends) {
    cachedTrends.actionTaken = true;
    cachedTrends.remainingSeconds = 0;
  }
  res.json({ ok: true });
});

app.post('/api/trends/refresh', async (req, res) => {
  runAutonomousTrendCycle().catch(console.error);
  res.json({ ok: true, message: 'Đã kích hoạt quét lại tin tức.' });
});


app.listen(PORT, () => {
  console.log(`\n🚀 [Factory Dashboard V2] Server started at http://localhost:${PORT}`);
  console.log(`✅ Durable Worker is running in background...`);
});

process.on('SIGINT', () => {
  worker.stop();
  process.exit(0);
});
