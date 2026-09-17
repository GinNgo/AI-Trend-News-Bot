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

// Nguồn RSS uy tín cập nhật liên tục từng phút (Quốc tế & Việt Nam)
// Mỗi nguồn có tag category để AI ưu tiên nội dung phù hợp khán giả VN
const RSS_FEEDS = [
  // --- US & Global Explainer / Space, SpaceX & Mind-Blowing Science (Factloop / Curious Globe) ---
  { name: 'Universe Today Space & Rockets', url: 'https://www.universetoday.com/feed', category: 'GLOBAL_EXPLAINER', scope: 'international', language: 'en' },
  { name: 'NASA News Releases', url: 'https://www.nasa.gov/news-release/feed/', category: 'GLOBAL_EXPLAINER', scope: 'international', language: 'en' },
  { name: 'SciTechDaily Viral', url: 'https://scitechdaily.com/feed/', category: 'GLOBAL_EXPLAINER', scope: 'international', language: 'en' },
  { name: 'LiveScience Feed', url: 'https://www.livescience.com/feeds/all', category: 'GLOBAL_EXPLAINER', scope: 'international', language: 'en' },
  { name: 'Space.com Discovery', url: 'https://www.space.com/feeds/all', category: 'GLOBAL_EXPLAINER', scope: 'international', language: 'en' },
  { name: 'Popular Mechanics Explainer', url: 'https://www.popularmechanics.com/rss/all.xml/', category: 'GLOBAL_EXPLAINER', scope: 'international', language: 'en' },
  { name: 'BBC Science & Env', url: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml', category: 'GLOBAL_EXPLAINER', scope: 'international', language: 'en' },
  { name: 'Wired Science', url: 'https://www.wired.com/feed/category/science/latest/rss', category: 'GLOBAL_EXPLAINER', scope: 'international', language: 'en' },

  // --- Báo Quốc tế: Tech, AI & Kinh tế thế giới (Kênh Kai Viet & Global) ---
  { name: 'TechCrunch', url: 'https://techcrunch.com/feed/', category: 'TECH_QUỐC_TẾ', scope: 'international', language: 'en' },
  { name: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'TECH_QUỐC_TẾ', scope: 'international', language: 'en' },
  { name: 'Wired Top Stories', url: 'https://www.wired.com/feed/rss', category: 'TECH_GLOBAL', scope: 'international', language: 'en' },
  { name: 'BBC World News', url: 'http://feeds.bbci.co.uk/news/world/rss.xml', category: 'THẾ_GIỚI', scope: 'international', language: 'en' },
  { name: 'CNN Top Stories', url: 'http://rss.cnn.com/rss/edition.rss', category: 'THẾ_GIỚI', scope: 'international', language: 'en' },
  { name: 'CNBC Top News', url: 'https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114', category: 'KINH_TẾ_QUỐC_TẾ', scope: 'international', language: 'en' },
  { name: 'Al Jazeera World', url: 'https://www.aljazeera.com/xml/rss/all.xml', category: 'WORLD_GLOBAL', scope: 'international', language: 'en' },

  // --- Báo Nội địa Việt Nam: Tin tổng hợp & Thời sự ---
  { name: 'Google News VN (Xu Hướng)', url: 'https://news.google.com/rss?hl=vi&gl=VN&ceid=VN:vi', category: 'TỔNG_HỢP_VN', scope: 'domestic', language: 'vi' },
  { name: 'VnExpress Tin Mới', url: 'https://vnexpress.net/rss/tin-moi-nhat.rss', category: 'TỔNG_HỢP_VN', scope: 'domestic', language: 'vi' },
  { name: 'VnExpress Thời Sự', url: 'https://vnexpress.net/rss/thoi-su.rss', category: 'THỜI_SỰ_VN', scope: 'domestic', language: 'vi' },
  { name: 'Tuổi Trẻ Tin Nóng', url: 'https://tuoitre.vn/rss/tin-moi-nhat.rss', category: 'TỔNG_HỢP_VN', scope: 'domestic', language: 'vi' },
  { name: 'Thanh Niên Tin Nhanh', url: 'https://thanhnien.vn/rss/home.rss', category: 'TỔNG_HỢP_VN', scope: 'domestic', language: 'vi' },
  { name: 'Dân Trí Tin Mới', url: 'https://dantri.com.vn/rss/tin-moi-nhat.rss', category: 'TỔNG_HỢP_VN', scope: 'domestic', language: 'vi' },
  { name: 'VietnamNet Thời Sự', url: 'https://vietnamnet.vn/rss/thoi-su.rss', category: 'THỜI_SỰ_VN', scope: 'domestic', language: 'vi' },
  { name: 'CafeF Thị Trường', url: 'https://cafef.vn/thi-truong.rss', category: 'KINH_TẾ_VN', scope: 'domestic', language: 'vi' },

  // --- Đời sống, Giải trí, Giới trẻ VN (ƯU TIÊN CAO cho kênh YouTube Shorts VN) ---
  { name: 'VnExpress Đời Sống', url: 'https://vnexpress.net/rss/doi-song.rss', category: 'ĐỜI_SỐNG_VN', scope: 'domestic', language: 'vi' },
  { name: 'VnExpress Giải Trí', url: 'https://vnexpress.net/rss/giai-tri.rss', category: 'GIẢI_TRÍ_VN', scope: 'domestic', language: 'vi' },
  { name: 'VnExpress Khoa Học', url: 'https://vnexpress.net/rss/khoa-hoc.rss', category: 'KHOA_HỌC', scope: 'domestic', language: 'vi' },
  { name: 'VnExpress Thế Giới', url: 'https://vnexpress.net/rss/the-gioi.rss', category: 'THẾ_GIỚI_VN', scope: 'domestic', language: 'vi' },
  { name: 'Tuổi Trẻ Nhịp Sống Trẻ', url: 'https://tuoitre.vn/rss/nhip-song-tre.rss', category: 'GIỚI_TRẺ_VN', scope: 'domestic', language: 'vi' },
  { name: 'Tuổi Trẻ Giải Trí', url: 'https://tuoitre.vn/rss/giai-tri.rss', category: 'GIẢI_TRÍ_VN', scope: 'domestic', language: 'vi' },
  { name: 'Dân Trí Sự Kiện', url: 'https://dantri.com.vn/rss/su-kien.rss', category: 'SỰ_KIỆN_VN', scope: 'domestic', language: 'vi' },
  { name: 'Dân Trí Đời Sống', url: 'https://dantri.com.vn/rss/doi-song.rss', category: 'ĐỜI_SỐNG_VN', scope: 'domestic', language: 'vi' },
  { name: 'GenK (Công nghệ Tiêu dùng)', url: 'https://genk.vn/rss/home.rss', category: 'TECH_TIÊU_DÙNG_VN', scope: 'domestic', language: 'vi' },
  { name: 'Kênh 14 (Giới trẻ)', url: 'https://kenh14.vn/rss/home.rss', category: 'GIỚI_TRẺ_VN', scope: 'domestic', language: 'vi' }
];

// Thời gian tối đa của một bản tin (tính bằng giờ). Có thể chỉnh trong config.json (0 = không giới hạn)
function getMaxNewsAgeHours() {
  const conf = getBotConfig();
  if (conf.MAX_NEWS_AGE_HOURS !== undefined && conf.MAX_NEWS_AGE_HOURS !== '') {
    const val = parseInt(conf.MAX_NEWS_AGE_HOURS, 10);
    return isNaN(val) ? 72 : val;
  }
  return 72; // Mặc định 72 tiếng (3 ngày)
}

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

// Lấy toàn bộ lịch sử đã từng tạo video (từ trend_history.json + SQLite jobs & publications)
function getAllCreatedHistory() {
  const history = getHistory();
  const list = [...(history.published || [])];

  try {
    const { getDb } = require('./src/storage/db.js');
    const db = getDb();

    // 1. Lấy từ bảng jobs (nếu chạy qua durable worker)
    const rows = db.prepare(`
      SELECT jobId, stage, status, payload, createdAt
      FROM jobs
      WHERE status IN ('COMPLETED', 'PUBLISHED')
         OR stage IN ('RENDERING', 'QC', 'APPROVAL', 'PUBLISHING')
      ORDER BY createdAt DESC
      LIMIT 100
    `).all();

    for (const r of rows) {
      if (!r.payload) continue;
      try {
        const p = typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload;
        const link = p.sourceUrl || (p.article && p.article.url) || '';
        const title = (p.article && p.article.title) || (p.storyPackage && p.storyPackage.title) || '';
        if (title || link) {
          list.push({ title, link, publishedAt: r.createdAt });
        }
      } catch (e) {}
    }

    // 2. Lấy từ bảng publications (các video đã render thành công hoặc đang hẹn giờ đăng)
    const pubRows = db.prepare(`
      SELECT title, description, createdAt
      FROM publications
      ORDER BY createdAt DESC
      LIMIT 100
    `).all();

    for (const pub of pubRows) {
      if (pub.title) {
        const cleanTitle = pub.title.replace(/\s*\|.*$/, '').replace(/#\w+/g, '').trim();
        if (cleanTitle.length > 5) {
          list.push({ title: cleanTitle, link: '', publishedAt: pub.createdAt });
        }
      }
    }
  } catch (e) {}

  // Lọc trùng lặp tiêu đề trong danh sách lịch sử
  const seen = new Set();
  const dedupedList = [];
  for (const item of list) {
    const key = (item.title || '').toLowerCase().trim();
    if (key && !seen.has(key)) {
      seen.add(key);
      dedupedList.push(item);
    }
  }

  return dedupedList;
}

const STOP_WORDS = new Set([
  // Tiếng Việt (chia theo từng từ đơn)
  'là', 'và', 'của', 'được', 'với', 'cho', 'trong', 'ra', 'khi', 'sau', 'trước',
  'đã', 'ở', 'tại', 'vừa', 'mới', 'về', 'có', 'lại', 'lúc', 'nhưng', 'này', 'đó',
  'gì', 'sao', 'thế', 'nào', 'mấy', 'bao', 'nhiêu', 'báo', 'tin', 'tức', 'thời', 'sự',
  'bản', 'nóng', 'nhất', 'hôm', 'nay', 'mai', 'qua', 'chính', 'thức', 'bất', 'ngờ',
  'cảnh', 'báo', 'chú', 'ý', 'bùng', 'nổ', 'doanh', 'thu', 'kỷ', 'lục', 'đột', 'phá',
  'phát', 'hiện', 'ra', 'mắt', 'những', 'các', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu',
  'bảy', 'tám', 'chín', 'mười', 'nhiều', 'rất', 'quá', 'như', 'đến', 'từ', 'theo',
  'thì', 'sẽ', 'bị', 'do', 'để', 'bởi', 'việt', 'nam', 'quốc', 'tế', 'thế', 'giới',
  'thanh', 'niên', 'tuổi', 'trẻ', 'vnexpress', 'dân', 'trí', 'vietnamnet', 'genk',
  'kênh', '14', 'cafef', 'shorts', 'video', 'clip', 'hình', 'ảnh', 'chùm', 'toàn',
  'top', 'lọt', 'điểm', 'hàng', 'đầu', 'triệu', 'tỷ', 'nghìn', 'người', 'mở', 'rộng',
  'khắp', 'nơi', 'nhiều', 'nhất', 'cuộc', 'bước', 'được',
  // English Stop Words
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'up', 'about', 'into', 'over', 'after', 'is', 'are', 'was', 'were',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'should', 'could', 'may', 'might', 'must', 'can', 'it', 'its', 'they', 'their',
  'this', 'that', 'these', 'those', 'which', 'who', 'whom', 'what', 'where', 'when',
  'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
  'says', 'said', 'report', 'reports', 'reported', 'new', 'news', 'year', 'years',
  'day', 'days', 'today', 'first', 'last', 'post', 'brief', 'confirms', 'confirmed',
  'data', 'breach', 'via', 'fake', 'giant', 'calls', 'slow', 'down'
]);

function getSignificantTokens(text) {
  if (!text) return { words: new Set(), bigrams: new Set() };
  const clean = text.toLowerCase()
    .replace(/\s*\|.*$/, '')
    .replace(/#\w+/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const rawWords = clean.split(' ').filter(w => w.length >= 2);
  const words = new Set();
  for (const w of rawWords) {
    if (!STOP_WORDS.has(w)) words.add(w);
  }
  const bigrams = new Set();
  for (let i = 0; i < rawWords.length - 1; i++) {
    const w1 = rawWords[i];
    const w2 = rawWords[i + 1];
    if (!STOP_WORDS.has(w1) && !STOP_WORDS.has(w2)) {
      bigrams.add(`${w1} ${w2}`);
    }
  }
  return { words, bigrams };
}

function computeTopicSimilarity(title1, title2) {
  const t1 = getSignificantTokens(title1);
  const t2 = getSignificantTokens(title2);

  const commonWords = [];
  for (const w of t1.words) {
    if (t2.words.has(w)) commonWords.push(w);
  }

  const commonBigrams = [];
  for (const b of t1.bigrams) {
    if (t2.bigrams.has(b)) commonBigrams.push(b);
  }

  const totalWords = t1.words.size + t2.words.size || 1;
  const totalBigrams = t1.bigrams.size + t2.bigrams.size || 1;
  const wordSim = (2 * commonWords.length) / totalWords;
  const bigramSim = (2 * commonBigrams.length) / totalBigrams;

  // Điều kiện trùng sự kiện giữa 2 bài báo khác nhau:
  // - Trùng từ 2 cụm từ ghép có nghĩa (bigram) trở lên (ví dụ: "vòi rồng", "gia lai")
  // - Hoặc độ tương đồng từ vựng cốt lõi >= 50% và có ít nhất 3 từ khóa trùng
  // - Hoặc trùng 1 cụm bigram và có từ 4 từ khóa cốt lõi trùng nhau
  const isMatch = (commonBigrams.length >= 2) ||
                  (wordSim >= 0.5 && commonWords.length >= 3) ||
                  (commonBigrams.length >= 1 && commonWords.length >= 4);

  return {
    isMatch,
    wordSim,
    bigramSim,
    commonWords,
    commonBigrams
  };
}

// Trích xuất các thực thể chính (Thương hiệu, Tên riêng, Game, Sản phẩm công nghệ)
function extractEntities(title) {
  if (!title) return [];
  const entities = new Set();

  const KNOWN_ENTITIES = [
    // Tech & AI
    'roblox', 'openai', 'chatgpt', 'gpt', 'gemini', 'claude', 'sora', 'deepseek',
    'apple', 'iphone', 'ipad', 'macbook', 'samsung', 'galaxy', 'xiaomi',
    'nvidia', 'tesla', 'elon musk', 'microsoft', 'google', 'meta', 'facebook',
    'tiktok', 'instagram', 'youtube', 'telegram', 'zalo', 'vinfast',
    'steam', 'playstation', 'nintendo', 'switch', 'gta', 'lien quan', 'lien minh',
    'free fire', 'pubg', 'black myth', 'wukong', 'anthropic', 'bytedance',
    'huawei', 'sony', 'intel', 'amd', 'spacex', 'starlink', 'amazon',
    'midjourney', 'copilot', 'neuralink', 'twitter', 'threads',
    // Games mở rộng
    'minecraft', 'fortnite', 'valorant', 'genshin', 'honkai', 'zelda', 'xbox', 'liên quân',
    // VN entities
    'vingroup', 'viettel', 'fpt', 'vnpay', 'momo', 'shopee', 'grab',
    'vietnam airlines', 'vietjet', 'bamboo airways',
    // People/Orgs
    'sam altman', 'mark zuckerberg', 'jeff bezos', 'tim cook',
    'trump', 'biden', 'putin', 'zelensky', 'xi jinping',
    'nasa', 'nato', 'asean',
    // Science
    'black hole', 'hố đen', 'asteroid', 'tiểu hành tinh',
    // Finance
    'bitcoin', 'ethereum', 'crypto', 'blockchain', 'nft',
  ];

  const lower = title.toLowerCase();
  for (const ent of KNOWN_ENTITIES) {
    const regex = new RegExp(`(^|[^a-z0-9])${ent}([^a-z0-9]|$)`, 'i');
    if (regex.test(lower)) {
      entities.add(ent);
    }
  }

  const properNouns = title.match(/\b[A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ][a-zàáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ0-9]+(?:\s+[A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ][a-zàáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ0-9]+)*/g);
  const STOP_PROPER_NOUNS = new Set([
    'tin', 'tin tức', 'thời sự', 'bản tin', 'nóng', 'mới nhất', 'hôm nay',
    'việt nam', 'quốc tế', 'thế giới', 'chính thức', 'bất ngờ', 'cảnh báo',
    'chú ý', 'bùng nổ', 'doanh thu', 'kỷ lục', 'đột phá', 'phát hiện', 'ra mắt'
  ]);

  if (properNouns) {
    for (const pn of properNouns) {
      const pnLower = pn.toLowerCase().trim();
      if (pnLower.length >= 3 && !STOP_PROPER_NOUNS.has(pnLower)) {
        entities.add(pnLower);
      }
    }
  }

  return Array.from(entities);
}

// Kiểm tra đối chiếu xem tin tức đã từng được tạo video chưa (URL, Tiêu đề, & Trùng thực thể trong 48h)
function checkIsAlreadyCreated(item, historyList) {
  if (!historyList || historyList.length === 0) return { isCreated: false, warning: '' };

  const normLink = (item.link || '').toLowerCase().trim();
  const normTitle = (item.title || '').toLowerCase().trim();
  const itemEntities = extractEntities(item.title);
  const fortyEightHoursAgo = Date.now() - (48 * 3600 * 1000);

  for (const h of historyList) {
    const hLink = (h.link || '').toLowerCase().trim();
    const hTitle = (h.title || '').toLowerCase().trim();

    // 1. Trùng chính xác URL
    if (normLink && hLink && normLink === hLink) {
      return { isCreated: true, warning: `Đường link này đã từng được làm video ("${h.title || 'Video trước'}")` };
    }

    // 2. Trùng tiêu đề hoặc tiêu đề tương tự
    if (normTitle && hTitle) {
      if (normTitle === hTitle) {
        return { isCreated: true, warning: `Tiêu đề trùng khớp 100% với video đã làm: "${h.title}"` };
      }
      if (normTitle.length > 25 && (normTitle.includes(hTitle) || hTitle.includes(normTitle))) {
        return { isCreated: true, warning: `Chủ đề trùng khớp với video trước đó: "${h.title}"` };
      }

      // 3. Kiểm tra trùng sự kiện giữa 2 bài báo khác nhau đưa tin về cùng một sự việc qua NLP/n-gram
      const sim = computeTopicSimilarity(normTitle, hTitle);
      if (sim.isMatch) {
        const matchInfo = sim.commonBigrams.length > 0
          ? sim.commonBigrams.slice(0, 2).join(', ')
          : sim.commonWords.slice(0, 3).join(', ');
        return {
          isCreated: true,
          warning: `⚠️ Trùng sự kiện đã làm ("${matchInfo}"): "${h.title}"`
        };
      }
    }
  }

  return { isCreated: false, warning: '' };
}

function saveHistory(history) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
}

function getVietnamDateStr(dateOrStr = new Date()) {
  try {
    const d = typeof dateOrStr === 'string'
      ? new Date(dateOrStr.includes('T') ? dateOrStr : dateOrStr.replace(' ', 'T') + 'Z')
      : new Date(dateOrStr);
    if (isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(d);
  } catch (e) {
    return null;
  }
}

function getDailyPublishStatus(targetChannelId = null) {
  const conf = getBotConfig();
  const todayVN = getVietnamDateStr(new Date());

  const channelsConfig = conf.CHANNELS || {
    channel_domestic: { name: 'Thời Sự VN', maxVideosPerDay: 6 },
    channel_tech: { name: 'Tech & Global', maxVideosPerDay: 6 }
  };

  let rows = [];
  try {
    const { getDb } = require('./src/storage/db.js');
    rows = getDb().prepare(`
      SELECT publicationId, channelId, status, scheduledAt, publishedAt, createdAt 
      FROM publications 
      WHERE status IN ('PUBLISHED', 'PUBLISHING', 'PENDING')
    `).all();
  } catch(e) {
    console.warn('[getDailyPublishStatus] SQLite query failed:', e.message);
  }

  const getEffectiveDate = (r) => {
    const dateStr = r.status === 'PUBLISHED' ? (r.publishedAt || r.scheduledAt) : (r.scheduledAt || r.createdAt);
    return getVietnamDateStr(dateStr);
  };

  // Tính chi tiết cho từng kênh
  const byChannel = {};
  let totalToday = 0;
  let totalMax = 0;
  let totalRemaining = 0;

  for (const [chId, chMeta] of Object.entries(channelsConfig)) {
    const maxPerDay = parseInt(chMeta.maxVideosPerDay || conf.MAX_VIDEOS_PER_DAY || 6, 10);
    const chRows = rows.filter(r => {
      const isThisChannel = r.channelId === chId || (!r.channelId && chId === 'channel_domestic');
      return isThisChannel && getEffectiveDate(r) === todayVN;
    });
    const count = chRows.length;
    const maxVn = chMeta.maxVideosDomestic || (chId === 'channel_domestic' ? 6 : maxPerDay);
    const maxEn = chMeta.maxVideosInternational || (chId === 'channel_domestic' ? 4 : maxPerDay);
    const vnCount = chRows.filter(r => (r.language || 'vi') !== 'en').length;
    const enCount = chRows.filter(r => r.language === 'en').length;
    const remaining = Math.max(0, maxPerDay - count);
    const reached = (count >= maxPerDay);

    byChannel[chId] = {
      channelId: chId,
      name: chMeta.name || chId,
      badge: chMeta.badge || chId,
      todayCount: count,
      maxVideos: maxPerDay,
      todayVnCount: vnCount,
      maxVideosDomestic: maxVn,
      todayEnCount: enCount,
      maxVideosInternational: maxEn,
      remainingSlots: remaining,
      limitReached: reached,
      limitVnReached: vnCount >= maxVn,
      limitEnReached: enCount >= maxEn
    };

    totalToday += count;
    totalMax += maxPerDay;
    totalRemaining += remaining;
  }

  // Nếu người dùng chỉ định cụ thể một kênh:
  if (targetChannelId && byChannel[targetChannelId]) {
    return {
      ...byChannel[targetChannelId],
      byChannel
    };
  }

  // Tổng quan (khi chưa lọc kênh):
  // limitReached chỉ là true khi TẤT CẢ các kênh đều đã đầy slot!
  const allChannelsFull = Object.values(byChannel).every(ch => ch.limitReached);

  return {
    todayCount: totalToday,
    maxVideos: totalMax,
    remainingSlots: totalRemaining,
    limitReached: allChannelsFull,
    byChannel
  };
}

function canPublishToday(channelId = null) {
  const status = getDailyPublishStatus(channelId);
  return !status.limitReached;
}

function recordPublished(title, link) {
  const history = getHistory();
  const today = getVietnamDateStr(new Date());
  history.dailyCount = history.dailyCount || {};
  history.dailyCount[today] = (history.dailyCount[today] || 0) + 1;
  history.published.push({
    title,
    link,
    publishedAt: new Date().toISOString()
  });
  saveHistory(history);
}

// 1. Quét các nguồn RSS để gom tin tức mới
async function fetchLatestNews(logFn = console.log, filterPublished = true) {
  const allItems = [];
  const allHistory = getAllCreatedHistory();
  const publishedLinks = new Set(allHistory.map(p => (p.link || '').toLowerCase().trim()));
  const publishedTitles = new Set(allHistory.map(p => (p.title || '').toLowerCase().trim()));
  const maxAgeHours = getMaxNewsAgeHours();

  logFn(`  ⏱️ Cấu hình độ sâu quét: ${maxAgeHours === 0 ? 'Tất cả (Không giới hạn thời gian)' : maxAgeHours + ' giờ qua'}`);

  for (const feed of RSS_FEEDS) {
    try {
      logFn(`  📡 Đang quét nguồn: ${feed.name}...`);
      const parsed = await parser.parseURL(feed.url);
      if (parsed && parsed.items) {
        for (const item of parsed.items.slice(0, 50)) { // Quét sâu 50 tin mới nhất mỗi nguồn
          const title = (item.title || '').trim();
          const link = item.link;
          if (!title || !link) continue;

          const checkRes = checkIsAlreadyCreated({ title, link }, allHistory);
          const isCreated = checkRes.isCreated;

          // Nếu ở chế độ lọc chặt chẽ và tin đã làm rồi thì bỏ qua
          if (filterPublished && isCreated) {
            continue;
          }

          // Kiểm tra thời gian xuất bản của tin tức
          let ageHours = 0;
          if (item.pubDate) {
            const pubTime = new Date(item.pubDate).getTime();
            if (!isNaN(pubTime)) {
              ageHours = (Date.now() - pubTime) / (1000 * 60 * 60);
              // Bỏ qua nếu tin cũ hơn maxAgeHours (nếu maxAgeHours > 0)
              if (maxAgeHours > 0 && ageHours > maxAgeHours) {
                continue;
              }
            }
          }

          allItems.push({
            title,
            link,
            pubDate: item.pubDate,
            ageHours: Math.round(ageHours * 10) / 10,
            snippet: item.contentSnippet || item.content || '',
            source: feed.name,
            category: feed.category || 'KHÁC',
            scope: feed.scope || (feed.category && (feed.category.includes('GLOBAL') || feed.category.includes('QUỐC_TẾ')) ? 'international' : 'domestic'),
            language: feed.language || (feed.category && (feed.category.includes('GLOBAL') || feed.category.includes('EXPLAINER')) ? 'en' : 'vi'),
            isAlreadyCreated: isCreated,
            createdWarning: checkRes.warning || ''
          });
        }
      }
    } catch (err) {
      logFn(`  ⚠️ Lỗi khi cào nguồn ${feed.name}: ${err.message}`);
    }
  }

  logFn(`  ✅ Đã quét xong ${RSS_FEEDS.length} nguồn. Tìm thấy ${allItems.length} bài viết tiềm năng.`);

  // Phân tách & cân bằng 3 luồng: VN, Tech Quốc Tế, và Global Explainer (View Ngoại)
  const VN_CATEGORIES = new Set([
    'TỔNG_HỢP_VN', 'THỜI_SỰ_VN', 'KINH_TẾ_VN', 'ĐỜI_SỐNG_VN', 'GIẢI_TRÍ_VN',
    'GIỚI_TRẺ_VN', 'SỰ_KIỆN_VN', 'TECH_TIÊU_DÙNG_VN', 'KHOA_HỌC', 'THẾ_GIỚI_VN'
  ]);

  const vnItems = allItems.filter(item => VN_CATEGORIES.has(item.category))
    .sort((a, b) => (a.ageHours || 999) - (b.ageHours || 999));
  const globalExplainerItems = allItems.filter(item => item.category === 'GLOBAL_EXPLAINER')
    .sort((a, b) => (a.ageHours || 999) - (b.ageHours || 999));
  const techItems = allItems.filter(item => !VN_CATEGORIES.has(item.category) && item.category !== 'GLOBAL_EXPLAINER')
    .sort((a, b) => (a.ageHours || 999) - (b.ageHours || 999));

  logFn(`  📊 Phân bố tin tức: ${vnItems.length} tin VN, ${techItems.length} tin Tech, ${globalExplainerItems.length} tin Global Explainer.`);

  // Ghép cân bằng: lấy xen kẽ 3 nhóm lên đầu
  const balancedItems = [];
  const maxEach = 25;
  const loopCount = Math.max(vnItems.length, techItems.length, globalExplainerItems.length);
  for (let i = 0; i < loopCount; i++) {
    if (i < maxEach && i < vnItems.length) balancedItems.push(vnItems[i]);
    if (i < maxEach && i < techItems.length) balancedItems.push(techItems[i]);
    if (i < maxEach && i < globalExplainerItems.length) balancedItems.push(globalExplainerItems[i]);
  }
  if (vnItems.length > maxEach) balancedItems.push(...vnItems.slice(maxEach));
  if (techItems.length > maxEach) balancedItems.push(...techItems.slice(maxEach));
  if (globalExplainerItems.length > maxEach) balancedItems.push(...globalExplainerItems.slice(maxEach));

  return balancedItems;
}

// 2. Dùng Gemini để lọc ra 1 tin HOT nhất đáng làm video
async function selectBestTrendingArticle(newsList, logFn = console.log) {
  if (newsList.length === 0) return null;

  logFn(`  🧠 Gửi ${newsList.length} tin mới nhất sang AI phân tích xu hướng...`);

  const prompt = `
Bạn là Tổng biên tập chọn tin cho hệ thống Video Shorts Đa Kênh (gồm Kênh Thời Sự VN, Kênh Kai Viet Tech/Khám phá, và Kênh Global).
Chọn DUY NHẤT 1 TIN HẤP DẪN NHẤT từ danh sách bên dưới (Có thể là tin Thời sự nóng hổi, Đột phá công nghệ / Khám phá thế giới, hoặc Tin Global).

NGUYÊN TẮC CHỌN (DỰA TRÊN DỮ LIỆU HIỆU SUẤT THỰC TẾ):
1. Về Ngôn ngữ (language):
   - Nếu tin thuộc danh mục quốc tế (TECH_GLOBAL, WORLD_GLOBAL) hoặc dành cho đối tượng View Ngoại, HÃY TRẢ VỀ "language": "en" và đề xuất tiêu đề tiếng Anh.
   - Nếu tin nội địa hoặc tech Việt Nam, TRẢ VỀ "language": "vi".
2. ƯU TIÊN HÀNG ĐẦU (Điểm 8.5 - 10):
   - Tin Thời sự: Đời sống VN nóng, địa danh/người thật việc thật cụ thể.
   - Tin Công nghệ / Khám phá: AI, OpenAI, Apple, smartphone, xe điện, khám phá khoa học vũ trụ, tin tức nóng quốc tế.
3. HẠN CHẾ: Tin thuần lý thuyết khô khan ít liên hệ đời sống, tin đã cũ > 24h.
4. Tin phải kích thích sự tò mò mạnh mẽ ngay từ 3 giây đầu tiên.
5. Nếu không có tin nào xứng đáng, trả về null.

DANH SÁCH TIN:
${newsList.slice(0, 30).map((n, idx) => `[${idx + 1}] Tiêu đề: ${n.title}\nNguồn: ${n.source || 'N/A'} | Danh mục: ${n.category || 'KHÁC'}\nLink: ${n.link}\nThời gian: ${n.ageHours} giờ trước\nMô tả: ${n.snippet.substring(0, 150)}`).join('\n---\n')}

TRẢ VỀ DUY NHẤT 1 ĐỊNH DẠNG JSON HỢP LỆ (KHÔNG BỌC \`\`\`json):
{
  "hasTrend": true,
  "selectedIndex": 1,
  "title": "Tiêu đề tin được chọn",
  "link": "Link bài báo được chọn",
  "reason": "Lý do vì sao tin này quan trọng và hút người xem",
  "impactScore": 9.2,
  "channelId": "channel_domestic" | "channel_tech" | "channel_global",
  "scope": "domestic" | "international",
  "language": "vi" | "en",
  "suggestedTitle": "Tiêu đề hấp dẫn, tự nhiên (Ví dụ: Tiêu điểm, Cảnh báo, Khám phá...)",
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

  const dailyStatus = getDailyPublishStatus();
  if (dailyStatus.limitReached) {
    logFn(`🛡️ [CHỐNG SPAM] Đã đạt giới hạn an toàn ${dailyStatus.maxVideos} video/ngày. Tạm dừng tạo thêm hôm nay để bảo vệ kênh.`);
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

function getYoutubePerformanceFeedback() {
  try {
    const { getDb } = require('./src/storage/db.js');
    const db = getDb();

    const topVideos = db.prepare(`
      SELECT s.title, s.viewCount, s.performanceGrade, s.channelId
      FROM video_snapshots s
      INNER JOIN (
        SELECT platformVideoId, MAX(id) as maxId
        FROM video_snapshots
        GROUP BY platformVideoId
      ) latest ON s.id = latest.maxId
      WHERE s.viewCount > 100
      ORDER BY s.viewCount DESC
      LIMIT 5
    `).all();

    const lowVideos = db.prepare(`
      SELECT s.title, s.viewCount, s.performanceGrade, s.channelId
      FROM video_snapshots s
      INNER JOIN (
        SELECT platformVideoId, MAX(id) as maxId
        FROM video_snapshots
        GROUP BY platformVideoId
      ) latest ON s.id = latest.maxId
      INNER JOIN publications p ON s.platformVideoId = p.platformVideoId
      WHERE datetime(p.publishedAt) <= datetime('now', '-24 hours') AND s.viewCount <= 50
      ORDER BY s.viewCount ASC
      LIMIT 5
    `).all();

    return { topVideos, lowVideos };
  } catch (e) {
    return { topVideos: [], lowVideos: [] };
  }
}

async function getTrendSuggestions(logFn = console.log) {
  const history = getHistory();
  const limitReached = !canPublishToday(history);

  // Quét cả tin chưa làm và đã làm để AI có thể đánh giá và cảnh báo
  const newsList = await fetchLatestNews(logFn, false);
  if (newsList.length === 0) {
    return { status: 'NO_NEWS', suggestions: [], limitReached };
  }

  const allHistory = getAllCreatedHistory();
  const recentHistory = allHistory.slice(-25);
  const historyPromptText = recentHistory.length > 0
    ? recentHistory.map((h, idx) => `[${idx + 1}] "${h.title}"`).join('\n')
    : '(Chưa có video nào trong lịch sử)';

  const { getDb } = require('./src/storage/db.js');
  let balanceAlert = '';
  try {
    const db = getDb();
    const pendingCounts = db.prepare(`SELECT channelId, COUNT(*) as count FROM publications WHERE status IN ('PENDING', 'RETRYING') GROUP BY channelId`).all();
    let domesticCount = 0;
    let techCount = 0;
    let globalCount = 0;
    pendingCounts.forEach(r => {
      if (!r.channelId || r.channelId === 'channel_domestic') domesticCount = r.count;
      else if (r.channelId === 'channel_tech') techCount = r.count;
      else if (r.channelId === 'channel_global') globalCount = r.count;
    });
    if (domesticCount <= 1 && (techCount >= 3 || globalCount >= 3)) {
      balanceAlert = `\n🚨 [CẢNH BÁO TỪ HỆ THỐNG]: Kênh THỜI SỰ (channel_domestic) đang THIẾU VIDEO LÊN LỊCH NGHIÊM TRỌNG (${domesticCount} chờ đăng). BẠN BẮT BUỘC PHẢI TÌM VÀ CHỌN 2-3 TIN THỜI SỰ VN LIÊN TIẾP ĐỂ BÙ VÀO HÀNG ĐỢI!\n`;
    } else if (techCount <= 1 && (domesticCount >= 3 || globalCount >= 3)) {
      balanceAlert = `\n🚨 [CẢNH BÁO TỪ HỆ THỐNG]: Kênh TECH (channel_tech) đang THIẾU VIDEO LÊN LỊCH NGHIÊM TRỌNG (${techCount} chờ đăng). BẠN BẮT BUỘC PHẢI TÌM VÀ CHỌN 2-3 TIN CÔNG NGHỆ LIÊN TIẾP ĐỂ BÙ VÀO HÀNG ĐỢI!\n`;
    } else if (globalCount <= 1 && (domesticCount >= 3 || techCount >= 3)) {
      balanceAlert = `\n🚨 [CẢNH BÁO TỪ HỆ THỐNG]: Kênh VIEW NGOẠI (channel_global) đang THIẾU VIDEO LÊN LỊCH NGHIÊM TRỌNG (${globalCount} chờ đăng). BẠN BẮT BUỘC PHẢI CHỌN 2-3 TIN KHÁM PHÁ/KHOA HỌC/EXPLAINER TIẾNG ANH!\n`;
    }
  } catch(e) {}

  const { topVideos, lowVideos } = getYoutubePerformanceFeedback();
  let ytFeedbackText = '';
  if (topVideos.length > 0) {
    ytFeedbackText = `
DỮ LIỆU HIỆU SUẤT THỰC TẾ TỪ YOUTUBE (HỌC MÁY FEEDBACK LOOP CỦA KÊNH):
- CÁC CHỦ ĐỀ CẮN VIEW CAO NHẤT (Ưu tiên chấm điểm cao cho tin tức có yếu tố tương đồng):
${topVideos.map(v => `  + "${v.title}" (Đạt ${v.viewCount.toLocaleString()} views - Hạng ${v.performanceGrade})`).join('\n')}
${lowVideos.length > 0 ? `- CÁC CHỦ ĐỀ VIEW KÉM (Trừ điểm / Tránh chọn tin khô khan, kỹ thuật trừu tượng tương tự):\n` + lowVideos.map(v => `  - "${v.title}" (${v.viewCount} views - Hạng ${v.performanceGrade})`).join('\n') : ''}
`;
  }

  logFn(`  🧠 Gửi ${Math.min(newsList.length, 60)} tin sang AI phân tích xu hướng (3 Kênh: VN, Tech & Curious Globe) kết hợp dữ liệu ${topVideos.length} video top view từ YouTube...`);

  const prompt = `
Dưới đây là danh sách các tin tức vừa thu thập được (cả Việt Nam và Quốc tế), lịch sử video đã làm, và dữ liệu hiệu suất xem thực tế trên YouTube.
${balanceAlert}${ytFeedbackText}
DANH SÁCH VIDEO ĐÃ TỪNG SẢN XUẤT GẦN ĐÂY:
${historyPromptText}

DANH SÁCH TIN TỨC ỨNG VIÊN (CẢ VIỆT NAM & QUỐC TẾ):
${newsList.slice(0, 60).map((n, idx) => `[${idx + 1}] Tiêu đề: ${n.title}\nNguồn: ${n.source || 'N/A'} | Danh mục: ${n.category || 'KHÁC'}\nLink: ${n.link}\nThời gian: ${n.ageHours} giờ trước\n${n.isAlreadyCreated ? `Trạng thái: ĐÃ CÓ VIDEO TRƯỚC (${n.createdWarning})\n` : ''}Mô tả: ${n.snippet.substring(0, 150)}`).join('\n---\n')}

NHIỆM VỤ CỦA BẠN:
Bạn là Tổng biên tập AI chọn lọc tin tức xu hướng HOT nhất để sản xuất video Shorts/Reels cho 3 KÊNH ĐỘC LẬP:

NGUYÊN TẮC CÂN BẰNG 3 KÊNH BẮT BUỘC (TỔNG CỘNG 9 - 12 TIN, MỖI KÊNH 3-4 TIN):
1. KÊNH 1 - FACTLOOP (Thời Sự VN & Khám Phá Song Ngữ) ("channelId": "channel_domestic"):
   - Có thể chọn cả 2 định dạng:
     a) Tin Thời Sự & Đời Sống VN ("language": "vi", "scope": "domestic"): Tai nạn, pháp luật, cảnh báo người dân, đời sống giật gân, người thật việc thật trong nước.
     b) Tin FactLoop Khám Phá Toàn Cầu ("language": "en", "scope": "international"): Vũ trụ, SpaceX, Starship, NASA, khoa học kỳ thú, bí ẩn khảo cổ dành cho khán giả quốc tế.
   - Tiêu đề hấp dẫn, giật tít, kích thích tò mò cao.

2. KÊNH KAI VIET TECH & TOÀN CẦU ("channelId": "channel_tech", "scope": "international", "language": "vi"):
   - Đột phá công nghệ người dùng (Apple, OpenAI, Google, NVIDIA, ChatGPT, robot, xe điện, bảo mật smartphone, cảnh báo mã độc).
   - 100% tiếng Việt. Tiêu đề nêu bật sản phẩm đại chúng hoặc chiêu trò lừa đảo công nghệ.

3. KÊNH VIEW NGOẠI CURIOUS GLOBE ("channelId": "channel_global", "scope": "international", "language": "en"):
   - Khai thác ngách Viral Space & Science: Tên lửa & Thám hiểm vũ trụ (SpaceX, Starship, NASA, thám hiểm sao Hỏa, Mặt Trăng, James Webb, hố đen, thiên thạch), Khoa học kỳ thú (Mind-Blowing Science, lượng tử, tự nhiên kỳ dị), Bí ẩn khảo cổ (Ancient Mysteries & Odd Phenomena).
   - "language": "en" (100% tiếng Anh tự nhiên, kịch tính, kích thích tò mò tột độ).
   - Tiêu đề tiếng Anh tò mò giật tít gây sốc (Curiosity Gap) chuẩn H2Dev (Ví dụ: "SpaceX Starship Just Did The IMPOSSIBLE In Orbit! 🚀", "Astronomers Detect Massive Signal From Edge Of Universe! 🌌", "Archaeologists Shocked By Ancient Discovery Not From Earth! 🗿").

4. ĐỐI CHIẾU DANH SÁCH VIDEO ĐÃ SẢN XUẤT (CHỐNG TRÙNG LẶP):
   - Nếu tin tức nói về CÙNG SỰ KIỆN / VỤ VIỆC với video đã làm -> Đặt "isAlreadyCreated": true, "createdWarning": "⚠️ Trùng sự kiện đã làm: [Tên video cũ]".
   - Nếu sự kiện MỚI HOÀN TOÀN -> Đặt "isAlreadyCreated": false, "createdWarning": "".

TRẢ VỀ DUY NHẤT 1 MẢNG JSON HỢP LỆ (TỪ 9 ĐẾN 12 TIN - CÂN BẰNG ĐỀU 3-4 TIN CHO MỖI KÊNH):
[
  {
    "selectedIndex": 1,
    "title": "Tiêu đề tin ngắn gọn giật tít hấp dẫn (tiếng Việt cho domestic/tech, tiếng Anh cho global)",
    "link": "Link bài báo gốc",
    "reason": "Lý do vì sao tin này viral hoặc quan trọng",
    "impactScore": 9.5,
    "performanceTag": "🔥 THỊNH HÀNH" | "📈 TĂNG TỐT" | "⚠️ CẦN TỐI ƯU",
    "category": "ĐỜI SỐNG" | "CÔNG NGHỆ" | "GIẢI TRÍ" | "KHOA HỌC" | "THẾ GIỚI" | "EXPLAINER",
    "channelId": "channel_domestic" | "channel_tech" | "channel_global",
    "scope": "domestic" | "international",
    "language": "vi" | "en",
    "isAlreadyCreated": false,
    "createdWarning": ""
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

    if (Array.isArray(decision) && decision.length > 0) {
      // Đối chiếu bổ sung bằng hàm check cục bộ để đảm bảo 100% không sót
      // Và bổ sung thêm thông tin thời gian, nguồn từ danh sách tin gốc
      decision.forEach(sug => {
        const localCheck = checkIsAlreadyCreated(sug, allHistory);
        if (localCheck.isCreated) {
          sug.isAlreadyCreated = true;
          if (!sug.createdWarning) {
            sug.createdWarning = localCheck.warning;
          }
        }

        // Enrich: Bổ sung ageHours, source, pubDate từ newsList gốc
        const idx = (sug.selectedIndex || 1) - 1;
        const originalItem = newsList[idx];
        if (originalItem) {
          sug.ageHours = originalItem.ageHours;
          sug.pubDate = originalItem.pubDate;
          sug.source = originalItem.source;
          sug.feedCategory = originalItem.category;
        }

        // Đảm bảo nhãn hiệu suất luôn chuẩn hóa theo công thức mới
        if (!sug.performanceTag) {
          if ((sug.impactScore || 0) >= 8.5) sug.performanceTag = '🔥 THỊNH HÀNH';
          else if ((sug.impactScore || 0) >= 7.0) sug.performanceTag = '📈 TĂNG TỐT';
          else sug.performanceTag = '⚠️ CẦN TỐI ƯU';
        }
      });

      // Sắp xếp ưu tiên: Chưa tạo lên trước, sau đó theo impactScore giảm dần
      decision.sort((a, b) => {
        if (a.isAlreadyCreated === b.isAlreadyCreated) {
          return (b.impactScore || 0) - (a.impactScore || 0);
        }
        return a.isAlreadyCreated ? 1 : -1;
      });

      return { status: 'SUCCESS', suggestions: decision, limitReached };
    } else {
      return { status: 'NO_HOT_NEWS', suggestions: [], limitReached };
    }
  } catch (err) {
    return { status: 'ERROR', suggestions: [], error: err.message };
  }
}

module.exports = {
  runTrendCheck,
  getTrendSuggestions,
  recordPublished,
  getHistory,
  getAllCreatedHistory,
  checkIsAlreadyCreated,
  extractEntities,
  canPublishToday,
  getDailyPublishStatus
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
