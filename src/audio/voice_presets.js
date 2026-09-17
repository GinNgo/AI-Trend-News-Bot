/**
 * Voice Presets Engine for Short-Form Video Production
 * Defines 8 optimized vocal personas with pacing, pitch modulation, and dual-voice support
 */

const VOICE_PERSONAS = {
  NEWS_ANCHOR: {
    key: 'NEWS_ANCHOR',
    name: 'Thời Sự - Chính Luận (Newsroom Anchor)',
    description: 'Nghiêm túc, dứt khoát, chuẩn mực phát thanh viên truyền hình.',
    vi: { voice: 'vi-VN-NamMinhNeural', rate: '+10%', pitch: '+0Hz' },
    en: { voice: 'en-US-ChristopherNeural', rate: '+8%', pitch: '+0Hz' },
    dualVi: { secondaryVoice: 'vi-VN-HoaiMyNeural', secondaryRate: '+10%', secondaryPitch: '+0Hz' },
    dualEn: { secondaryVoice: 'en-US-AriaNeural', secondaryRate: '+8%', secondaryPitch: '+0Hz' }
  },
  MYSTERY: {
    key: 'MYSTERY',
    name: 'Bí Ẩn - Rùng Rợn - Kỳ Bí (Mystery & Suspense)',
    description: 'Trầm sâu, hồi hộp, nhịp chậm rãi tạo cảm giác tò mò và lạnh gáy.',
    vi: { voice: 'vi-VN-NamMinhNeural', rate: '+0%', pitch: '-8Hz' },
    en: { voice: 'en-US-ChristopherNeural', rate: '+0%', pitch: '-6Hz' },
    dualVi: { secondaryVoice: 'vi-VN-HoaiMyNeural', secondaryRate: '+2%', secondaryPitch: '-4Hz' },
    dualEn: { secondaryVoice: 'en-US-JennyNeural', secondaryRate: '+2%', secondaryPitch: '-2Hz' }
  },
  BREAKING_ALERT: {
    key: 'BREAKING_ALERT',
    name: 'Cảnh Báo Khẩn Cấp - Giật Gân (Breaking Alert)',
    description: 'Dồn dập, căng thẳng cực độ, đánh thức bản năng sinh tồn ngay giây đầu.',
    vi: { voice: 'vi-VN-NamMinhNeural', rate: '+15%', pitch: '+2Hz' },
    en: { voice: 'en-US-GuyNeural', rate: '+12%', pitch: '+2Hz' },
    dualVi: { secondaryVoice: 'vi-VN-HoaiMyNeural', secondaryRate: '+14%', secondaryPitch: '+2Hz' },
    dualEn: { secondaryVoice: 'en-US-AriaNeural', secondaryRate: '+12%', secondaryPitch: '+2Hz' }
  },
  TECH_HYPE: {
    key: 'TECH_HYPE',
    name: 'Năng Động - GenZ - Công Nghệ (Tech Savvy / Hype)',
    description: 'Tươi mới, hào hứng, nhanh, phong cách review công nghệ hiện đại.',
    vi: { voice: 'vi-VN-HoaiMyNeural', rate: '+14%', pitch: '+4Hz' },
    en: { voice: 'en-US-EmmaNeural', rate: '+10%', pitch: '+2Hz' },
    dualVi: { secondaryVoice: 'vi-VN-NamMinhNeural', secondaryRate: '+10%', secondaryPitch: '+0Hz' },
    dualEn: { secondaryVoice: 'en-US-BrianNeural', secondaryRate: '+8%', secondaryPitch: '+0Hz' }
  },
  FINANCE_EXPERT: {
    key: 'FINANCE_EXPERT',
    name: 'Chuyên Gia Kinh Tế - Tài Chính (Financial Analyst)',
    description: 'Sắc sảo, khách quan, tỉnh táo, phát âm số liệu và tỷ lệ % uy tín.',
    vi: { voice: 'vi-VN-NamMinhNeural', rate: '+8%', pitch: '-2Hz' },
    en: { voice: 'en-US-ChristopherNeural', rate: '+8%', pitch: '-2Hz' },
    dualVi: { secondaryVoice: 'vi-VN-HoaiMyNeural', secondaryRate: '+8%', secondaryPitch: '+0Hz' },
    dualEn: { secondaryVoice: 'en-US-JennyNeural', secondaryRate: '+8%', secondaryPitch: '+0Hz' }
  },
  STORYTELLING: {
    key: 'STORYTELLING',
    name: 'Tâm Tình - Kể Chuyện Podcast (Storytelling / Lore)',
    description: 'Ấm áp, gần gũi, thong thả như người bạn tâm sự chuyện đời.',
    vi: { voice: 'vi-VN-NamMinhNeural', rate: '+4%', pitch: '-4Hz' },
    en: { voice: 'en-US-AndrewNeural', rate: '+4%', pitch: '-2Hz' },
    dualVi: { secondaryVoice: 'vi-VN-HoaiMyNeural', secondaryRate: '+4%', secondaryPitch: '+0Hz' },
    dualEn: { secondaryVoice: 'en-US-EmmaNeural', secondaryRate: '+4%', secondaryPitch: '+0Hz' }
  },
  SATIRICAL_MEME: {
    key: 'SATIRICAL_MEME',
    name: 'Châm Biếm - Hài Hước - Meme (Satirical / Viral)',
    description: 'Dí dỏm, tếu táo, tạo những cú ngắt nhịp và quay xe bất ngờ.',
    vi: { voice: 'vi-VN-HoaiMyNeural', rate: '+10%', pitch: '+2Hz' },
    en: { voice: 'en-US-BrianNeural', rate: '+8%', pitch: '+2Hz' },
    dualVi: { secondaryVoice: 'vi-VN-NamMinhNeural', secondaryRate: '+8%', secondaryPitch: '+0Hz' },
    dualEn: { secondaryVoice: 'en-US-GuyNeural', secondaryRate: '+8%', secondaryPitch: '+0Hz' }
  },
  CINEMATIC_DOC: {
    key: 'CINEMATIC_DOC',
    name: 'Phóng Sự Tài Liệu Điện Ảnh (Cinematic IMAX / BBC)',
    description: 'Hùng tráng, uy nghi, sâu rộng, mang âm hưởng phim tài liệu điện ảnh.',
    vi: { voice: 'vi-VN-NamMinhNeural', rate: '+5%', pitch: '-6Hz' },
    en: { voice: 'en-US-ChristopherNeural', rate: '+5%', pitch: '-4Hz' },
    dualVi: { secondaryVoice: 'vi-VN-HoaiMyNeural', secondaryRate: '+6%', secondaryPitch: '-2Hz' },
    dualEn: { secondaryVoice: 'en-US-AriaNeural', secondaryRate: '+6%', secondaryPitch: '-2Hz' }
  }
};

/**
 * Tự động phân loại Tông giọng (Voice Preset) dựa trên tiêu đề, thể loại và từ khóa
 */
function detectVoicePreset({ title = '', category = '', tags = [], language = 'vi', channelId = '' } = {}) {
  const text = `${title} ${category} ${(tags || []).join(' ')}`.toLowerCase();

  // 1. Bí ẩn / Kỳ bí / Khảo cổ / Vũ trụ sâu
  if (
    /bí ẩn|rùng rợn|kỳ bí|khảo cổ|hóa thạch|người ngoài hành tinh|alien|ufo|anomaly|cosmic|james webb|ancient|hố đen|black hole|quái vật|biến mất|lời nguyền|chưa có lời giải|dị thường/i.test(text)
  ) {
    return 'MYSTERY';
  }

  // 2. Cảnh báo khẩn cấp / Giật gân / Tai nạn / Lừa đảo
  if (
    /cảnh báo|khẩn cấp|sập mạng|lừa đảo|chiêu trò|tấn công mạng|mã độc|va chạm|tai nạn liên hoàn|phong tỏa|sập sàn|bắt khẩn cấp|thảm họa|nguy hiểm|sụp đổ|sốc|cứu hộ|alert|crisis|warning|emergency/i.test(text)
  ) {
    return 'BREAKING_ALERT';
  }

  // 3. Công nghệ / AI / Smartphone / Gaming
  if (
    /ai|trí tuệ nhân tạo|openai|chatgpt|sora|deepseek|nvidia|chip|bán dẫn|semiconductor|robot|smartphone|iphone|samsung|macbook|xe điện|tesla|vinfast|startup|gaming|game thủ|steam|tech/i.test(text) ||
    channelId === 'channel_tech' ||
    category.includes('TECH') ||
    category.includes('CÔNG NGHỆ')
  ) {
    return 'TECH_HYPE';
  }

  // 4. Kinh tế / Tài chính / Tiền tệ / Bất động sản
  if (
    /tỷ usd|triệu usd|tỷ phú|vàng|giá vàng|sjc|chứng khoán|cổ phiếu|lạm phát|fed|lãi suất|bất động sản|nhà đất|ngân hàng|tài chính|bitcoin|crypto|kinh tế|doanh nghiệp|lợi nhuận/i.test(text) ||
    category.includes('KINH_TẾ')
  ) {
    return 'FINANCE_EXPERT';
  }

  // 5. Chuyện lạ hài hước / Châm biếm / Tự hủy
  if (
    /dở khóc dở cười|hy hữu|ngớ ngẩn|tự hủy|cái kết|cười ra nước mắt|bi hài|trớ trêu|tên trộm|vụng về|hài hước|bất lực/i.test(text)
  ) {
    return 'SATIRICAL_MEME';
  }

  // 6. Kể chuyện đời sống / Cảm động / Triết lý
  if (
    /cảm động|nghị lực|bài học cuộc sống|ký ức|tuổi thơ|hồi ức|người tốt việc tốt|người cha|người mẹ|tình người|triết lý|chuyện đời/i.test(text) ||
    category.includes('ĐỜI_SỐNG')
  ) {
    return 'STORYTELLING';
  }

  // 7. Phóng sự tài liệu khám phá quốc tế
  if (
    /tuyệt chủng|đại dương|thiên nhiên|hành tinh|lịch sử|văn minh|kỳ quan|khoa học thế giới|discovery|documentary/i.test(text) ||
    channelId === 'channel_global' ||
    category === 'GLOBAL_EXPLAINER'
  ) {
    return 'CINEMATIC_DOC';
  }

  // 8. Mặc định theo kênh hoặc Thời sự chính luận
  if (channelId === 'channel_tech') return 'TECH_HYPE';
  if (channelId === 'channel_global') return 'CINEMATIC_DOC';
  return 'NEWS_ANCHOR';
}

/**
 * Phân bổ giọng đọc chính xác cho từng cảnh (Hỗ trợ Single-Voice và Dual-Voice)
 */
function resolveSceneVoice({
  presetKey = 'NEWS_ANCHOR',
  sceneIndex = 0,
  totalScenes = 5,
  sceneSpeaker = null,
  language = 'vi',
  channelMeta = {},
  enableDualVoice = false
} = {}) {
  const isEnglish = (language === 'en');
  const upperKey = (presetKey || 'NEWS_ANCHOR').toUpperCase();
  const persona = VOICE_PERSONAS[upperKey] || VOICE_PERSONAS.NEWS_ANCHOR;

  const baseConfig = isEnglish ? persona.en : persona.vi;
  const dualConfig = isEnglish ? persona.dualEn : persona.dualVi;

  // Nếu người dùng hoặc kênh ép buộc cấu hình cố định trong config.json
  const defaultVoice = channelMeta.ttsVoice || (isEnglish ? 'en-US-ChristopherNeural' : 'vi-VN-NamMinhNeural');
  const defaultRate = channelMeta.ttsRate || (isEnglish ? '+8%' : '+10%');
  const defaultPitch = channelMeta.ttsPitch || '+0Hz';

  // Chế độ 1 giọng chuẩn (Single-Voice Persona)
  if (!enableDualVoice && !sceneSpeaker) {
    return {
      voice: baseConfig.voice || defaultVoice,
      rate: baseConfig.rate || defaultRate,
      pitch: baseConfig.pitch || defaultPitch,
      speakerRole: 'host',
      presetName: persona.name
    };
  }

  // Chế độ 2 giọng (Dual-Voice Dialogue Dynamic):
  // - Cảnh 1 (Hook) & Cảnh Cuối (Endless Loop): Bắt buộc dùng Giọng Chủ (Host / Anchor) để neo cảm xúc
  // - Các cảnh giữa (Bóc tách tình tiết / Báo cáo hiện trường): Dùng Giọng Phụ (Reporter / Co-host)
  const isFirstScene = (sceneIndex === 0);
  const isLastScene = (sceneIndex === totalScenes - 1);

  const wantsSecondary = (sceneSpeaker === 'reporter' || sceneSpeaker === 'secondary' || sceneSpeaker === 'female') ||
    (!isFirstScene && !isLastScene && (sceneIndex % 2 === 1));

  if (wantsSecondary && dualConfig) {
    return {
      voice: dualConfig.secondaryVoice,
      rate: dualConfig.secondaryRate,
      pitch: dualConfig.secondaryPitch,
      speakerRole: 'reporter',
      presetName: persona.name
    };
  }

  return {
    voice: baseConfig.voice || defaultVoice,
    rate: baseConfig.rate || defaultRate,
    pitch: baseConfig.pitch || defaultPitch,
    speakerRole: 'host',
    presetName: persona.name
  };
}

module.exports = {
  VOICE_PERSONAS,
  detectVoicePreset,
  resolveSceneVoice
};
