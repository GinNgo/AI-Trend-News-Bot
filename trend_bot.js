require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getModelsForTask, blockModel, getModelBlockTimeRemaining } = require('./src/ai/model_router.js');

const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  }
});

const configPath = path.join(__dirname, 'config.json');
let config = {};
try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch(e){}
// Load config
const genAI = new GoogleGenerativeAI(config.GEMINI_API_KEY || process.env.GEMINI_API_KEY);

function getBotConfig() {
  const configPath = path.join(__dirname, 'config.json');
  let conf = { GEMINI_MODEL: 'gemini-3.5-flash-lite' };
  if (fs.existsSync(configPath)) {
    try { conf = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (e) {}
  }
  return conf;
}

const HISTORY_FILE = path.join(__dirname, 'trend_history.json');
const MAX_VIDEOS_PER_DAY = 6; // Giới hạn số video tự động đăng mỗi ngày để bảo vệ kênh

// Nguồn RSS uy tín cập nhật liên tục từng phút
const RSS_FEEDS = [
  { name: 'Hacker News', url: 'https://hnrss.org/front' },
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/' },
  { name: 'The Verge Tech', url: 'https://www.theverge.com/tech/rss/index.xml' },
  { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/' },
  { name: 'Google News VN (Xu Hướng)', url: 'https://news.google.com/rss?hl=vi&gl=VN&ceid=VN:vi' },
  { name: 'VnExpress Tin Mới', url: 'https://vnexpress.net/rss/tin-moi-nhat.rss' },
  { name: 'Tuổi Trẻ Tin Nóng', url: 'https://tuoitre.vn/rss/tin-moi-nhat.rss' }
];

// Thời gian tối đa của một bản tin (tính bằng giờ)
// Tin cũ hơn số giờ này sẽ bị tự động loại bỏ để đảm bảo tính thời sự.
const MAX_NEWS_AGE_HOURS = 72;

function getHistory() {
  if (!fs.existsSync(HISTORY_FILE)) {
    return { published: [], dailyCount: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
  } catch (e) {
    return { published: [], dailyCount: {} };
  }
}

function saveHistory(history) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
}

function canPublishToday(history) {
  const today = new Date().toISOString().split('T')[0];
  const count = history.dailyCount[today] || 0;
  return count < MAX_VIDEOS_PER_DAY;
}

function recordPublished(title, link) {
  const history = getHistory();
  const today = new Date().toISOString().split('T')[0];
  history.dailyCount[today] = (history.dailyCount[today] || 0) + 1;
  history.published.push({
    title,
    link,
    publishedAt: new Date().toISOString()
  });
  saveHistory(history);
}

// 1. Quét các nguồn RSS để gom tin tức mới
async function fetchLatestNews(logFn = console.log) {
  const allItems = [];
  const history = getHistory();
  const publishedLinks = new Set(history.published.map(p => p.link));
  const publishedTitles = new Set(history.published.map(p => p.title.toLowerCase().trim()));

  for (const feed of RSS_FEEDS) {
    try {
      logFn(`  📡 Đang quét nguồn: ${feed.name}...`);
      const parsed = await parser.parseURL(feed.url);
      if (parsed && parsed.items) {
        for (const item of parsed.items.slice(0, 30)) { // Lấy 10 tin mới nhất mỗi nguồn
          const title = (item.title || '').trim();
          const link = item.link;
          if (!title || !link) continue;

          // Bỏ qua nếu đã làm video về tin này
          if (publishedLinks.has(link) || publishedTitles.has(title.toLowerCase())) {
            continue;
          }

          // Kiểm tra thời gian xuất bản của tin tức
          let ageHours = 0;
          if (item.pubDate) {
            const pubTime = new Date(item.pubDate).getTime();
            if (!isNaN(pubTime)) {
              ageHours = (Date.now() - pubTime) / (1000 * 60 * 60);
              // Bỏ qua tin cũ hơn MAX_NEWS_AGE_HOURS (VD: hơn 3 tiếng trước)
              if (ageHours > MAX_NEWS_AGE_HOURS) {
                continue;
              }
            }
          }

          allItems.push({
            title,
            link,
            pubDate: item.pubDate,
            ageHours: Math.round(ageHours * 10) / 10,
            snippet: item.contentSnippet || item.content || ''
          });
        }
      }
    } catch (err) {
      logFn(`  ⚠️ Lỗi khi cào nguồn ${feed.name}: ${err.message}`);
    }
  }

  logFn(`  ✅ Đã quét xong ${RSS_FEEDS.length} nguồn. Tìm thấy ${allItems.length} bài viết tiềm năng (đã lọc tin cũ và trùng lặp).`);
  return allItems;
}

// 2. Dùng Gemini để lọc ra 1 tin HOT nhất đáng làm video
async function selectBestTrendingArticle(newsList, logFn = console.log) {
  if (newsList.length === 0) return null;

  logFn(`  🧠 Gửi ${newsList.length} tin mới nhất sang AI phân tích xu hướng...`);

  const prompt = `
Dưới đây là danh sách các tin tức vừa xuất bản tại Việt Nam và Thế Giới.
Hãy phân tích và đánh giá mức độ ảnh hưởng của từng tin (tác động kinh tế, xã hội, công nghệ, ngoại giao, đời sống diện rộng, sự kiện đột phá).

YÊU CẦU:
1. Hãy CHỌN DUY NHẤT 1 TIN CÓ TẦM ẢNH HƯỞNG LỚN NHẤT HOẶC ĐANG LÀ TÂM ĐIỂM DƯ LUẬN để làm video YouTube Shorts.
2. Tin phải mang tính thời sự, hấp dẫn người xem trong 30-60 giây.
3. Nếu tất cả các tin đều là tin vụn vặt, tin giải trí nhỏ lẻ, tai nạn cá nhân hoặc không có gì nổi bật, hãy trả về null.

DANH SÁCH TIN:
${newsList.slice(0, 30).map((n, idx) => `[${idx + 1}] Tiêu đề: ${n.title}\nLink: ${n.link}\nThời gian: ${n.ageHours} giờ trước\nMô tả: ${n.snippet.substring(0, 150)}`).join('\n---\n')}

TRẢ VỀ DUY NHẤT 1 ĐỊNH DẠNG JSON HỢP LỆ (KHÔNG BỌC \`\`\`json):
{
  "hasTrend": true, // hoặc false nếu không có tin nào đáng làm
  "selectedIndex": 1, // Số thứ tự [1..15]
  "title": "Tiêu đề tin được chọn",
  "link": "Link bài báo được chọn",
  "reason": "Lý do vì sao tin này quan trọng và hút người xem",
  "impactScore": 9, // Thang điểm 1-10
  "scope": "domestic", // "domestic" (quốc nội) hoặc "international" (quốc tế)
  "suggestedTitle": "Tiêu đề chuyên nghiệp, tự nhiên (Ví dụ: Tiêu điểm, Khám phá, Phân tích... không dùng Tin Nóng Hổi)",
  "suggestedCaption": "Caption khách quan kèm hashtag"
}
  `;

  try {
    let text = "";
    const config = getBotConfig();
    const modelsToTry = getModelsForTask('FILTER', config.GEMINI_MODEL || 'gemini-3.5-flash-lite');
    let success = false;
    for (const m of modelsToTry) {
      if (getModelBlockTimeRemaining(m) > 0) continue;

      try {
        const model = genAI.getGenerativeModel({ model: m });
        const res = await model.generateContent(prompt);
        text = res.response.text();
        success = true;
        break;
      } catch (e) {
        logFn(`  ⚠️ Model ${m} lỗi: ${e.message}.`);
        if (e.message.includes("429") || e.message.includes("Quota") || e.message.includes("retry in")) {
          let waitSecs = 60; // default
          const match = e.message.match(/retry in ([0-9.]+)s/i) || e.message.match(/retryDelay":"([0-9]+)s"/i);
          if (match) {
            waitSecs = Math.ceil(parseFloat(match[1])) + 1;
          }
          logFn(`  🚫 Đưa ${m} vào danh sách cấm (Blacklist) trong ${waitSecs}s.`);
          blockModel(m, waitSecs);
        } else if (e.message.includes("503")) {
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    }

    if (!success) {
      logFn(`  ❌ Tất cả các model đều lỗi!`);
      return null;
    }

    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    const decision = JSON.parse(text);
    if (decision && decision.hasTrend && decision.impactScore >= 7) {
      logFn(`  🔥 PHÁT HIỆN TIN NÓNG: "${decision.title}" (Điểm HOT: ${decision.impactScore}/10)`);
      logFn(`  💡 Lý do: ${decision.reason}`);
      return decision;
    } else {
      logFn(`  💤 Không có tin nào đủ nóng (Điểm ảnh hưởng chưa đạt ngưỡng >= 7). Bỏ qua lượt này.`);
      return null;
    }
  } catch (err) {
    logFn(`  ⚠️ Lỗi AI đánh giá tin: ${err.message}`);
    return null;
  }
}

// 3. Hàm kích hoạt một chu kỳ kiểm tra
async function runTrendCheck(logFn = console.log) {
  logFn(`\n[${new Date().toLocaleTimeString()}] 🚀 BẮT ĐẦU CHU KỲ QUÉT TIN XU HƯỚNG...`);

  const history = getHistory();
  if (!canPublishToday(history)) {
    logFn(`⏸️ Đã đạt giới hạn tối đa ${MAX_VIDEOS_PER_DAY} video/ngày. Tạm dừng tạo thêm hôm nay.`);
    return null;
  }

  const newsList = await fetchLatestNews(logFn);
  if (newsList.length === 0) {
    logFn(`ℹ️ Chưa có tin tức mới nào chưa xử lý.`);
    return null;
  }

  const selected = await selectBestTrendingArticle(newsList, logFn);
  return selected;
}

async function getTrendSuggestions(logFn = console.log) {
  const history = getHistory();
  if (!canPublishToday(history)) {
    return { status: 'LIMIT_REACHED', suggestions: [] };
  }

  const newsList = await fetchLatestNews(logFn);
  if (newsList.length === 0) {
    return { status: 'NO_NEWS', suggestions: [] };
  }

  logFn(`  🧠 Gửi ${newsList.length} tin mới nhất sang AI phân tích xu hướng và lấy TOP 3...`);
  const prompt = `
Dưới đây là danh sách các tin tức vừa xuất bản.
Hãy CHỌN RA TỐI ĐA 3 TIN CÓ TẦM ẢNH HƯỞNG LỚN NHẤT.

DANH SÁCH TIN:
${newsList.slice(0, 30).map((n, idx) => `[${idx + 1}] Tiêu đề: ${n.title}\nLink: ${n.link}\nThời gian: ${n.ageHours} giờ trước\nMô tả: ${n.snippet.substring(0, 150)}`).join('\n---\n')}

TRẢ VỀ DUY NHẤT 1 MẢNG JSON HỢP LỆ:
[
  {
    "selectedIndex": 1,
    "title": "Tiêu đề tin",
    "link": "Link bài báo",
    "reason": "Lý do vì sao tin này quan trọng",
    "impactScore": 9,
    "category": "CÔNG NGHỆ"
  }
]
  `;

  try {
    const config = getBotConfig();
    let text = "";
    const modelsToTry = getModelsForTask('FILTER', config.GEMINI_MODEL || 'gemini-3.5-flash-lite');

    let success = false;
    for (const m of modelsToTry) {
      if (getModelBlockTimeRemaining(m) > 0) continue;

      try {
        const model = genAI.getGenerativeModel({ model: m });
        const res = await model.generateContent(prompt);
        text = res.response.text();
        success = true;
        break;
      } catch (e) {
        logFn(`  ⚠️ Model ${m} lỗi: ${e.message}.`);
        if (e.message.includes("429") || e.message.includes("Quota") || e.message.includes("retry in")) {
          let waitSecs = 60; // default
          const match = e.message.match(/retry in ([0-9.]+)s/i) || e.message.match(/retryDelay":"([0-9]+)s"/i);
          if (match) {
            waitSecs = Math.ceil(parseFloat(match[1])) + 1;
          }
          logFn(`  🚫 Đưa ${m} vào danh sách cấm (Blacklist) trong ${waitSecs}s.`);
          blockModel(m, waitSecs);
        } else if (e.message.includes("503")) {
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    }

    if (!success) return { status: 'AI_ERROR', suggestions: [] };

    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    let decision = [];
    try { decision = JSON.parse(text); } catch(e) { return { status: 'PARSE_ERROR', suggestions: [] }; }

    if (Array.isArray(decision) && decision.length > 0 && decision[0].impactScore >= 6) {
      return { status: 'SUCCESS', suggestions: decision };
    } else {
      return { status: 'NO_HOT_NEWS', suggestions: [] };
    }
  } catch (err) {
    return { status: 'ERROR', suggestions: [] };
  }
}

module.exports = {
  runTrendCheck,
  getTrendSuggestions,
  recordPublished,
  getHistory
};

const { spawnSync } = require('child_process');

// Nếu chạy trực tiếp từ dòng lệnh: node trend_bot.js
if (require.main === module) {
  runTrendCheck().then(result => {
    if (result) {
      console.log('\n🎯 KẾT QUẢ: Sẵn sàng đưa vào Pipeline:', result);
      console.log(`\n🔗 BẮT ĐẦU KẾT NỐI CHUỖI API (TỰ ĐỘNG LÀM VIDEO & ĐĂNG YOUTUBE)...`);
      try {
        // 1. Chạy auto_pipeline để render video
        console.log(`\n▶️ CHẠY AUTO PIPELINE (Cào chi tiết, Dựng script AI, TTS, Remotion)...`);
        spawnSync('node', ['auto_pipeline.js', result.link], { stdio: 'inherit' });

        // 2. Ghi metadata cho YouTube
        console.log(`\n▶️ GHI METADATA CHO YOUTUBE...`);
        const metaPath = path.join(__dirname, 'youtube_meta.json');
        fs.writeFileSync(metaPath, JSON.stringify({
          title: `${result.title.substring(0, 80)} #shorts`,
          description: `Bản Tin Nóng: ${result.title}\n\n${result.reason}\n\nNguồn: ${result.link}\n\n#shorts #tintuc #xuhuong #vietnam #news`,
          tags: ['shorts', 'tin tức', 'xu hướng', 'việt nam', 'news'],
          privacyStatus: 'public'
        }, null, 2), 'utf-8');

        // 3. Đăng lên YouTube
        console.log(`\n▶️ GỌI API YOUTUBE (Tải video lên kênh)...`);
        spawnSync('node', ['upload_youtube.js'], { stdio: 'inherit' });

        console.log(`\n✅ TOÀN BỘ CHUỖI API ĐÃ HOÀN TẤT VÀ LIÊN KẾT THÀNH CÔNG!`);
        recordPublished(result.title, result.link);
      } catch (err) {
        console.error(`\n❌ LỖI KHI KẾT NỐI CHUỖI API:`, err.message);
      }
    } else {
      console.log('\n💤 Không có tin nóng cần làm video.');
    }
  });
}
