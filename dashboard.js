require('dotenv').config();
const express = require('express');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { getDb } = require('./src/storage/db.js');
const { JobRepository } = require('./src/storage/repositories/JobRepository.js');
const { Publisher } = require('./src/publishing/publisher.js');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 4000;

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

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

let activePipelineProcess = null;
let currentRunState = {
  active: false,
  target: null,
  title: null,
  logs: [],
  lastLogId: 0,
  step: { step: 'crawler', status: 'idle', info: '' },
  done: false,
  error: null,
  videoUrl: null,
  metadata: null
};

// ==========================================
// ==========================================
// VIDEO GENERATION QUEUE (HÀNG ĐỢI TẠO VIDEO)
// ==========================================
const QUEUE_FILE = path.join(__dirname, 'data', 'video_render_queue.json');

function loadVideoQueue() {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      const content = fs.readFileSync(QUEUE_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        // Tự động chuẩn hóa & gán channelId nếu thiếu cho các bài trong hàng đợi
        try {
          const { ChannelRouter } = require('./src/publishing/channel_router.js');
          const router = new ChannelRouter();
          let changed = false;
          parsed.forEach(item => {
            if (!item.channelId) {
              item.channelId = router.route({
                title: item.title,
                category: item.category,
                source: item.source,
                scope: item.scope,
                language: item.language
              });
              changed = true;
            }
          });
          if (changed) {
            fs.writeFileSync(QUEUE_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
          }
        } catch(e) {}
        return parsed;
      }
    }
  } catch (e) {
    console.error('Lỗi đọc hàng đợi từ disk:', e.message);
  }
  return [];
}

let cachedMappedQueue = null;
function getMappedQueue() {
  if (!cachedMappedQueue) {
    cachedMappedQueue = videoGenerationQueue.map((item, idx) => ({ ...item, position: idx + 1 }));
  }
  return cachedMappedQueue;
}
function invalidateQueueCache() {
  cachedMappedQueue = null;
}

let saveQueueTimer = null;
function saveVideoQueue() {
  invalidateQueueCache();
  if (saveQueueTimer) clearTimeout(saveQueueTimer);
  saveQueueTimer = setTimeout(async () => {
    try {
      const dir = path.dirname(QUEUE_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      await fs.promises.writeFile(QUEUE_FILE, JSON.stringify(videoGenerationQueue, null, 2), 'utf-8');
    } catch (e) {
      console.error('Lỗi lưu hàng đợi xuống disk:', e.message);
    }
  }, 500);
}

let videoGenerationQueue = loadVideoQueue();

function recordRunLog(message) {
  currentRunState.lastLogId++;
  const entry = { id: currentRunState.lastLogId, message };
  currentRunState.logs.push(entry);
  if (currentRunState.logs.length > 500) {
    currentRunState.logs.shift();
  }
  return entry;
}

function recordRunStep(step, status, info) {
  currentRunState.step = { step, status, info };
}

// Quản lý danh sách kết nối SSE đang theo dõi phiên chạy
const runSseClients = new Set();

function broadcastRunEvent(type, data) {
  for (const client of runSseClients) {
    try {
      client.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
      if (client.flush) client.flush();
    } catch(e) {
      runSseClients.delete(client);
    }
  }
}

function logEvent(message) {
  const entry = recordRunLog(message);
  broadcastRunEvent('log', { id: entry.id, message: entry.message });
}

function stepEvent(step, status, info) {
  recordRunStep(step, status, info);
  broadcastRunEvent('step', { step, status, info });
}

function addToVideoQueue(target, title = null, source = '', category = '', score = null, isPriority = false, explicitChannelId = null, scope = '', language = '') {
  const cleanTarget = (target || '').trim();
  if (!cleanTarget) return { ok: false, message: 'Target không hợp lệ.' };

  // Kiểm tra trùng với bài đang chạy
  if (currentRunState.active && (currentRunState.target === cleanTarget || (title && currentRunState.title === title))) {
    return { ok: false, alreadyActive: true, message: 'Bài này đang trong tiến trình tạo video.' };
  }

  // Kiểm tra trùng với bài đã nằm trong hàng đợi
  const existingIdx = videoGenerationQueue.findIndex(item => item.target === cleanTarget || (title && item.title === title));
  if (existingIdx !== -1) {
    return { ok: false, alreadyQueued: true, position: existingIdx + 1, message: `Bài này đã có trong hàng đợi ở vị trí #${existingIdx + 1}.` };
  }

  const numScore = parseFloat(score) || 0;
  const shouldPreempt = isPriority || (numScore >= 9.0);

  // Phân luồng kênh: Ưu tiên channelId truyền vào hoặc định tuyến thông minh
  let targetChannelId = explicitChannelId;
  if (!targetChannelId || !['channel_domestic', 'channel_tech', 'channel_global'].includes(targetChannelId)) {
    try {
      const { ChannelRouter } = require('./src/publishing/channel_router.js');
      const router = new ChannelRouter();
      targetChannelId = router.route({ title: title || cleanTarget, category, source, scope, language });
    } catch(e) {
      targetChannelId = 'channel_domestic';
    }
  }

  // Kiểm tra xem kênh này có đang bị thiếu lịch trầm trọng không (Channel Starvation Check)
  let isChannelDeficit = false;
  try {
    const db = getDb();
    const pendingRow = db.prepare(`
      SELECT COUNT(*) as count FROM publications 
      WHERE status IN ('PENDING', 'RETRYING') 
        AND (channelId = ? OR (channelId IS NULL AND ? = 'channel_domestic'))
        AND datetime(scheduledAt) > datetime('now')
    `).get(targetChannelId, targetChannelId);
    
    // Nếu kênh này có dưới 2 bài trong hàng đợi xuất bản, đánh dấu cần bù lịch khẩn cấp
    if (pendingRow && pendingRow.count < 2) {
      isChannelDeficit = true;
    }
  } catch(e) {}

  const queueItem = {
    id: 'Q-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
    target: cleanTarget,
    title: title || cleanTarget,
    source: source || '',
    category: category || '',
    scope: scope || '',
    language: language || '',
    channelId: targetChannelId,
    channelDeficit: isChannelDeficit,
    score: numScore > 0 ? numScore : evaluateQueueItemScore({ title: title || cleanTarget, source }),
    isPriority: shouldPreempt || isChannelDeficit,
    queuedAt: new Date().toISOString()
  };

  videoGenerationQueue.push(queueItem);
  rebalanceAndSortVideoQueue();
  saveVideoQueue();

  // Ghi nhận vào SQLite/bộ nhớ xu hướng để tránh bị quét lại
  try {
    const { recordPublished } = require('./trend_bot.js');
    recordPublished(queueItem.title, queueItem.target);
  } catch(e) {}

  broadcastRunEvent('queue_updated', {
    queue: videoGenerationQueue.map((item, idx) => ({ ...item, position: idx + 1 }))
  });

  // Nếu máy đang rảnh, kích hoạt xử lý ngay
  if (!currentRunState.active && !activePipelineProcess) {
    processVideoQueue();
    return { ok: true, status: 'STARTED', item: queueItem, position: 0, queueLength: videoGenerationQueue.length };
  }

  const newPos = videoGenerationQueue.findIndex(it => it.id === queueItem.id) + 1;
  return { ok: true, status: 'QUEUED', position: newPos > 0 ? newPos : videoGenerationQueue.length, item: queueItem };
}

// Hàm tính điểm tiềm năng cho bài viết nếu chưa có điểm
function evaluateQueueItemScore(item) {
  let s = typeof item.score === 'number' && item.score > 0 ? item.score : 0;
  if (s > 0) return s;

  const title = (item.title || '').toLowerCase();
  const source = (item.source || '').toLowerCase();
  let baseScore = 8.2;

  if (/cảnh báo khẩn|sốc|chấn động|lừa đảo|tử vong|án mạng|mã độc|theo dõi ngầm|bắt cóc|tai nạn|ung thư|khám phá|kỷ lục/.test(title)) {
    baseScore += 0.9;
  }
  // Tăng điểm ưu tiên công nghệ cho kênh Kai Viet (Tech & Global)
  if (/apple|iphone|ios|openai|chatgpt|deepmind|jensen huang|nvidia|siri|google|tesla|spacex|robot|chip|bán dẫn|ai|công nghệ|mã độc|zuckoff|meta|vr|ar|samsung|smartphone|airpods|starship|uav|hacker/.test(title)) {
    baseScore += 1.2;
  }
  // Tăng điểm ưu tiên cho ngách Viral US & Global Explainer (Curious Globe)
  if (/ancient|archaeolog|discovery|secret|hidden|shocking|bizarre|scientists reveal|breakthrough|weapon|ice age|antarctic|alien|space|universe|crater|mystery|quantum|physics|survival/.test(title)) {
    baseScore += 1.2;
  }
  if (/the verge|techcrunch|wired|genk|bbc|tuổi trẻ|thanh niên|dân trí|vietnamnet|livescience|space\.com|popular mechanics|scientific american/.test(source)) {
    baseScore += 0.3;
  }

  return Math.min(9.8, Math.round(baseScore * 10) / 10);
}

// Cân bằng và tự động sắp xếp hàng đợi (Tri-Channel Balance & Priority Sort)
function rebalanceAndSortVideoQueue() {
  if (!videoGenerationQueue || videoGenerationQueue.length <= 1) return;

  try {
    const { ChannelRouter } = require('./src/publishing/channel_router.js');
    const router = new ChannelRouter();

    // Kiểm tra độ thiếu hụt video giữa các kênh
    let techPubCount = 0;
    let domesticPubCount = 0;
    let globalPubCount = 0;
    try {
      const db = getDb();
      techPubCount = db.prepare("SELECT COUNT(*) as count FROM publications WHERE channelId = 'channel_tech'").get()?.count || 0;
      domesticPubCount = db.prepare("SELECT COUNT(*) as count FROM publications WHERE channelId = 'channel_domestic' OR channelId IS NULL").get()?.count || 0;
      globalPubCount = db.prepare("SELECT COUNT(*) as count FROM publications WHERE channelId = 'channel_global'").get()?.count || 0;
    } catch(e) {}

    const isTechDeficit = techPubCount < domesticPubCount;
    const isGlobalDeficit = globalPubCount < 4;

    // 1. Chuẩn hóa điểm số & kênh cho từng bài
    const normalized = videoGenerationQueue.map(item => {
      const score = evaluateQueueItemScore(item);
      const chan = router.route({
        title: item.title || '',
        category: item.category || '',
        source: item.source || '',
        scope: item.scope || '',
        language: item.language || '',
        channelId: item.channelId
      });
      const isTech = chan === 'channel_tech';
      const isGlobal = chan === 'channel_global';
      const deficit = (isTech && isTechDeficit) || (isGlobal && isGlobalDeficit);
      return {
        ...item,
        score: deficit ? Math.min(9.8, Math.round((score + 0.3) * 10) / 10) : score,
        channelId: chan,
        channelDeficit: deficit,
        isPriority: score >= 9.0 || deficit
      };
    });

    // 2. Tách thành 3 nhóm: Tech, Domestic, Global
    const techItems = normalized.filter(it => it.channelId === 'channel_tech');
    const domesticItems = normalized.filter(it => it.channelId === 'channel_domestic');
    const globalItems = normalized.filter(it => it.channelId === 'channel_global');

    // Sắp xếp điểm cao giảm dần trong từng nhóm
    techItems.sort((a, b) => b.score - a.score || (new Date(a.queuedAt || 0) - new Date(b.queuedAt || 0)));
    domesticItems.sort((a, b) => b.score - a.score || (new Date(a.queuedAt || 0) - new Date(b.queuedAt || 0)));
    globalItems.sort((a, b) => b.score - a.score || (new Date(a.queuedAt || 0) - new Date(b.queuedAt || 0)));

    // 3. Ghép xen kẽ 3 kênh: Tech -> Global -> Domestic
    const balanced = [];
    let tIdx = 0, gIdx = 0, dIdx = 0;
    while (tIdx < techItems.length || gIdx < globalItems.length || dIdx < domesticItems.length) {
      if (tIdx < techItems.length) balanced.push(techItems[tIdx++]);
      if (gIdx < globalItems.length) balanced.push(globalItems[gIdx++]);
      if (dIdx < domesticItems.length) balanced.push(domesticItems[dIdx++]);
    }

    videoGenerationQueue = balanced;
    saveVideoQueue();
    broadcastRunEvent('queue_updated', {
      queue: videoGenerationQueue.map((item, idx) => ({ ...item, position: idx + 1 }))
    });
  } catch(e) {
    console.error('Lỗi khi tái cân bằng hàng đợi:', e.message);
  }
}

function removeFromVideoQueue(targetOrId) {
  const initialLength = videoGenerationQueue.length;
  videoGenerationQueue = videoGenerationQueue.filter(item => item.id !== targetOrId && item.target !== targetOrId);
  const removed = videoGenerationQueue.length < initialLength;
  if (removed) {
    saveVideoQueue();
    broadcastRunEvent('queue_updated', {
      queue: videoGenerationQueue.map((item, idx) => ({ ...item, position: idx + 1 }))
    });
  }
  return { ok: removed };
}

function bumpToFrontOfVideoQueue(targetOrId) {
  const idx = videoGenerationQueue.findIndex(item => item.id === targetOrId || item.target === targetOrId);
  if (idx > 0) {
    const [item] = videoGenerationQueue.splice(idx, 1);
    videoGenerationQueue.unshift(item);
    saveVideoQueue();
    broadcastRunEvent('queue_updated', {
      queue: videoGenerationQueue.map((it, i) => ({ ...it, position: i + 1 }))
    });
    return { ok: true, message: `Đã ưu tiên "${item.title}" lên vị trí #1 hàng đợi!` };
  }
  return { ok: false, message: 'Bài này đã ở đầu hàng đợi hoặc không tìm thấy.' };
}

function processVideoQueue() {
  if (currentRunState.active || activePipelineProcess) {
    return;
  }
  if (videoGenerationQueue.length === 0) {
    return;
  }

  const nextItem = videoGenerationQueue.shift();
  saveVideoQueue();
  broadcastRunEvent('queue_updated', {
    queue: videoGenerationQueue.map((item, idx) => ({ ...item, position: idx + 1 }))
  });

  startPipelineExecution(nextItem);
}

function startPipelineExecution(item) {
  const chanId = item.channelId || 'channel_domestic';
  const chanName = (chanId === 'channel_tech')
    ? '🚀 Kai Viet (Tech & Global)'
    : (chanId === 'channel_global' ? '🇺🇸 Curious Globe (US & International)' : '🇻🇳 Thời Sự & Xã Hội VN');
  const chanBadge = (chanId === 'channel_tech')
    ? '🚀 KAI VIET (TECH)'
    : (chanId === 'channel_global' ? '🇺🇸 CURIOUS GLOBE' : '🇻🇳 THỜI SỰ VN');
  const scoreVal = typeof item.score === 'number' && item.score > 0 ? item.score : 8.0;

  currentRunState.active = true;
  currentRunState.target = item.target;
  currentRunState.title = item.title;
  currentRunState.channelId = chanId;
  currentRunState.channelName = chanName;
  currentRunState.channelBadge = chanBadge;
  currentRunState.score = scoreVal;
  currentRunState.category = item.category || 'TỔNG HỢP';
  currentRunState.source = item.source || '';
  currentRunState.runId = 'run_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
  currentRunState.platforms = ['▶️ YouTube Shorts', '📘 Facebook Reels', '🎵 TikTok'];
  currentRunState.logs = [];
  currentRunState.lastLogId = 0;
  currentRunState.step = { step: 'crawler', status: 'running', info: 'Đang xử lý đầu vào...' };
  currentRunState.done = false;
  currentRunState.error = null;
  currentRunState.videoUrl = null;
  currentRunState.metadata = null;

  logEvent(`╔══════════════════════════════════════════════════════════════════╗`);
  logEvent(`║ 🎬 KHỞI ĐỘNG SẢN XUẤT VIDEO TỰ ĐỘNG                             ║`);
  logEvent(`║ • Kênh đích:  ${chanBadge} (${chanId})`);
  logEvent(`║ • Nền tảng:   ▶️ YouTube Shorts • 📘 Facebook Reels • 🎵 TikTok`);
  logEvent(`║ • Điểm HOT:   🔥 ${scoreVal}/10 | Chuyên mục: ${item.category || 'Đời sống'}`);
  logEvent(`║ • Tiêu đề:    "${item.title || item.target}"`);
  logEvent(`║ • Nguồn tin:  📡 ${item.source || 'Báo chí chính thống'}`);
  logEvent(`╚══════════════════════════════════════════════════════════════════╝`);
  stepEvent('crawler', 'running', 'Đang xử lý đầu vào...');

  // SPAWN AUTO PIPELINE với Node runtime chính xác
  const child = spawn(process.execPath, ['auto_pipeline.js', item.target], {
    cwd: __dirname,
    windowsHide: true,
    env: {
      ...process.env,
      FORCE_COLOR: '0',
      PIPELINE_SCORE: String(scoreVal),
      PIPELINE_CHANNEL_ID: chanId,
      PIPELINE_LANGUAGE: item.language || (chanId === 'channel_global' ? 'en' : 'vi')
    }
  });
  activePipelineProcess = child;

  // Điều tiết CPU Priority cho tiến trình con trên Windows (BELOW_NORMAL_PRIORITY_CLASS)
  // để Node.js Dashboard và Web Server luôn có chu kỳ xử lý, phản hồi mượt mà (<15ms)
  if (process.platform === 'win32' && child.pid) {
    try {
      const { exec } = require('child_process');
      exec(`powershell -NoProfile -Command "(Get-Process -Id ${child.pid}).PriorityClass = 'BelowNormal'"`, { windowsHide: true });
    } catch(e) {}
  }

  // Watchdog Heartbeat: Theo dõi hoạt động thời gian thực (tránh ngắt nhầm khi Remotion đang render)
  let lastActivityTime = Date.now();
  const startTime = Date.now();
  const MAX_INACTIVITY_MS = 8 * 60 * 1000; // 8 phút hoàn toàn không có output
  const MAX_TOTAL_RUNTIME_MS = 45 * 60 * 1000; // Tối đa 45 phút cho toàn bộ quy trình

  const watchdogInterval = setInterval(() => {
    if (activePipelineProcess !== child) {
      clearInterval(watchdogInterval);
      return;
    }
    const inactiveDuration = Date.now() - lastActivityTime;
    const totalDuration = Date.now() - startTime;

    if (inactiveDuration > MAX_INACTIVITY_MS || totalDuration > MAX_TOTAL_RUNTIME_MS) {
      clearInterval(watchdogInterval);
      const reason = inactiveDuration > MAX_INACTIVITY_MS
        ? `Không có phản hồi/hoạt động trong hơn ${Math.round(inactiveDuration / 60000)} phút`
        : `Thời gian chạy vượt quá ngưỡng an toàn tối đa 45 phút`;
      console.warn(`⚠️ [WATCHDOG TIMEOUT] ${reason}. Tự động dừng để nhường lượt cho hàng đợi...`);
      logEvent(`⚠️ [WATCHDOG TIMEOUT] ${reason}. Hủy tiến trình để chuyển bài tiếp theo.`);
      try {
        if (process.platform === 'win32') {
          const { exec } = require('child_process');
          exec(`taskkill /pid ${child.pid} /t /f`);
        } else {
          child.kill('SIGKILL');
        }
      } catch(e) {}
    }
  }, 15000);

  // Theo dõi tiến độ render Remotion để chống spam log & chống lặp dòng
  let lastProgressLogTime = 0;
  let lastRenderedFrame = 0;

  child.stdout.on('data', (data) => {
    lastActivityTime = Date.now();
    const text = data.toString('utf8');
    const lines = text.split(/[\r\n]+/).map(l => l.trim()).filter(l => l.length > 0);

    lines.forEach(line => {
      // Nhận diện tiến độ render từ Remotion CLI
      const progressMatch = line.match(/Rendered\s+(\d+)\/(\d+)(?:,\s*time remaining:\s*([^,\r\n]+))?/i);
      if (progressMatch) {
        const curFrame = parseInt(progressMatch[1], 10);
        const totalFrames = parseInt(progressMatch[2], 10);
        const timeRem = progressMatch[3] ? progressMatch[3].trim() : '';
        const pct = Math.round((curFrame / totalFrames) * 100);

        // Luôn cập nhật GUI Node Card thời gian thực mượt mà
        stepEvent('render', 'running', `Render: ${curFrame}/${totalFrames} (${pct}%)${timeRem ? ' - Còn ~' + timeRem : ''}`);

        // Throttle log vào Terminal để chống spam & chống lặp dòng
        const now = Date.now();
        if (curFrame - lastRenderedFrame >= 75 || now - lastProgressLogTime >= 4000 || curFrame === totalFrames) {
          lastRenderedFrame = curFrame;
          lastProgressLogTime = now;
          logEvent(`🎬 [Render Tiến độ] ${curFrame}/${totalFrames} (${pct}%)${timeRem ? ' • Thời gian còn lại: ~' + timeRem : ''}`);
        }
        return;
      }

      logEvent(line);

      if (line.includes('BƯỚC 1: Đang cào dữ liệu')) {
        stepEvent('crawler', 'running', 'Đang trích xuất văn bản...');
      }
      if (line.includes('Lấy thành công')) {
        stepEvent('crawler', 'success', 'Đã cào xong văn bản sạch.');
        stepEvent('ai', 'running', 'Đang gửi sang AI Pipeline...');
      }
      if (line.includes('Đang thử kết nối model:')) {
        const modelMatch = line.match(/model:\s*(.+)\.\.\./);
        if (modelMatch) {
          stepEvent('ai', 'running', `Đang kết nối: ${modelMatch[1]}`);
        }
      }
      if (line.includes('AI đã viết kịch bản')) {
        stepEvent('ai', 'success', `Tạo kịch bản hoàn tất.`);
        stepEvent('tts', 'running', 'Khởi động Neural Edge-TTS...');
      }
      if (line.includes('Đồng bộ Frame hoàn tất')) {
        stepEvent('tts', 'success', 'Audio sync hoàn tất.');
        stepEvent('render', 'running', 'Render Remotion GPU...');
      }
      if (line.includes('BƯỚC 5: ĐANG CHUẨN BỊ PUBLISH LÊN ĐA NỀN TẢNG') || line.includes('HOÀN TẤT PIPELINE TỰ ĐỘNG')) {
        stepEvent('render', 'success', 'Render xong: auto_news_result.mp4');
        stepEvent('youtube', 'running', 'Đang phân phối (Multi-Platform)...');
      }
      if (line.includes('QUÁ TRÌNH PHÂN PHỐI ĐÃ HOÀN TẤT') || line.includes('hàng đợi Hẹn Giờ Vàng') || line.includes('CHỜ DUYỆT THỦ CÔNG')) {
        stepEvent('youtube', 'success', 'Đăng Đa nền tảng OK.');
      }
    });
  });

  child.stderr.on('data', (data) => {
    lastActivityTime = Date.now();
    const text = data.toString('utf8').trim();
    if (text) logEvent('⚠️ ' + text);
  });

  child.on('error', (err) => {
    clearInterval(watchdogInterval);
    activePipelineProcess = null;
    currentRunState.active = false;
    currentRunState.error = `Lỗi khởi chạy tiến trình: ${err.message}`;
    broadcastRunEvent('error', { message: currentRunState.error });

    // Tự động chuyển sang bài tiếp theo trong hàng đợi nếu có
    if (videoGenerationQueue.length > 0) {
      logEvent(`⏳ Tự động chuyển sang bài tiếp theo trong hàng đợi sau 3 giây...`);
      setTimeout(processVideoQueue, 3000);
    }
  });

  child.on('close', (code, signal) => {
    clearInterval(watchdogInterval);
    activePipelineProcess = null;
    currentRunState.active = false;

    // Kiểm tra xem video đã được render thành công trong phiên chạy này chưa (mtime >= startTime)
    const previewVideo = path.join(__dirname, 'out', 'auto_news_result.mp4');
    let hasRenderedVideo = false;
    try {
      if (fs.existsSync(previewVideo)) {
        const stat = fs.statSync(previewVideo);
        if (stat.size > 1000000 && stat.mtimeMs >= (startTime - 5000)) {
          hasRenderedVideo = true;
        }
      }
    } catch(e) {}

    if (!hasRenderedVideo) {
      try {
        const vDir = path.join(__dirname, 'out', 'videos');
        if (fs.existsSync(vDir)) {
          const files = fs.readdirSync(vDir)
            .filter(f => f.endsWith('.mp4'))
            .map(f => ({ file: f, path: path.join(vDir, f), mtime: fs.statSync(path.join(vDir, f)).mtimeMs, size: fs.statSync(path.join(vDir, f)).size }))
            .filter(f => f.mtime >= (startTime - 5000) && f.size > 1000000)
            .sort((a, b) => b.mtime - a.mtime);
          if (files.length > 0) {
            fs.copyFileSync(files[0].path, previewVideo);
            hasRenderedVideo = true;
          }
        }
      } catch(e) {}
    }

    if (code !== 0 && !hasRenderedVideo) {
      if (!currentRunState.error) {
        currentRunState.error = signal
          ? `Tiến trình bị gián đoạn (signal: ${signal})`
          : (code === null ? 'Tiến trình bị ngắt từ bên ngoài hoặc do dừng tiến trình.' : `Tiến trình kết thúc với mã lỗi ${code}`);
      }
      broadcastRunEvent('error', { message: currentRunState.error });
    } else {
      logEvent(`🎬 Video hoàn tất: "${item.title}"! Đã bàn giao cho hàng đợi xuất bản.`);
      stepEvent('render', 'success', 'Render hoàn tất video.');
      stepEvent('youtube', 'success', 'Đã lưu hàng đợi xuất bản.');

      let aiMeta = null;
      try {
        const dbData = fs.readFileSync(path.join(__dirname, 'src', 'dynamic_news.json'), 'utf-8');
        aiMeta = JSON.parse(dbData);
      } catch (e) {}

      currentRunState.done = true;
      currentRunState.videoUrl = '/out/auto_news_result.mp4';
      currentRunState.metadata = aiMeta;

      broadcastRunEvent('done', {
        videoUrl: '/out/auto_news_result.mp4',
        metadata: aiMeta,
        title: item.title,
        target: item.target
      });
    }

    // TỰ ĐỘNG CUỐN CHIẾU: Nếu còn bài trong hàng đợi, tự động chạy tiếp!
    if (videoGenerationQueue.length > 0) {
      logEvent(`\n⚡ [HÀNG ĐỢI] Đang có ${videoGenerationQueue.length} video chờ. Sẽ tự động bắt đầu bài tiếp theo sau 3 giây...`);
      setTimeout(() => {
        processVideoQueue();
      }, 3000);
    } else {
      logEvent(`\n🎉 [HÀNG ĐỢI] Toàn bộ video trong hàng đợi đã hoàn tất!`);
    }
  });
}

app.get('/api/run-status', (req, res) => {
  let since = parseInt(req.query.since) || 0;
  // Nếu client gửi since vượt quá lastLogId (do server vừa sang bài mới và reset lastLogId = 0),
  // tự động reset since về 0 để client nhận toàn bộ log mới!
  if (since > currentRunState.lastLogId) {
    since = 0;
  }
  const newLogs = currentRunState.logs.filter(l => l.id > since);
  res.json({
    runId: currentRunState.runId,
    active: currentRunState.active,
    target: currentRunState.target,
    title: currentRunState.title,
    channelId: currentRunState.channelId || 'channel_domestic',
    channelName: currentRunState.channelName || '🇻🇳 Thời Sự & Xã Hội VN',
    channelBadge: currentRunState.channelBadge || '🇻🇳 THỜI SỰ VN',
    score: currentRunState.score || 8.0,
    category: currentRunState.category || 'TỔNG HỢP',
    source: currentRunState.source || '',
    platforms: currentRunState.platforms || ['▶️ YouTube Shorts', '📘 Facebook Reels', '🎵 TikTok'],
    step: currentRunState.step,
    logs: newLogs,
    lastLogId: currentRunState.lastLogId,
    done: currentRunState.done,
    error: currentRunState.error,
    videoUrl: currentRunState.videoUrl,
    metadata: currentRunState.metadata,
    queueCount: videoGenerationQueue.length,
    queue: getMappedQueue()
  });
});

app.post('/api/queue/start', (req, res) => {
  if (currentRunState.active || activePipelineProcess) {
    return res.json({ ok: false, message: 'Hàng đợi đang có video đang chạy.' });
  }
  if (videoGenerationQueue.length === 0) {
    return res.json({ ok: false, message: 'Hàng đợi đang rỗng, không có video nào để chạy.' });
  }
  processVideoQueue();
  res.json({ ok: true, message: 'Đã kích hoạt chạy hàng đợi tạo video.' });
});

app.get('/api/queue', (req, res) => {
  res.json({
    active: currentRunState.active ? {
      target: currentRunState.target,
      title: currentRunState.title || currentRunState.target,
      channelId: currentRunState.channelId,
      channelName: currentRunState.channelName,
      channelBadge: currentRunState.channelBadge,
      score: currentRunState.score,
      category: currentRunState.category,
      source: currentRunState.source,
      step: currentRunState.step
    } : null,
    queue: videoGenerationQueue.map((item, idx) => ({ ...item, position: idx + 1 })),
    count: videoGenerationQueue.length
  });
});

app.post('/api/queue/add', (req, res) => {
  const { target, title, source, category, score, priority, channelId, scope, language } = req.body;
  if (!target) return res.status(400).json({ ok: false, message: 'Thiếu liên kết hoặc nội dung target!' });
  const result = addToVideoQueue(target, title, source, category, score, priority, channelId, scope, language);
  res.json(result);
});

app.post('/api/queue/rebalance', (req, res) => {
  try {
    rebalanceAndSortVideoQueue();
    res.json({
      ok: true,
      message: `Đã tự động tính điểm và sắp xếp cân bằng ${videoGenerationQueue.length} video xen kẽ giữa Kênh Tech và Kênh Thời Sự!`,
      count: videoGenerationQueue.length,
      queue: videoGenerationQueue.map((item, idx) => ({ ...item, position: idx + 1 }))
    });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/queue/remove', (req, res) => {
  const { target, id } = req.body;
  if (!target && !id) return res.status(400).json({ ok: false, message: 'Thiếu id hoặc target!' });
  const result = removeFromVideoQueue(id || target);
  res.json(result);
});

app.post('/api/queue/bump', (req, res) => {
  const { target, id } = req.body;
  if (!target && !id) return res.status(400).json({ ok: false, message: 'Thiếu id hoặc target!' });
  const result = bumpToFrontOfVideoQueue(id || target);
  res.json(result);
});

app.post('/api/queue/clear', (req, res) => {
  videoGenerationQueue = [];
  saveVideoQueue();
  broadcastRunEvent('queue_updated', { queue: [] });
  res.json({ ok: true, message: 'Đã làm rỗng hàng đợi tạo video.' });
});

app.post('/api/cancel-run', (req, res) => {
  if (activePipelineProcess) {
    try {
      if (process.platform === 'win32') {
        const { exec } = require('child_process');
        exec(`taskkill /pid ${activePipelineProcess.pid} /t /f`);
      } else {
        activePipelineProcess.kill('SIGKILL');
      }
    } catch(e) {}
    activePipelineProcess = null;
    currentRunState.active = false;
    currentRunState.error = 'Đã dừng tiến trình theo yêu cầu.';
    broadcastRunEvent('error', { message: currentRunState.error });
  }
  return res.json({ ok: true, message: 'Đã dừng tiến trình đang chạy.' });
});

app.post('/api/facebook/quick-post', async (req, res) => {
  try {
    const { title, summary, url, photoUrl, tags } = req.body;
    if (!title && !summary) {
      return res.status(400).json({ ok: false, error: 'Thiếu tiêu đề hoặc nội dung tóm tắt.' });
    }

    // Kiểm tra chống trùng lặp theo URL hoặc Title
    const db = getDb();
    if (url) {
      const existing = db.prepare("SELECT * FROM publications WHERE platform = 'facebook' AND caption LIKE ?").get(`%${url}%`);
      if (existing) {
        return res.json({ ok: false, message: 'Tin này đã từng được đăng lên Facebook trước đó!' });
      }
    }

    const { MetaProvider } = require('./src/publishing/providers/meta.js');
    const metaProvider = new MetaProvider('facebook');

    const hashtagStr = (tags && Array.isArray(tags))
      ? tags.map(t => `#${t.replace(/^#/, '')}`).join(' ')
      : '#ANNews #ThoiSu #TinNong #TinNhanh24h';

    const cleanCaption = `🔥 ${title.toUpperCase()}\n\n${summary || ''}\n\n👉 Nguồn tin chi tiết: ${url || ''}\n\n${hashtagStr}`;

    let result;
    // Kiểm tra ảnh nếu có
    let localPhoto = null;
    if (photoUrl && photoUrl.startsWith('http')) {
      try {
        const fetchRes = await fetch(photoUrl);
        if (fetchRes.ok) {
          const buf = await fetchRes.arrayBuffer();
          const tmpImg = path.join(__dirname, 'out', `temp_fb_${Date.now()}.jpg`);
          fs.writeFileSync(tmpImg, Buffer.from(buf));
          localPhoto = tmpImg;
        }
      } catch(e) {}
    } else if (photoUrl && fs.existsSync(photoUrl)) {
      localPhoto = photoUrl;
    }

    if (localPhoto && fs.existsSync(localPhoto)) {
      result = await metaProvider.publishPhotoPost(localPhoto, cleanCaption);
      try {
        if (localPhoto.includes('temp_fb_')) fs.unlinkSync(localPhoto);
      } catch(e) {}
    } else {
      result = await metaProvider.publishFeedPost(cleanCaption);
    }

    // Ghi nhận vào DB
    const pubId = `PUB-FB-QUICK-${Date.now()}`;
    db.prepare(`
      INSERT INTO publications (publicationId, storyId, platform, title, caption, language, channelId, status, platformVideoId, url, publishedAt)
      VALUES (?, ?, 'facebook', ?, ?, 'vi', 'channel_domestic', 'PUBLISHED', ?, ?, CURRENT_TIMESTAMP)
    `).run(pubId, `ST-FB-${Date.now()}`, title, cleanCaption, result.postId, result.url);

    return res.json({
      ok: true,
      message: 'Đã đăng thành công lên Fanpage AN NEWS 24/7!',
      url: result.url,
      postId: result.postId
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.get(['/api/tiktok/status', '/api/tiktok/edge-status'], async (req, res) => {
  try {
    const { checkTikTokLoginStatus, isBrowserDebuggingActive } = require('./src/publishing/providers/tiktok_edge_publisher.js');
    const status = await checkTikTokLoginStatus(9222);
    res.json({
      ok: true,
      active: status.running,
      loggedIn: status.loggedIn,
      message: status.message,
      url: status.url || null
    });
  } catch (err) {
    res.json({ ok: false, active: false, loggedIn: false, error: err.message });
  }
});

app.post(['/api/tiktok/login-browser', '/api/tiktok/edge-launch'], (req, res) => {
  try {
    const { launchTikTokBrowser } = require('./src/publishing/providers/tiktok_edge_publisher.js');
    launchTikTokBrowser(9222);
    res.json({ 
      ok: true, 
      message: 'Đã mở trình duyệt tự động với profile riêng (data/tiktok_profile). Vui lòng đăng nhập tài khoản TikTok của bạn trên cửa sổ vừa mở.' 
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/tiktok/test-publish', async (req, res) => {
  try {
    const { uploadToTikTokViaEdge } = require('./src/publishing/providers/tiktok_edge_publisher.js');
    const db = getDb();
    
    // Tìm video mới nhất đã render xong trong database
    const latestRender = db.prepare("SELECT * FROM renders WHERE status = 'COMPLETED' ORDER BY createdAt DESC LIMIT 1").get();
    
    let sampleVideoPath = null;
    let sampleTitle = 'Test TikTok Publisher';
    
    if (latestRender && latestRender.videoPath && fs.existsSync(latestRender.videoPath)) {
      sampleVideoPath = latestRender.videoPath;
      sampleTitle = latestRender.title || 'Bản Tin Xu Hướng 24H';
    } else {
      const defaultSample = path.join(__dirname, 'out', 'auto_news_result.mp4');
      if (fs.existsSync(defaultSample)) {
        sampleVideoPath = defaultSample;
      }
    }

    if (!sampleVideoPath) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Chưa có file video nào được render để test. Vui lòng tạo ít nhất 1 video trước khi test đăng.' 
      });
    }

    const result = await uploadToTikTokViaEdge({
      videoPath: sampleVideoPath,
      title: `[TEST] ${sampleTitle}`,
      tags: ['xuhuong', 'tiktoknews', 'trending', 'testbot']
    });

    res.json({
      ok: true,
      message: result.message,
      postId: result.postId,
      url: result.url
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/run', (req, res) => {
  const target = req.query.target;
  if (!target) return res.status(400).send('Missing target');

  // Chống đệm proxy/Cloudflare trên kênh Server-Sent Events (SSE)
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
    'Access-Control-Allow-Origin': '*'
  });

  if (res.flushHeaders) {
    res.flushHeaders();
  }

  // Ép xả bộ đệm Cloudflare Edge ngay lập tức bằng SSE comment
  res.write(': ' + 'FLUSH_CLOUDFLARE_BUFFER_'.repeat(3000) + '\n\n');

  // Thêm client này vào danh sách nhận log
  runSseClients.add(res);

  // Heartbeat định kỳ 3s để giữ kết nối Cloudflare Tunnel luôn thông suốt
  const heartbeat = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);
      if (res.flush) res.flush();
    } catch(e) {
      clearInterval(heartbeat);
      runSseClients.delete(res);
    }
  }, 3000);

  req.on('close', () => {
    clearInterval(heartbeat);
    runSseClients.delete(res);
  });

  // Replay logs và trạng thái hiện tại cho client
  currentRunState.logs.forEach(entry => {
    try {
      res.write(`data: ${JSON.stringify({ type: 'log', id: entry.id, message: entry.message })}\n\n`);
    } catch(e) {}
  });
  if (currentRunState.step) {
    try {
      res.write(`data: ${JSON.stringify({ type: 'step', ...currentRunState.step })}\n\n`);
    } catch(e) {}
  }
  try {
    res.write(`data: ${JSON.stringify({
      type: 'queue_updated',
      queue: videoGenerationQueue.map((item, idx) => ({ ...item, position: idx + 1 }))
    })}\n\n`);
  } catch(e) {}
  if (res.flush) res.flush();

  // Nếu target không phải là reconnect và chưa chạy gì thì thêm vào queue để chạy
  if (target !== 'reconnect' && !currentRunState.active && !activePipelineProcess) {
    addToVideoQueue(target);
  }
});

app.get('/api/check-youtube', (req, res) => {
  const reqChan = req.query.channelId || 'channel_domestic';
  let targetFile = 'tokens.json';
  if (reqChan === 'channel_tech') targetFile = 'tokens_channel2.json';
  if (reqChan === 'channel_global') targetFile = 'tokens_channel3.json';

  const ch1 = fs.existsSync(path.join(__dirname, 'tokens.json'));
  const ch2 = fs.existsSync(path.join(__dirname, 'tokens_channel2.json'));
  const ch3 = fs.existsSync(path.join(__dirname, 'tokens_channel3.json'));

  const isAuth = fs.existsSync(path.join(__dirname, targetFile));
  res.json({
    authorized: isAuth,
    channelId: reqChan,
    targetFile,
    channels: {
      channel_domestic: { authorized: ch1, file: 'tokens.json', name: 'FactLoop (VN & Global)' },
      channel_tech: { authorized: ch2, file: 'tokens_channel2.json', name: 'Kai Viet Tech' },
      channel_global: { authorized: ch3, file: 'tokens_channel3.json', name: 'Curious Globe' }
    }
  });
});

app.get('/api/channels', (req, res) => {
  const confPath = path.join(__dirname, 'config.json');
  let conf = {};
  if (fs.existsSync(confPath)) {
    try { conf = JSON.parse(fs.readFileSync(confPath, 'utf-8')); } catch(e) {}
  }
  res.json({ ok: true, channels: conf.CHANNELS || {} });
});

app.post('/api/channels/auto-setup', (req, res) => {
  try {
    const scriptPath = path.join(__dirname, 'setup_youtube_channel.js');
    if (!fs.existsSync(scriptPath)) {
      return res.status(404).json({ ok: false, error: 'Không tìm thấy setup_youtube_channel.js' });
    }
    const proc = spawn('node', [scriptPath], {
      detached: true,
      stdio: 'ignore'
    });
    proc.unref();
    res.json({ ok: true, message: 'Đã mở Google Chrome! Vui lòng đăng nhập tài khoản Google trên màn hình để bot tự động điền hoàn tất thông tin kênh.' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

let oauthServerInstance = null;
let activeOAuthChannelId = 'channel_domestic';

function getYouTubeOAuthClient(customRedirectUri = null) {
  const secretPath = path.join(__dirname, 'client_secret.json');
  if (!fs.existsSync(secretPath)) {
    throw new Error('Không tìm thấy file client_secret.json tại thư mục gốc!');
  }
  const rawKey = JSON.parse(fs.readFileSync(secretPath, 'utf-8'));
  const creds = rawKey.installed || rawKey.web;
  if (!creds || !creds.client_id || !creds.client_secret) {
    throw new Error('File client_secret.json không đúng định dạng Google OAuth!');
  }
  const redirectUri = customRedirectUri || `http://localhost:${PORT}/oauth2callback`;
  return new google.auth.OAuth2(
    creds.client_id,
    creds.client_secret,
    redirectUri
  );
}

// Hàm lưu token và đồng bộ kênh
async function saveYouTubeTokensFromCode(code, targetChannelId) {
  const targetChan = targetChannelId || activeOAuthChannelId || 'channel_domestic';
  const candidateRedirectUris = [
    `http://localhost:${PORT}/oauth2callback`,
    'http://localhost:3050/oauth2callback'
  ];

  let tokens = null;
  let oauth2Client = null;
  let lastErr = null;

  for (const uri of candidateRedirectUris) {
    try {
      oauth2Client = getYouTubeOAuthClient(uri);
      const res = await oauth2Client.getToken(code);
      tokens = res.tokens;
      break;
    } catch(err) {
      lastErr = err;
    }
  }

  if (!tokens) {
    throw lastErr || new Error('Không thể đổi mã code Google OAuth!');
  }

  oauth2Client.setCredentials(tokens);

  let saveFile = 'tokens.json';
  let chanBadge = 'Thời Sự VN (Kênh 1)';
  if (targetChan === 'channel_tech') {
    saveFile = 'tokens_channel2.json';
    chanBadge = 'Kai Viet Tech (Kênh 2)';
  } else if (targetChan === 'channel_global') {
    saveFile = 'tokens_channel3.json';
    chanBadge = 'Curious Globe (Kênh 3)';
  }

  fs.writeFileSync(path.join(__dirname, saveFile), JSON.stringify(tokens, null, 2));

  let channelTitle = chanBadge;
  try {
    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    const chRes = await youtube.channels.list({ part: ['snippet'], mine: true });
    if (chRes.data.items && chRes.data.items.length > 0) {
      channelTitle = chRes.data.items[0].snippet.title;
    }
  } catch(e) {}

  return { saveFile, chanBadge, channelTitle, targetChan };
}

// ROUTE EXPRESS TIẾP NHẬN OAUTH CALLBACK TRỰC TIẾP TRÊN PORT 4000 (VÀ TUNNEL)
app.get('/oauth2callback', async (req, res) => {
  try {
    const code = req.query.code;
    if (!code) {
      return res.status(400).send('Thiếu mã xác thực code từ Google OAuth');
    }

    const result = await saveYouTubeTokensFromCode(code, activeOAuthChannelId);

    if (oauthServerInstance) {
      try { oauthServerInstance.close(); } catch(e) {}
      oauthServerInstance = null;
    }

    res.send(`
      <!DOCTYPE html>
      <html lang="vi">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Đăng Nhập YouTube Thành Công</title>
        <style>
          body { background: #070a12; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; padding: 16px; box-sizing: border-box; }
          .card { background: #0e1526; border: 1px solid #10b981; border-radius: 16px; padding: 32px 24px; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.6); }
          h1 { color: #10b981; margin: 0 0 8px; font-size: 20px; }
          h2 { color: #38bdf8; margin: 0 0 16px; font-size: 16px; }
          p { color: #94a3b8; font-size: 13px; line-height: 1.6; }
          .badge { display: inline-block; background: rgba(16, 185, 129, 0.15); color: #34d399; padding: 6px 14px; border-radius: 8px; font-weight: bold; margin-top: 14px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div style="font-size: 44px; margin-bottom: 8px;">🎉</div>
          <h1>ĐĂNG NHẬP YOUTUBE THÀNH CÔNG!</h1>
          <h2>${result.chanBadge}</h2>
          <p>Kênh đã liên kết: <b style="color:#fff;">${result.channelTitle}</b><br>Token đã lưu an toàn vào: <code>${result.saveFile}</code></p>
          <div class="badge">Đang đóng cửa sổ và cập nhật Dashboard sau <span id="sec">2</span>s...</div>
        </div>
        <script>
          let s = 2;
          setInterval(() => {
            s--;
            if (document.getElementById('sec')) document.getElementById('sec').textContent = s;
            if (s <= 0) {
              if (window.opener) {
                try { window.opener.postMessage({ type: 'YT_AUTH_SUCCESS', channelId: '${result.targetChan}' }, '*'); } catch(e) {}
                window.close();
              } else {
                window.location.href = '/';
              }
            }
          }, 1000);
        </script>
      </body>
      </html>
    `);
  } catch(err) {
    res.status(500).send(`
      <div style="font-family:sans-serif; text-align:center; padding:50px; background:#0b0f19; color:#f87171;">
        <h2>❌ Lỗi xác thực OAuth</h2>
        <p>${err.message}</p>
        <a href="/" style="color:#38bdf8;">Quay lại Dashboard</a>
      </div>
    `);
  }
});

app.get('/api/youtube-auth-url', (req, res) => {
  try {
    activeOAuthChannelId = req.query.channelId || 'channel_domestic';
    const oauth2Client = getYouTubeOAuthClient();
    const scopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'select_account consent'
    });

    // Mở bộ hứng port 3050 dự phòng cho các client cũ
    if (!oauthServerInstance) {
      try {
        const http = require('http');
        const urlModule = require('url');
        const authServer = http.createServer(async (cReq, cRes) => {
          try {
            if (cReq.url.startsWith('/oauth2callback')) {
              const qs = new urlModule.URL(cReq.url, 'http://localhost:3050').searchParams;
              const code = qs.get('code');
              if (code) {
                const result = await saveYouTubeTokensFromCode(code, activeOAuthChannelId);
                cRes.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                cRes.end(`
                  <div style="text-align:center; margin-top:50px; font-family:sans-serif; background:#070a12; color:#fff; padding:40px;">
                    <h1 style="color:#10b981;">🎉 Đăng Nhập YouTube Thành Công!</h1>
                    <h2 style="color:#3b82f6;">${result.chanBadge}</h2>
                    <p style="font-size:16px;">Tên kênh: <b>${result.channelTitle}</b></p>
                    <p>Token đã được lưu an toàn vào: <b>${result.saveFile}</b>. Cửa sổ sẽ tự đóng sau 2s...</p>
                    <script>setTimeout(() => { if (window.opener) { window.opener.postMessage({ type: 'YT_AUTH_SUCCESS' }, '*'); window.close(); } else { window.location.href = 'http://localhost:4000/'; } }, 2000);</script>
                  </div>
                `);

                authServer.close();
                oauthServerInstance = null;
              }
            }
          } catch(err) {
            cRes.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            cRes.end('Lỗi xác thực: ' + err.message);
          }
        });

        authServer.listen(3050, () => {
          console.log('🔑 [OAuth] Đang lắng nghe callback dự phòng tại http://localhost:3050/oauth2callback');
        });

        authServer.on('error', (e) => {
          oauthServerInstance = null;
        });

        oauthServerInstance = authServer;
      } catch(e) {}
    }

    res.json({ ok: true, authUrl, channelId: activeOAuthChannelId });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/youtube-exchange-code', async (req, res) => {
  try {
    const { codeOrUrl, channelId } = req.body;
    const targetChan = channelId || activeOAuthChannelId || 'channel_domestic';
    if (!codeOrUrl) return res.status(400).json({ ok: false, error: 'Vui lòng cung cấp mã code hoặc link callback!' });

    let code = codeOrUrl.trim();
    if (code.includes('code=')) {
      try {
        const parsed = new URL(code.startsWith('http') ? code : `http://localhost/${code}`);
        code = parsed.searchParams.get('code') || code;
      } catch(e) {
        const m = code.match(/code=([^&]+)/);
        if (m) code = decodeURIComponent(m[1]);
      }
    }

    const result = await saveYouTubeTokensFromCode(code, targetChan);

    if (oauthServerInstance) {
      try { oauthServerInstance.close(); } catch(e) {}
      oauthServerInstance = null;
    }

    res.json({ 
      ok: true, 
      channelTitle: result.channelTitle, 
      tokenFile: result.saveFile, 
      channelId: targetChan, 
      message: `Kết nối thành công với kênh: ${result.channelTitle} (Lưu vào ${result.saveFile})` 
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: `Không thể đổi mã xác thực: ${err.message}` });
  }
});

app.post('/api/youtube-auto-login', async (req, res) => {
  try {
    const channelId = req.body.channelId || 'channel_global';
    activeOAuthChannelId = channelId;
    const oauth2Client = getYouTubeOAuthClient();
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.readonly'
      ],
      prompt: 'select_account consent'
    });

    const { exec } = require('child_process');
    const startCmd = process.platform === 'win32' ? `start "" "${authUrl}"` : `open "${authUrl}"`;
    exec(startCmd);

    res.json({
      ok: true,
      authUrl,
      message: 'Đã mở trình duyệt Chrome trên máy tính chủ! Bạn chỉ cần chọn tài khoản Google trên màn hình máy tính, hệ thống sẽ tự động hoàn tất kết nối.'
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/auth-youtube', (req, res) => {
  try {
    const oauth2Client = getYouTubeOAuthClient();
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.readonly'],
      prompt: 'select_account consent'
    });
    res.json({ ok: true, authUrl, message: 'Vui lòng mở link cấp quyền Google OAuth.' });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
  }
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

  // Gửi ngay trạng thái khởi tạo tức thì khi client kết nối
  try {
    const db = getDb();
    const recentJobs = db.prepare('SELECT jobId, stage, status, updatedAt FROM jobs ORDER BY updatedAt DESC LIMIT 5').all();
    const pubFields = 'publicationId, storyId, renderId, platform, channelId, status, url, title, caption, lastError, scheduledAt, publishedAt, createdAt, updatedAt, layoutVersion, layoutTypes, sceneCount, durationSeconds';
    const publications = db.prepare(`SELECT ${pubFields} FROM publications ORDER BY createdAt DESC, publicationId DESC LIMIT 200`).all();
    res.write(`data: ${JSON.stringify({ type: 'status_sync', jobs: recentJobs, publications })}\n\n`);
  } catch(e) {}

  logClients.push(res);
  req.on('close', () => {
    logClients = logClients.filter(c => c !== res);
  });
});

app.get('/api/publications', (req, res) => {
  try {
    const db = getDb();
    const limit = req.query.limit ? parseInt(req.query.limit) : 200;
    const pubFields = 'publicationId, storyId, renderId, platform, channelId, status, url, title, caption, lastError, scheduledAt, publishedAt, createdAt, updatedAt, layoutVersion, layoutTypes, sceneCount, durationSeconds, priorityScore';
    const query = limit > 0
      ? `SELECT ${pubFields} FROM publications ORDER BY createdAt DESC, publicationId DESC LIMIT ?`
      : `SELECT ${pubFields} FROM publications ORDER BY createdAt DESC, publicationId DESC`;
    const publications = limit > 0 ? db.prepare(query).all(limit) : db.prepare(query).all();
    res.json(publications);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// API Stream Video với HTTP 206 Partial Content (tua nhanh tức thì, không bị đơ loading)
app.get('/api/video/:renderId', (req, res) => {
  try {
    const { renderId } = req.params;
    if (!renderId) return res.status(400).send('Missing renderId');

    const db = getDb();
    let filePath = null;

    // 1. Kiểm tra trực tiếp trong bảng renders từ database
    try {
      const row = db.prepare('SELECT videoPath FROM renders WHERE renderId = ?').get(renderId);
      if (row && row.videoPath && fs.existsSync(row.videoPath)) {
        filePath = row.videoPath;
      }
    } catch (e) {}

    // 2. Tìm kiếm trong thư mục out/videos (hỗ trợ cả tìm theo tiền tố hoặc tìm đệ quy trong thư mục ngày/kênh)
    if (!filePath) {
      const findVideoRecursive = (dir) => {
        if (!fs.existsSync(dir)) return null;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            const found = findVideoRecursive(full);
            if (found) return found;
          } else if (entry.isFile() && entry.name.endsWith('.mp4')) {
            if (entry.name === `${renderId}.mp4` || entry.name.startsWith(`${renderId}_`) || entry.name.startsWith(renderId)) {
              return full;
            }
          }
        }
        return null;
      };

      filePath = findVideoRecursive(path.join(__dirname, 'out', 'videos'));
    }

    // 3. Fallback: file trong thư mục out/
    if (!filePath) {
      const cand1 = path.join(__dirname, 'out', `${renderId}.mp4`);
      const cand2 = path.join(__dirname, 'out', 'auto_news_result.mp4');
      if (fs.existsSync(cand1)) filePath = cand1;
      else if (fs.existsSync(cand2)) filePath = cand2;
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).send('Video not found');
    }

    // 4. Stream video chuẩn HTTP 206 Partial Content
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    console.error('Lỗi stream video:', err.message);
    res.status(500).send('Internal Server Error');
  }
});

let lastStatusSyncFingerprint = '';

setInterval(() => {
  if (!logClients || logClients.length === 0) return;
  try {
    const db = getDb();
    const recentJobs = db.prepare('SELECT jobId, stage, status, updatedAt FROM jobs ORDER BY updatedAt DESC LIMIT 5').all();
    const pubFields = 'publicationId, storyId, renderId, platform, channelId, status, url, title, caption, lastError, scheduledAt, publishedAt, createdAt, updatedAt, layoutVersion, layoutTypes, sceneCount, durationSeconds, priorityScore';
    const publications = db.prepare(`SELECT ${pubFields} FROM publications ORDER BY createdAt DESC, publicationId DESC LIMIT 200`).all();

    // Fingerprint siêu nhẹ để kiểm tra xem có thay đổi trạng thái thật sự không
    const jobsFp = recentJobs.map(j => `${j.jobId}:${j.status}:${j.updatedAt}`).join(';');
    const pubsFp = publications.map(p => `${p.publicationId}:${p.status}:${p.scheduledAt || ''}:${p.publishedAt || ''}:${p.url ? 1 : 0}:${p.lastError ? 1 : 0}`).join(';');
    const currentFp = `${jobsFp}###${pubsFp}`;

    if (currentFp === lastStatusSyncFingerprint) {
      // Dữ liệu không đổi -> Không bắn payload 80KB gây nghẽn mạng & lag giao diện
      return;
    }
    lastStatusSyncFingerprint = currentFp;

    const msg = JSON.stringify({
      type: 'status_sync',
      jobs: recentJobs,
      publications: publications
    });

    logClients.forEach(c => {
      try { c.write(`data: ${msg}\n\n`); } catch(e) {}
    });
  } catch(e) {}
}, 3000);

// Tự động kiểm tra hàng đợi xuất bản đúng khung giờ vàng (mỗi 60s một lần - có khóa chống trùng lặp)
let isSchedulerPublishing = false;
setInterval(async () => {
  if (isSchedulerPublishing) return;
  try {
    const pending = publisher.getPendingPublications();
    if (pending && pending.length > 0) {
      isSchedulerPublishing = true;
      console.log(`\n[PUBLISHER-SCHEDULER] ⏰ Đến khung giờ vàng! Đang xuất bản ${pending.length} video...`);
      await publisher.processQueue();
    }
  } catch(e) {
    console.error("[PUBLISHER-SCHEDULER] Lỗi xử lý hàng đợi:", e.message);
  } finally {
    isSchedulerPublishing = false;
  }
}, 60 * 1000);

// Tự động quét dọn video cũ hơn 24 giờ (chạy khi khởi động và lặp lại mỗi 6 tiếng)
const { cleanupOldVideos } = require('./src/utils/cleanup.js');
try {
  cleanupOldVideos(24);
} catch(e) {}
setInterval(() => {
  try {
    cleanupOldVideos(24);
  } catch(e) {}
}, 6 * 3600 * 1000);

// ============================================
// YOUTUBE ANALYTICS WORKER & API
// ============================================
const { VideoAnalytics } = require('./src/analytics/video_analytics.js');
const videoAnalytics = new VideoAnalytics();

// Đồng bộ số liệu khi khởi động (sau 10s) và lặp lại mỗi 1 giờ
setTimeout(async () => {
  try {
    console.log('[ANALYTICS-WORKER] 📊 Bắt đầu đồng bộ số liệu video khởi động...');
    await videoAnalytics.syncChannelAnalytics();
  } catch(e) {
    console.error('[ANALYTICS-WORKER] Lỗi đồng bộ khởi động:', e.message);
  }
}, 10000);

setInterval(async () => {
  try {
    console.log('[ANALYTICS-WORKER] 📊 Bắt đầu đồng bộ số liệu video định kỳ...');
    await videoAnalytics.syncChannelAnalytics();
  } catch(e) {
    console.error('[ANALYTICS-WORKER] Lỗi đồng bộ định kỳ:', e.message);
  }
}, 60 * 60 * 1000);

app.get('/api/analytics', (req, res) => {
  try {
    const channelId = req.query.channelId || 'channel_domestic';
    const report = videoAnalytics.getChannelReport(channelId);
    res.json(report);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/analytics/sync', async (req, res) => {
  try {
    const channelId = req.body?.channelId || null;
    const result = await videoAnalytics.syncChannelAnalytics(channelId);
    const report = videoAnalytics.getChannelReport(channelId || 'channel_domestic');
    res.json({ ok: true, syncedCount: result.syncedCount, report });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});



// ============================================
// GOOGLE DRIVE ARCHIVE STATUS
// ============================================
const { isDriveAvailable, getDriveConfig } = require('./src/storage/drive_archiver.js');
app.get('/api/drive-status', (req, res) => {
  const { enabled, drivePath } = getDriveConfig();
  const available = isDriveAvailable();
  let videoCount = 0;
  if (available && fs.existsSync(drivePath)) {
    try {
      function countMp4(dir) {
        let count = 0;
        const list = fs.readdirSync(dir);
        for (const f of list) {
          const fp = path.join(dir, f);
          try {
            const stat = fs.statSync(fp);
            if (stat.isDirectory()) count += countMp4(fp);
            else if (f.endsWith('.mp4')) count++;
          } catch(e) {}
        }
        return count;
      }
      videoCount = countMp4(drivePath);
    } catch(e) {}
  }
  res.json({ enabled, available, drivePath, videoCount });
});

// ============================================
// TEST CONNECTION & EXPORT CONFIG
// ============================================
app.post('/api/test-connection', async (req, res) => {
  const { platform } = req.body;
  const confPath = path.join(__dirname, 'config.json');
  let conf = {};
  if (fs.existsSync(confPath)) {
    try { conf = JSON.parse(fs.readFileSync(confPath, 'utf-8')); } catch(e) {}
  }

  try {
    if (platform === 'facebook' || platform === 'instagram') {
      const token = conf.META_ACCESS_TOKEN;
      if (!token) return res.status(400).json({ error: 'Chưa cấu hình META_ACCESS_TOKEN' });

      const { inspectAndResolvePageToken } = require('./src/publishing/providers/meta_token_helper');
      const checkResult = await inspectAndResolvePageToken(token, conf.META_PAGE_ID);

      if (!checkResult.ok) {
        return res.status(400).json({ 
          error: checkResult.message || checkResult.error,
          isExpired: checkResult.isExpired 
        });
      }

      // Nếu token được chuyển đổi sang Page token vĩnh viễn, tự động lưu lại vào config.json
      if (checkResult.token && checkResult.token !== token) {
        conf.META_ACCESS_TOKEN = checkResult.token;
        if (checkResult.pageId) conf.META_PAGE_ID = checkResult.pageId;
        fs.writeFileSync(confPath, JSON.stringify(conf, null, 2), 'utf-8');
      }

      // Tự động khôi phục các bài FAILED sang PENDING để hệ thống thử lại
      try {
        const db = getDb();
        const recovered = db.prepare("UPDATE publications SET status = 'PENDING', lastError = NULL WHERE platform = 'facebook' AND status = 'FAILED'").run();
        if (recovered.changes > 0) {
          console.log(`[Facebook] Đã khôi phục ${recovered.changes} bài viết bị FAILED sang PENDING để xuất bản lại!`);
        }
      } catch(e) {}

      return res.json({ 
        ok: true, 
        message: checkResult.message,
        type: checkResult.type,
        isPermanent: checkResult.isPermanent
      });
    }

    if (platform === 'tiktok') {
      const { checkTikTokLoginStatus } = require('./src/publishing/providers/tiktok_edge_publisher.js');
      const status = await checkTikTokLoginStatus(9222);
      if (status.loggedIn) {
        return res.json({ 
          ok: true, 
          message: 'Trình duyệt tự động đang hoạt động và ĐÃ ĐĂNG NHẬP TikTok Studio thành công! Sẵn sàng xuất bản tự động.' 
        });
      } else if (status.running) {
        return res.status(400).json({ 
          error: 'Trình duyệt đang mở nhưng TÀI KHOẢN CHƯA ĐĂNG NHẬP. Vui lòng đăng nhập trên cửa sổ trình duyệt vừa mở.' 
        });
      } else {
        return res.status(400).json({ 
          error: 'Trình duyệt tự động chưa chạy. Vui lòng bấm nút "🔑 Mở Trình Duyệt Đăng Nhập TikTok" trên Dashboard để mở và đăng nhập.' 
        });
      }
    }

    res.status(400).json({ error: 'Nền tảng không hợp lệ' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/export-config', (req, res) => {
  const confPath = path.join(__dirname, 'config.json');
  if (fs.existsSync(confPath)) {
    res.download(confPath, 'config.json');
  } else {
    res.status(404).send('Không tìm thấy file cấu hình.');
  }
});

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

app.post('/api/settings', async (req, res) => {
  let conf = {};
  if (fs.existsSync(configPath)) {
    try {
      conf = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch(e) {}
  }
  
  const updatedConf = { ...conf, ...req.body };

  // Tự động chuyển đổi sang Page Token vĩnh viễn nếu người dùng dán token mới
  if (req.body && req.body.META_ACCESS_TOKEN && req.body.META_ACCESS_TOKEN !== conf.META_ACCESS_TOKEN) {
    try {
      const { inspectAndResolvePageToken } = require('./src/publishing/providers/meta_token_helper');
      const resolved = await inspectAndResolvePageToken(req.body.META_ACCESS_TOKEN, req.body.META_PAGE_ID || conf.META_PAGE_ID);
      if (resolved.ok && resolved.token) {
        updatedConf.META_ACCESS_TOKEN = resolved.token;
        if (resolved.pageId && !updatedConf.META_PAGE_ID) {
          updatedConf.META_PAGE_ID = resolved.pageId;
        }
      }
    } catch(e) {}
  }

  fs.writeFileSync(configPath, JSON.stringify(updatedConf, null, 2), 'utf-8');
  res.json({ ok: true, settings: updatedConf });
});

app.post('/api/settings/clear-platform', (req, res) => {
  const { platform } = req.body || {};
  let conf = {};
  if (fs.existsSync(configPath)) {
    try {
      conf = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch(e) {}
  }

  if (platform === 'youtube') {
    conf.ENABLE_YOUTUBE = false;
    const tokensFile = path.join(__dirname, 'tokens.json');
    if (fs.existsSync(tokensFile)) {
      try { fs.unlinkSync(tokensFile); } catch(e) {}
    }
  } else if (platform === 'tiktok') {
    conf.ENABLE_TIKTOK = false;
    conf.TIKTOK_CLIENT_KEY = '';
    conf.TIKTOK_CLIENT_SECRET = '';
  } else if (platform === 'facebook') {
    conf.ENABLE_FACEBOOK = false;
    conf.META_PAGE_ID = '';
    if (!conf.ENABLE_INSTAGRAM) {
      conf.META_ACCESS_TOKEN = '';
    }
  } else if (platform === 'instagram') {
    conf.ENABLE_INSTAGRAM = false;
    conf.IG_ACCOUNT_ID = '';
    if (!conf.ENABLE_FACEBOOK) {
      conf.META_ACCESS_TOKEN = '';
    }
  }

  fs.writeFileSync(configPath, JSON.stringify(conf, null, 2), 'utf-8');
  res.json({ ok: true, settings: conf });
});

app.post('/api/publish-queue', async (req, res) => {
  try {
    const { publicationIds } = req.body || {};
    const { Publisher } = require('./src/publishing/publisher.js');
    const pub = new Publisher();
    await pub.processQueue(publicationIds);
    const countMsg = publicationIds && publicationIds.length ? `${publicationIds.length} mục đã chọn` : 'toàn bộ mục chờ đăng';
    res.json({ ok: true, message: `Đã kích hoạt đẩy xuất bản ${countMsg}.` });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/publications/reschedule', (req, res) => {
  try {
    const { publicationId, scheduledAt, channelId } = req.body || {};
    if (!publicationId || !scheduledAt) {
      return res.status(400).json({ error: 'Thiếu publicationId hoặc scheduledAt' });
    }
    const targetDate = new Date(scheduledAt);
    if (isNaN(targetDate.getTime())) {
      return res.status(400).json({ error: 'Định dạng ngày giờ không hợp lệ' });
    }
    const db = getDb();
    if (channelId) {
      db.prepare('UPDATE publications SET scheduledAt = ?, channelId = ?, status = ? WHERE publicationId = ?')
        .run(targetDate.toISOString(), channelId, 'PENDING', publicationId);
    } else {
      db.prepare('UPDATE publications SET scheduledAt = ?, status = ? WHERE publicationId = ?')
        .run(targetDate.toISOString(), 'PENDING', publicationId);
    }
    res.json({ ok: true, message: `Đã đổi giờ hẹn sang: ${targetDate.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/publications/compact-schedule', (req, res) => {
  try {
    const { channelId } = req.body || {};
    delete require.cache[require.resolve('./src/publishing/publisher.js')];
    const { Publisher } = require('./src/publishing/publisher.js');
    const pub = new Publisher();
    const result = pub.compactSchedule(channelId);
    res.json({ ok: true, ...result, message: `Đã tự động dồn lịch lấp đầy các khung giờ vàng cho ${result.updatedCount || 0} video.` });
  } catch(e) {
    res.status(500).json({ ok: false, error: e.message });
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
    const { publicationIds } = req.body || {};
    const db = getDb();
    if (publicationIds && Array.isArray(publicationIds) && publicationIds.length > 0) {
      const placeholders = publicationIds.map(() => '?').join(',');
      db.prepare(`DELETE FROM publications WHERE publicationId IN (${placeholders})`).run(...publicationIds);
      res.json({ ok: true, message: `Đã xóa ${publicationIds.length} mục đã chọn.` });
    } else {
      db.prepare('DELETE FROM publications').run();
      res.json({ ok: true, message: 'Đã dọn dẹp toàn bộ hàng đợi.' });
    }
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

async function runAutonomousTrendCycle(force = false) {
  if (trendScanning) return;
  trendScanning = true;
  cachedTrends = null; // Invalidate previous cache
  
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
    if (currentRunState.active || activePipelineProcess) {
      // Đang có một tiến trình render video chạy dở, hoãn kích hoạt 30s để tránh xung đột tài nguyên GPU/Remotion
      cachedTrends.expiresAt = Date.now() + 30000;
      return;
    }
    cachedTrends.actionTaken = true;
    if (cachedTrends.autoAction === 'auto_pick' && cachedTrends.data && cachedTrends.data.suggestions && cachedTrends.data.suggestions.length > 0) {
      const { getDailyPublishStatus } = require('./trend_bot.js');
      const suggestions = cachedTrends.data.suggestions;
      const uncreated = suggestions.filter(s => !s.isAlreadyCreated);
      const pool = uncreated.length > 0 ? uncreated : suggestions;

      // 1. Tự động chọn bài Tiếng Việt xuất sắc nhất (Thời Sự VN hoặc Kai Viet Tech)
      const vnPool = pool.filter(s => s.language !== 'en');
      if (vnPool.length > 0) {
        const sortedVn = [...vnPool].sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0));
        const topVn = sortedVn[0];
        const vnChannel = topVn.channelId || 'channel_domestic';
        const vnStatus = getDailyPublishStatus(vnChannel);
        const vnLimitReached = (vnChannel === 'channel_domestic') ? (vnStatus.limitVnReached || vnStatus.limitReached) : vnStatus.limitReached;

        if (!vnLimitReached) {
          const scoreVn = topVn.impactScore || 8;
          const isPriorityVn = scoreVn >= 9.0;
          console.log(`\n⚡ [TREND-ENGINE] Tự động chọn bài Tiếng Việt (${scoreVn}/10đ): "${topVn.title}" [${vnChannel}]`);
          addToVideoQueue(topVn.link, topVn.title, topVn.source, topVn.category, scoreVn, isPriorityVn, vnChannel, topVn.scope, topVn.language || 'vi');
        } else {
          console.log(`\n🛡️ [CHỐNG SPAM] Kênh Tiếng Việt [${vnChannel}] đã đạt giới hạn hôm nay (${vnStatus.todayVnCount || vnStatus.todayCount}/${vnStatus.maxVideosDomestic || vnStatus.maxVideos}). Bỏ qua tự chọn bài VN.`);
        }
      }

      // 2. Tự động chọn bài Tiếng Anh FactLoop cho Kênh 1 (Vũ trụ, SpaceX, Khoa học kỳ thú quốc tế, tối đa 4 bài/ngày)
      const domesticStatus = getDailyPublishStatus('channel_domestic');
      if (!domesticStatus.limitEnReached && !domesticStatus.limitReached) {
        const enPoolForDomestic = pool.filter(s => (s.channelId === 'channel_domestic' && s.language === 'en') || (s.language === 'en' && !s.isAlreadyCreated));
        if (enPoolForDomestic.length > 0) {
          const sortedEnDom = [...enPoolForDomestic].sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0));
          const topEnDom = sortedEnDom[0];
          const scoreEnDom = topEnDom.impactScore || 8;
          const isPriorityEnDom = scoreEnDom >= 9.0;
          console.log(`\n🚀 [TREND-ENGINE] Tự động chọn bài FactLoop Tiếng Anh cho KÊNH 1 (${scoreEnDom}/10đ): "${topEnDom.title}" [SpaceX / Science]`);
          addToVideoQueue(topEnDom.link, topEnDom.title, topEnDom.source, topEnDom.category, scoreEnDom, isPriorityEnDom, 'channel_domestic', 'international', 'en');
        }
      }

      // 3. Tự động chọn bài Tiếng Anh xuất sắc nhất cho Kênh 3 (Curious Globe US/Global)
      const globalPool = pool.filter(s => s.channelId === 'channel_global' || s.language === 'en');
      if (globalPool.length > 0) {
        const globalStatus = getDailyPublishStatus('channel_global');
        if (!globalStatus.limitReached) {
          const sortedGlobal = [...globalPool].sort((a, b) => (b.impactScore || 0) - (a.impactScore || 0));
          // Chọn bài khác bài Kênh 1 vừa chọn (nếu có thể)
          const topGlobal = sortedGlobal.find(g => !videoGenerationQueue.some(q => q.target === g.link)) || sortedGlobal[0];
          const scoreGlobal = topGlobal.impactScore || 8;
          const isPriorityGlobal = scoreGlobal >= 9.0;
          console.log(`\n🌍 [TREND-ENGINE] Tự động chọn bài Tiếng Anh cho KÊNH 3 (${scoreGlobal}/10đ): "${topGlobal.title}" [Curious Globe]`);
          addToVideoQueue(topGlobal.link, topGlobal.title, topGlobal.source, topGlobal.category, scoreGlobal, isPriorityGlobal, 'channel_global', 'international', 'en');
        } else {
          console.log(`\n🛡️ [CHỐNG SPAM] Kênh 3 (Curious Globe) đã đạt giới hạn hôm nay (${globalStatus.todayCount}/${globalStatus.maxVideos}). Bỏ qua tự chọn.`);
        }
      }
    } else {
      console.log("\n[TREND-ENGINE] Hết hạn chờ người dùng! Tự động bỏ qua theo cấu hình.");
    }
  }
}, 5000);

// Chu kỳ quét tự động mỗi 30 phút một lần
setInterval(runAutonomousTrendCycle, 30 * 60 * 1000);
// Khởi chạy quét lần đầu sau 10 giây khi khởi động server
setTimeout(runAutonomousTrendCycle, 10000);

app.get('/api/trends', async (req, res) => {
  const { getDailyPublishStatus } = require('./trend_bot.js');
  const dailyStatus = getDailyPublishStatus();

  if (trendScanning) {
    return res.json({ status: 'LOADING', dailyStatus });
  }

  const queueTargets = videoGenerationQueue.map((item, idx) => ({
    target: item.target,
    position: idx + 1,
    title: item.title
  }));

  if (cachedTrends) {
    const remaining = Math.floor((cachedTrends.expiresAt - Date.now()) / 1000);
    cachedTrends.remainingSeconds = remaining > 0 ? remaining : 0;
    cachedTrends.currentActiveTarget = (currentRunState.active ? currentRunState.target : null);
    cachedTrends.queueTargets = queueTargets;
    cachedTrends.dailyStatus = dailyStatus;
  }

  res.json({
    ...(cachedTrends || { status: 'LOADING' }),
    dailyStatus,
    currentActiveTarget: (currentRunState.active ? currentRunState.target : null),
    queueTargets
  });
});

app.post('/api/trends/dismiss', (req, res) => {
  if (cachedTrends) {
    cachedTrends.actionTaken = true;
    cachedTrends.remainingSeconds = 0;
  }
  res.json({ ok: true });
});

app.post('/api/trends/refresh', async (req, res) => {
  cachedTrends = null;
  runAutonomousTrendCycle(true).catch(console.error);
  res.json({ ok: true, message: 'Đã kích hoạt quét lại tin tức.' });
});


app.listen(PORT, '::', () => {
  console.log(`\n🚀 [Factory Dashboard V2] Server started at http://localhost:${PORT}`);
  console.log(`✅ Durable Worker is running in background...`);
  setTimeout(() => {
    if (videoGenerationQueue.length > 0) {
      console.log(`\nKhôi phục hàng đợi: Đang xử lý ${videoGenerationQueue.length} video bị kẹt...`);
      processVideoQueue();
    }
  }, 3000);
});

process.on('SIGINT', () => {
  worker.stop();
  process.exit(0);
});
