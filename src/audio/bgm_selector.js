const fs = require('fs');
const path = require('path');

/**
 * BGM Library Manifest
 * Maps news genres to high-quality, topic-adaptive soundtrack tracks with multiple variations
 */
const BGM_LIBRARY = {
  TECH: [
    { file: 'bgm/tech_cyberpunk.mp3', volume: 0.17, name: 'Cyberpunk Synthwave' },
    { file: 'bgm/tech_digital.mp3', volume: 0.18, name: 'Silicon Valley Digital' },
  ],
  MYSTERY_SCIENCE: [
    { file: 'bgm/mystery_cosmic.mp3', volume: 0.20, name: 'Cosmic Deep Space' },
    { file: 'bgm/mystery_ancient.mp3', volume: 0.19, name: 'Ancient Enigma' },
  ],
  BREAKING_NEWS: [
    { file: 'bgm/breaking_urgent.mp3', volume: 0.17, name: 'Newsroom Urgent Drive' },
    { file: 'bgm/breaking_dramatic.mp3', volume: 0.18, name: 'Crisis Tension Strings' },
  ],
  FINANCE: [
    { file: 'bgm/finance_pulse.mp3', volume: 0.17, name: 'Wall Street Minimal' },
    { file: 'bgm/breaking_urgent.mp3', volume: 0.16, name: 'Market Fast Alert' },
  ],
  VIRAL_LIFESTYLE: [
    { file: 'bgm/viral_bounce.mp3', volume: 0.18, name: 'TikTok Phonk Bounce' },
    { file: 'bgm/tech_digital.mp3', volume: 0.17, name: 'Modern Lifestyle Pulse' },
  ],
};

/**
 * Selects an adaptive BGM track based on news topic, channel, and rotation seed
 *
 * @param {object} params
 * @param {string} params.title - Article/video headline
 * @param {string} params.category - Inferred or source category
 * @param {string} params.channelId - Channel destination ('channel_domestic', 'channel_tech', 'channel_global')
 * @param {string[]} params.tags - Keywords/tags
 * @param {string} params.language - 'vi' or 'en'
 * @returns {{ bgmFile: string, bgmVolume: number, genre: string, trackName: string }}
 */
function selectBgm({ title = '', category = '', channelId = '', tags = [], language = 'vi' } = {}) {
  const text = `${title} ${category} ${(tags || []).join(' ')}`.toLowerCase();

  // 1. Phân loại Thể loại âm nhạc (Genre Classification)
  let genre = 'BREAKING_NEWS';

  const isTech = /(^|[\s,.:;!?])ai([\s,.:;!?]|$)|trí tuệ nhân tạo|chip|bán dẫn|semiconductor|samsung|sk hynix|nvidia|openai|chatgpt|robot|smartphone|iphone|công nghệ|software|apple|intel|amd|tsmc/i.test(text) ||
    channelId === 'channel_tech' ||
    category.includes('TECH') ||
    category.includes('CÔNG NGHỆ');

  const isScienceMystery = /vũ trụ|thiên hà|kính thiên văn|james webb|khoa học|bí ẩn|khảo cổ|hóa thạch|người ngoài hành tinh|alien|space|cosmos|discovery|ancient|mystery|anomaly/i.test(text) ||
    channelId === 'channel_global' ||
    language === 'en' ||
    category === 'GLOBAL_EXPLAINER';

  const isFinance = /tỷ usd|triệu usd|tỷ phú|chứng khoán|cổ phiếu|lạm phát|ngân hàng|bất động sản|thị trường|kinh tế|doanh nghiệp|kinh doanh|finance|economy/i.test(text) ||
    category.includes('KINH_TẾ');

  const isLifestyle = /giới trẻ|đời sống|giải trí|đám cưới|trà sữa|tiktok|trend|giảm cân|showbiz|sao việt|người nổi tiếng|du lịch|viral/i.test(text) ||
    category.includes('GIỚI_TRẺ') ||
    category.includes('ĐỜI_SỐNG') ||
    category.includes('GIẢI_TRÍ');

  if (isTech) {
    genre = 'TECH';
  } else if (isScienceMystery) {
    genre = 'MYSTERY_SCIENCE';
  } else if (isFinance) {
    genre = 'FINANCE';
  } else if (isLifestyle) {
    genre = 'VIRAL_LIFESTYLE';
  } else {
    genre = 'BREAKING_NEWS';
  }

  // 2. Luân phiên biến thể nhạc theo Thời gian & Tiêu đề (Variation Rotation)
  // Đảm bảo các video cùng chủ đề nhưng làm khác giờ hoặc khác ngày sẽ có nhạc nền thay đổi sinh động
  const variants = BGM_LIBRARY[genre] || BGM_LIBRARY.BREAKING_NEWS;
  const hash = Math.abs((title || '').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) + new Date().getHours());
  const selectedTrack = variants[hash % variants.length];

  // 3. Kiểm tra file thực tế trong public/
  const publicDir = path.join(__dirname, '..', '..', 'public');
  const fullPath = path.join(publicDir, selectedTrack.file);

  if (fs.existsSync(fullPath)) {
    return {
      bgmFile: selectedTrack.file,
      bgmVolume: selectedTrack.volume,
      genre: genre,
      trackName: selectedTrack.name
    };
  }

  // Fallback nếu thiếu file
  return {
    bgmFile: 'bgm.mp3',
    bgmVolume: 0.18,
    genre: genre,
    trackName: 'Default News Beat'
  };
}

module.exports = { selectBgm, BGM_LIBRARY };
