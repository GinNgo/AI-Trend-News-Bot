const path = require('path');
const fs = require('fs');

const TECH_KEYWORDS = [
  'ai', 'trí tuệ nhân tạo', 'tech', 'công nghệ', 'gaming', 'game', 'khoa học', 
  'vũ trụ', 'robot', 'chip', 'bán dẫn', 'startup', 'openai', 'gemini', 'tesla', 
  'apple', 'google', 'nvidia', 'microsoft', 'starcraft', 'uav', 'tiêm kích', 'quân sự',
  'space', 'nasa', 'crypto', 'bitcoin', 'lập trình', 'software', 'hardware', 'cyber',
  'internet', 'trang web', 'website', 'hệ thống', 'server', 'sập mạng', 'hacker', 'cloud',
  'ios', 'iphone', 'ipad', 'macbook', 'android', 'windows', 'anthropic', 'claude', 'chatgpt',
  'deepseek', 'jensen huang', 'steam', 'valve', 'volkswagen', 'ô tô điện', 'xe điện',
  'mã độc', 'clickfix', 'phần mềm', 'ứng dụng', 'meta', 'vr', 'ar', 'thực tế ảo',
  'đất hiếm', 'công nghệ xanh', 'tàu vũ trụ', 'vệ tinh', 'tên lửa', 'big tech', 'amazon prime',
  'lỗi 404', 'lỗi 406', 'sự cố mạng', 'tấn công mạng', 'vấn nạn mạng', 'smartphone'
];

const TECH_CATEGORIES = [
  'tech', 'ai', 'congnghe', 'khoahoc', 'gaming', 'game', 'international',
  'công nghệ', 'khoa học', 'quốc tế', 'thế giới', 'khoa học & công nghệ',
  'khoa học công nghệ', 'công nghệ & ai', 'esports', 'thế giới số'
];

const TECH_SOURCES = [
  'genk', 'techcrunch', 'the verge', 'wired', 'engadget', 'cnbc', 'bloomberg', 'reuters tech'
];

const GLOBAL_SOURCES = [
  'livescience', 'bbc science', 'space.com', 'wired science', 'sciencealert', 'popular mechanics', 'scientific american', 'discovery'
];

class ChannelRouter {
  constructor() {
    this.config = this.loadConfig();
  }

  loadConfig() {
    const configPath = path.join(process.cwd(), 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        const conf = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return conf.CHANNELS || {};
      } catch (e) {}
    }
    return {};
  }

  /**
   * Xác định channelId ('channel_domestic', 'channel_tech', hoặc 'channel_global') cho bài tin
   * @param {Object} storyInfo - Thông tin bài viết { title, category, scope, language, tags, source, channelId }
   * @returns {string} channelId
   */
  route(storyInfo = {}) {
    const { title = '', category = '', scope = '', language = '', tags = [], source = '', channelId = null } = storyInfo;

    // 0. Nếu đã được chỉ định tường minh channelId hợp lệ -> Ưu tiên dùng ngay
    if (channelId && (channelId === 'channel_tech' || channelId === 'channel_domestic' || channelId === 'channel_global')) {
      return channelId;
    }

    const srcLower = (source || '').toLowerCase();
    const catLower = (category || '').toLowerCase().trim();

    // 1. Nguồn tin hoặc chuyên mục Khám phá / Khoa học / Explainer Quốc Tế -> Phân về Curious Globe (US/Global)
    if (catLower === 'global_explainer' || catLower.includes('explainer') || GLOBAL_SOURCES.some(s => srcLower.includes(s))) {
      return 'channel_global';
    }

    // 2. Nếu nội dung viết bằng tiếng Anh hoặc phạm vi chỉ định quốc tế (không thuần tin tech VN) -> Kênh Global
    if (language === 'en' || (scope === 'international' && !TECH_CATEGORIES.some(c => catLower === c))) {
      return 'channel_global';
    }

    // 3. Nguồn tin chuyên biệt về Công nghệ -> Phân về Kai Viet (Tech)
    if (TECH_SOURCES.some(s => srcLower.includes(s))) {
      return 'channel_tech';
    }

    // 4. Kiểm tra Thể loại (hỗ trợ cả có dấu, không dấu và viết tắt) cho Tech
    if (TECH_CATEGORIES.some(c => catLower === c || catLower.includes(c))) {
      return 'channel_tech';
    }

    // 5. Quét từ khóa trong Tiêu đề và Thẻ Tags
    const textToScan = `${title} ${(Array.isArray(tags) ? tags : []).join(' ')}`.toLowerCase();
    const isTechRelated = TECH_KEYWORDS.some(kw => {
      const regex = new RegExp(`(^|\\s|[.,:;!?'"\\(\\[])${kw}(\\s|$|[.,:;!?'"\\)\\]])`, 'i');
      return regex.test(textToScan);
    });

    if (isTechRelated) {
      return 'channel_tech';
    }

    // 6. Mặc định là Kênh Thời Sự & Xã Hội Việt Nam
    return 'channel_domestic';
  }

  /**
   * Lấy thông tin kênh theo channelId
   */
  getChannelMeta(channelId = 'channel_domestic') {
    const channels = this.config;
    if (channels[channelId]) {
      return { id: channelId, ...channels[channelId] };
    }
    if (channelId === 'channel_tech') {
      return {
        id: 'channel_tech',
        name: 'Kai Viet (Tech)',
        badge: '🚀 Kai Viet',
        tokenFile: 'tokens_channel2.json'
      };
    }
    if (channelId === 'channel_global') {
      return {
        id: 'channel_global',
        name: 'Curious Globe (US & International)',
        badge: '🇺🇸 Curious Globe',
        tokenFile: 'tokens_channel3.json',
        fallbackTokenFile: 'tokens.json',
        language: 'en'
      };
    }
    return {
      id: 'channel_domestic',
      name: 'Kênh Thời Sự & Xã Hội VN',
      badge: '🇻🇳 Thời Sự VN',
      tokenFile: 'tokens.json'
    };
  }
}

module.exports = { ChannelRouter };
