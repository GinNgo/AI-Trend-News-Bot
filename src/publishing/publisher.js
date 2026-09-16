const fs = require('fs');
const path = require('path');
const { getDb } = require('../storage/db.js');
const { YouTubeProvider } = require('./providers/youtube.js');
const { TikTokProvider } = require('./providers/tiktok.js');
const { MetaProvider } = require('./providers/meta.js');
const { MockProvider } = require('./providers/mock.js');
const logger = require('../collector/utils/logger.js');

function getBotConfig() {
  const configPath = path.join(__dirname, '..', '..', 'config.json');
  if (fs.existsSync(configPath)) {
    try {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    } catch(e) {}
  }
  return {};
}

class Publisher {
  constructor() {
    this.db = getDb();
    this.providers = {
      youtube: new YouTubeProvider(),
      tiktok: new TikTokProvider(),
      instagram: new MetaProvider('instagram'),
      facebook: new MetaProvider('facebook'),
      mock: new MockProvider('mock')
    };
    this.isProcessingQueue = false;
  }

  /**
   * Định nghĩa các cửa sổ giờ vàng (Golden Hour Windows)
   * Phân bổ video tập trung vào các khung giờ nhiều người xem nhất (Sáng, Trưa, Chiều, Tối)
   * Cho phép nhiều video chung một khung giờ vàng (cách nhau 25-30 phút), không cộng dồn tịnh tiến vào giờ chết.
   */
  getGoldenWindows(date = new Date(), language = 'vi', channelId = 'channel_domestic') {
    const isEnglish = (language === 'en' || channelId === 'channel_global');
    const dayOfWeek = (date || new Date()).getDay(); // 0 = Chủ Nhật, 6 = Thứ Bảy
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

    if (isEnglish || channelId === 'channel_global') {
      // THỊ TRƯỜNG HOA KỲ & TOÀN CẦU (Bao phủ cả bờ Đông EST, bờ Tây PST và Châu Âu)
      // Phân bổ 7 khung giờ vàng rải đều 24h để video không bị dồn cục hoặc chờ quá lâu
      return [
        { name: '1. US Prime Time & Late Night (Đón sóng 20:30 - 22:30 EST)', startHour: 7, startMinute: 30, endHour: 9, endMinute: 30, maxVideos: 1, stepMinutes: 60 },
        { name: '2. Europe Midday & US Early (Đón sóng trưa UK/EU)', startHour: 13, startMinute: 30, endHour: 15, endMinute: 0, maxVideos: 1, stepMinutes: 45 },
        { name: '3. Europe Evening & US Pre-Dawn (Đón sóng tan ca EU)', startHour: 16, startMinute: 15, endHour: 17, endMinute: 30, maxVideos: 1, stepMinutes: 45 },
        { name: '4. US Morning Rush - Bờ Đông (Đón sóng 07:30 - 09:00 EST)', startHour: 18, startMinute: 30, endHour: 20, endMinute: 0, maxVideos: 1, stepMinutes: 60 },
        { name: '5. US Morning Rush - Bờ Tây (Đón sóng 07:15 - 08:30 PST)', startHour: 21, startMinute: 15, endHour: 22, endMinute: 30, maxVideos: 1, stepMinutes: 45 },
        { name: '6. US Lunch Break (Đón sóng 12:15 - 13:30 EST)', startHour: 23, startMinute: 15, endHour: 23, endMinute: 59, maxVideos: 1, stepMinutes: 45 },
        { name: '7. US Afternoon Commute (Đón sóng 17:30 - 19:15 EST)', startHour: 4, startMinute: 30, endHour: 6, endMinute: 15, maxVideos: 1, stepMinutes: 60 }
      ];
    }

    // THỊ TRƯỜNG VIỆT NAM & NỘI ĐỊA (UTC+7)
    // CHIẾN LƯỢC: Đăng TRƯỚC khung giờ cao điểm từ 15-25 phút để YouTube nén & nạp sẵn vào feed
    // Phân bổ đều đặn 1 video cho mỗi khung giờ vàng trải dài từ sáng đến tối:
    return [
      { name: '1. Sáng Sớm (Đón sóng 07:30 - 08:30)', startHour: 7, startMinute: 15, endHour: 8, endMinute: 30, maxVideos: 1, stepMinutes: 45 },
      { name: '2. Giữa Sáng (Đón sóng giải lao 10:00 - 10:45)', startHour: 9, startMinute: 45, endHour: 10, endMinute: 45, maxVideos: 1, stepMinutes: 45 },
      { name: '3. Trưa Nghỉ Ca (Đón sóng ăn trưa 11:30 - 13:00)', startHour: 11, startMinute: 30, endHour: 13, endMinute: 0, maxVideos: 1, stepMinutes: 45 },
      { name: '4. Đầu Giờ Chiều (Đón sóng 14:30 - 15:30)', startHour: 14, startMinute: 0, endHour: 15, endMinute: 30, maxVideos: 1, stepMinutes: 60 },
      { name: '5. Chiều Tan Ca (Đón sóng về nhà 17:15 - 18:45)', startHour: 17, startMinute: 15, endHour: 18, endMinute: 45, maxVideos: 1, stepMinutes: 45 },
      { name: '6. Tối Giờ Vàng Đỉnh Cao (Đón sóng 19:45 - 21:45)', startHour: 19, startMinute: 45, endHour: 21, endMinute: 45, maxVideos: 1, stepMinutes: 45 },
      { name: '7. Đêm Muộn (Dự phòng tin nóng)', startHour: 21, startMinute: 45, endHour: 22, endMinute: 45, maxVideos: 1, stepMinutes: 45 }
    ];
  }

  /**
   * Tính toán thời gian xuất bản tối ưu:
   * - Phân bổ video vào các Khung Giờ Vàng (Golden Windows)
   * - Bảo vệ kênh chống spam: Giới hạn tối đa MAX_VIDEOS_PER_DAY (mặc định 3 video/ngày)
   * - Khoảng cách tối thiểu giữa các video là 120 phút (2 tiếng)
   */
  calculateNextPeakSlot(forceTomorrow = false, language = 'vi', channelId = 'channel_domestic') {
    const conf = getBotConfig();
    const mode = conf.SCHEDULE_MODE || 'peak_hours'; // Mặc định chế độ Khung Giờ Vàng chống spam
    const minIntervalMinutes = parseInt(conf.MIN_PUBLISH_INTERVAL_MINUTES, 10) || 120; // Giãn cách 2 tiếng
    const minIntervalMs = minIntervalMinutes * 60 * 1000;
    
    // Lấy giới hạn video/ngày của riêng kênh này
    let maxPerDay = 4;
    if (conf.CHANNELS && conf.CHANNELS[channelId] && conf.CHANNELS[channelId].maxVideosPerDay) {
      maxPerDay = conf.CHANNELS[channelId].maxVideosPerDay;
    } else if (conf.MAX_VIDEOS_PER_DAY !== undefined) {
      maxPerDay = parseInt(conf.MAX_VIDEOS_PER_DAY, 10) || 4;
    }

    const now = new Date();

    // Lấy danh sách các slot đã lên lịch trong tương lai CHO KÊNH NÀY (kèm thông tin ngôn ngữ)
    const existingRows = this.db.prepare(`
      SELECT scheduledAt, language FROM publications 
      WHERE status IN ('PENDING', 'PUBLISHING', 'RETRYING') 
        AND scheduledAt IS NOT NULL 
        AND (channelId = ? OR (channelId IS NULL AND ? = 'channel_domestic'))
        AND datetime(scheduledAt) > datetime('now')
      ORDER BY datetime(scheduledAt) ASC
    `).all(channelId, channelId);

    // Kiểm tra video vừa đăng trong vòng minIntervalMinutes của kênh này
    const recentPublished = this.db.prepare(`
      SELECT publishedAt as scheduledAt, language FROM publications 
      WHERE publishedAt IS NOT NULL 
        AND (channelId = ? OR (channelId IS NULL AND ? = 'channel_domestic'))
        AND datetime(publishedAt) > datetime('now', '-${minIntervalMinutes} minutes')
      ORDER BY datetime(publishedAt) DESC
      LIMIT 1
    `).all(channelId, channelId);

    const existingItems = [...existingRows, ...recentPublished].map(r => ({
      time: new Date(r.scheduledAt).getTime(),
      language: r.language || 'vi'
    }));

    // 1. CHẾ ĐỘ FAST-TRACK (Nếu người dùng cố ý bật)
    if ((mode === 'fast_track' || mode === 'rolling') && !forceTomorrow) {
      let candidate = new Date(now.getTime() + 2 * 60 * 1000);

      const ch = candidate.getHours();
      if (ch >= 23) {
        candidate.setDate(candidate.getDate() + 1);
        candidate.setHours(7, 15, 0, 0);
      } else if (ch >= 0 && ch < 7) {
        candidate.setHours(7, 15, 0, 0);
      }

      let iterations = 0;
      while (iterations < 200) {
        iterations++;
        const cTime = candidate.getTime();
        const hasConflict = existingItems.some(item => Math.abs(item.time - cTime) < minIntervalMs);
        if (!hasConflict) {
          return candidate.toISOString();
        }
        candidate = new Date(candidate.getTime() + minIntervalMs);
        if (candidate.getHours() >= 23) {
          candidate.setDate(candidate.getDate() + 1);
          candidate.setHours(7, 15, 0, 0);
        }
      }
      return candidate.toISOString();
    }

    // 2. CHẾ ĐỘ GOM KHUNG GIỜ VÀNG (peak_hours) - DỨT ĐIỂM TRONG NGÀY
    const startDayOffset = forceTomorrow ? 1 : 0;
    const maxDaysAhead = (mode === 'fast_track') ? 1 : 14;
    const getLocalDayStr = (d) => {
      const dateObj = (d instanceof Date) ? d : new Date(d);
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(dateObj);
    };

    for (let dayOffset = startDayOffset; dayOffset <= maxDaysAhead; dayOffset++) {
      const targetDay = new Date(now);
      targetDay.setDate(targetDay.getDate() + dayOffset);
      const dayStr = getLocalDayStr(targetDay);

      // Kiểm tra giới hạn số video trong ngày lịch theo múi giờ Việt Nam
      const videosOnDay = existingItems.filter(item => getLocalDayStr(item.time) === dayStr);
      if (maxPerDay > 0 && videosOnDay.length >= maxPerDay) {
        continue;
      }

      // Kiểm tra hạn ngạch phân nhánh riêng cho Kênh 1 (FactLoop: tối đa 6 VN + 4 Global)
      if (channelId === 'channel_domestic') {
        const isCurrentVn = (language !== 'en');
        const maxVn = conf.CHANNELS?.channel_domestic?.maxVideosDomestic || 6;
        const maxEn = conf.CHANNELS?.channel_domestic?.maxVideosInternational || 4;
        
        if (isCurrentVn) {
          const vnCount = videosOnDay.filter(i => i.language !== 'en').length;
          if (vnCount >= maxVn) continue;
        } else {
          const enCount = videosOnDay.filter(i => i.language === 'en').length;
          if (enCount >= maxEn) continue;
        }
      }

      const windows = this.getGoldenWindows(targetDay, language, channelId);

      for (const win of windows) {
        const wStart = new Date(targetDay);
        wStart.setHours(win.startHour, win.startMinute, 0, 0);
        const wEnd = new Date(targetDay);
        wEnd.setHours(win.endHour, win.endMinute, 0, 0);

        if (wEnd.getTime() <= now.getTime() + 5 * 60 * 1000) {
          continue;
        }

        const inWindow = existingItems.filter(item => item.time >= wStart.getTime() && item.time <= wEnd.getTime());
        if (inWindow.length >= win.maxVideos) {
          continue;
        }

        let candidate = new Date(wStart);
        if (now.getTime() >= wStart.getTime() && now.getTime() < wEnd.getTime()) {
          candidate = new Date(now.getTime() + 2 * 60 * 1000);
        }

        while (candidate.getTime() <= wEnd.getTime()) {
          if (candidate.getTime() >= now.getTime() + 2 * 60 * 1000) {
            const cTime = candidate.getTime();
            const isCurrentEn = (language === 'en');

            // Kiểm tra xung đột & chống trùng giờ:
            // - Cùng ngôn ngữ: Cách nhau tối thiểu minIntervalMs (45 phút)
            // - Khác ngôn ngữ trên Kênh 1 (VN vs EN): Nếu cách nhau < 15 phút, tự động lệch +15 phút
            let hasConflict = false;
            for (const item of existingItems) {
              const diffMs = Math.abs(item.time - cTime);
              const isSameLang = (item.language === 'en') === isCurrentEn;

              if (isSameLang) {
                if (diffMs < minIntervalMs) {
                  hasConflict = true;
                  break;
                }
              } else {
                // Khác ngôn ngữ: cách nhau tối thiểu 15 phút (chống trùng giờ vàng, cộng thêm 15p)
                if (diffMs < 15 * 60 * 1000) {
                  hasConflict = true;
                  break;
                }
              }
            }

            if (!hasConflict) {
              return candidate.toISOString();
            }
          }
          // Bước nhảy 15 phút để linh hoạt điều chỉnh lệch slot +15p
          candidate = new Date(candidate.getTime() + 15 * 60 * 1000);
        }
      }
    }

    // Fallback: Nếu tất cả các ngày trong 14 ngày tới đều kín slot, hẹn sau video cuối cùng một khoảng giãn cách an toàn
    if (existingItems.length > 0) {
      const maxExisting = Math.max(...existingItems.map(i => i.time));
      let fallbackCandidate = new Date(maxExisting + 15 * 60 * 1000);
      const ch = fallbackCandidate.getHours();
      if (ch >= 23) {
        fallbackCandidate.setDate(fallbackCandidate.getDate() + 1);
        fallbackCandidate.setHours(7, 15, 0, 0);
      } else if (ch >= 0 && ch < 7) {
        fallbackCandidate.setHours(7, 15, 0, 0);
      }
      return fallbackCandidate.toISOString();
    }

    return new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
  }

  createPublication(storyId, renderId, platform, title, caption, tags = [], language = 'vi', scheduledAt = null, channelId = null, extraMeta = {}) {
    const pubId = `PUB-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Tự động phân luồng kênh nếu chưa chỉ định
    let targetChannelId = channelId;
    if (!targetChannelId) {
      try {
        const { ChannelRouter } = require('./channel_router.js');
        const router = new ChannelRouter();
        targetChannelId = router.route({ title, language, tags });
      } catch(e) {
        targetChannelId = 'channel_domestic';
      }
    }

    // Kiểm tra ngôn ngữ: TikTok, Facebook và Instagram Reels chỉ đăng video Tiếng Việt. Video tiếng Anh chỉ dành riêng cho YouTube Kênh 3.
    const isEnglish = (language === 'en' || targetChannelId === 'channel_global');
    if (platform !== 'youtube' && isEnglish) {
      logger.info(`[Publisher] ℹ️ Bỏ qua tạo publication cho [${platform}]: Nền tảng này chỉ đăng video Tiếng Việt. Video tiếng Anh (${targetChannelId}) chỉ xuất bản riêng cho YouTube Kênh 3.`);
      return null;
    }

    // Kế thừa Layout Version & Metadata từ renderId nếu có
    let layoutVersion = extraMeta.layoutVersion || 'v2.0-narrative-5-7s';
    let layoutTypes = extraMeta.layoutTypes || '["list"]';
    let sceneCount = extraMeta.sceneCount || 5;
    let durationSeconds = extraMeta.durationSeconds || null;
    let priorityScore = extraMeta.priorityScore || extraMeta.impactScore || 7.5;

    if (renderId) {
      try {
        const renderRow = this.db.prepare('SELECT layoutVersion, layoutTypes, sceneCount, durationSeconds FROM renders WHERE renderId = ?').get(renderId);
        if (renderRow) {
          if (renderRow.layoutVersion) layoutVersion = renderRow.layoutVersion;
          if (renderRow.layoutTypes) layoutTypes = renderRow.layoutTypes;
          if (renderRow.sceneCount) sceneCount = renderRow.sceneCount;
          if (renderRow.durationSeconds) durationSeconds = renderRow.durationSeconds;
        }
      } catch (e) {}
    }

    // Tự động phân phối vào khung giờ vàng theo kênh và ngôn ngữ
    const targetScheduledAt = scheduledAt || this.calculateNextPeakSlot(false, language, targetChannelId);

    // Tự động dọn dẹp các tin quá hạn / nguội trước khi xếp lịch mới
    this.evictStalePublications(24);

    // Làm sạch caption phòng trường hợp có __lang sót lại
    const cleanCaption = (caption || '').replace(/__lang:[a-z]+__/gi, '').trim();

    this.db.prepare(`
      INSERT INTO publications (publicationId, storyId, renderId, platform, title, caption, language, channelId, status, scheduledAt, layoutVersion, layoutTypes, sceneCount, durationSeconds, priorityScore)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(pubId, storyId, renderId, platform, title, cleanCaption, language, targetChannelId, 'PENDING', targetScheduledAt, layoutVersion, layoutTypes, sceneCount, durationSeconds, priorityScore);

    // Tự động tối ưu lại hàng đợi nếu tin này đạt điểm cao (Re-Ranking & Compact)
    // Giúp tin HOT giành slot giờ vàng sớm nhất, đẩy các bài điểm thấp hơn xuống dưới
    let finalScheduledAt = targetScheduledAt;
    if (priorityScore >= 8.5) {
      try {
        this.compactSchedule(targetChannelId);
        const updatedRow = this.db.prepare('SELECT scheduledAt FROM publications WHERE publicationId = ?').get(pubId);
        if (updatedRow && updatedRow.scheduledAt) {
          finalScheduledAt = updatedRow.scheduledAt;
        }
      } catch(e) {}
    }

    return { pubId, scheduledAt: finalScheduledAt, channelId: targetChannelId };
  }

  /**
   * Tự động quản lý vòng đời tin tức trong hàng đợi xuất bản:
   * 1. BẢO VỆ TUYỆT ĐỐI LỊCH HẸN TƯƠNG LAI:
   *    - Nếu scheduledAt > now (dù là tối nay, ngày mai, ngày kia): KHÔNG BAO GIỜ HỦY, bất kể createdAt bao lâu.
   * 2. TIN GIÁ TRỊ CAO / ĐIỂM CAO (priorityScore >= 8.0 hoặc Evergreen):
   *    - KHÔNG BAO GIỜ tự hủy sau 24h.
   *    - Nếu bị trễ hẹn cũ trong quá khứ (scheduledAt < now - 3h) do hệ thống bận:
   *      -> TỰ ĐỘNG DỜI LỊCH (Auto-Rollover) sang khung giờ vàng còn trống sớm nhất của ngày tiếp theo!
   *    - Thời gian lưu trữ an toàn tối đa lên đến 7 ngày (168 giờ).
   * 3. TIN THỜI SỰ NHANH / ĐIỂM THƯỜNG (priorityScore < 8.0):
   *    - Nếu không có lịch hẹn và đã quá 24h, hoặc trễ hẹn cũ quá 6h:
   *      -> Tự động hủy 'CANCELLED' để nhường slot cho tin nóng mới trong ngày.
   */
  evictStalePublications(maxAgeHours = 24) {
    try {
      // Tự động giải phóng các bài bị kẹt trạng thái PUBLISHING quá 30 phút do lỗi mạng hoặc restart
      this.db.prepare(`
        UPDATE publications
        SET status = 'RETRYING',
            lastError = 'Tự động phục hồi từ trạng thái PUBLISHING bị gián đoạn',
            updatedAt = CURRENT_TIMESTAMP
        WHERE status = 'PUBLISHING' AND datetime(updatedAt) < datetime('now', '-30 minutes')
      `).run();

      const pastScheduleThreshold = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
      const normalCreatedThreshold = new Date(Date.now() - maxAgeHours * 3600 * 1000).toISOString();

      // Chỉ lấy các ứng viên thực sự quá hạn:
      // 1. Không có lịch hẹn và đã tạo > 24h
      // 2. HOẶC có lịch hẹn nhưng ĐÃ TRÔI VỀ QUÁ KHỨ > 3 giờ mà chưa đăng
      // (TUYỆT ĐỐI KHÔNG LẤY các bài có scheduledAt > now trong tương lai!)
      const candidates = this.db.prepare(`
        SELECT publicationId, title, scheduledAt, createdAt, priorityScore, language, channelId
        FROM publications 
        WHERE status IN ('PENDING', 'RETRYING')
          AND (
            (scheduledAt IS NULL AND datetime(createdAt) < datetime(?))
            OR (scheduledAt IS NOT NULL AND datetime(scheduledAt) < datetime(?))
          )
      `).all(normalCreatedThreshold, pastScheduleThreshold);

      if (!candidates || candidates.length === 0) return 0;

      let cancelledCount = 0;
      let rolledOverCount = 0;

      const cancelStmt = this.db.prepare(`
        UPDATE publications 
        SET status = 'CANCELLED', 
            lastError = ?,
            updatedAt = CURRENT_TIMESTAMP
        WHERE publicationId = ?
      `);

      const rolloverStmt = this.db.prepare(`
        UPDATE publications
        SET scheduledAt = ?,
            updatedAt = CURRENT_TIMESTAMP
        WHERE publicationId = ?
      `);

      for (const item of candidates) {
        const score = (typeof item.priorityScore === 'number') ? item.priorityScore : 7.5;
        const isHighValue = score >= 8.0;

        // Xử lý bài điểm cao (>= 8.0): Tự động dời lịch sang giờ vàng tiếp theo nếu tạo trong 7 ngày
        if (isHighValue) {
          const rawCreated = item.createdAt ? (item.createdAt.includes('T') ? item.createdAt : item.createdAt.replace(' ', 'T') + 'Z') : new Date().toISOString();
          const isCreatedWithin7Days = (new Date(rawCreated).getTime() >= (Date.now() - 7 * 24 * 3600 * 1000));
          if (isCreatedWithin7Days) {
            const nextSlot = this.calculateNextPeakSlot(false, item.language || 'vi', item.channelId || 'channel_domestic');
            rolloverStmt.run(nextSlot, item.publicationId);
            rolledOverCount++;
            logger.info(`[Publisher] 🌟 DỜI LỊCH TỰ ĐỘNG (Điểm cao ${score}): Bài "${item.title || item.publicationId}" được dời sang khung giờ vàng mới: ${nextSlot}`);
            continue;
          }
        }

        // Tin thường quá hạn hoặc tin điểm cao quá 7 ngày: Hủy nhường slot
        const reason = isHighValue 
          ? 'Đã hết hạn lưu trữ tin điểm cao (quá 7 ngày chưa xuất bản)'
          : `Đã hủy tự động do tin tức quá hạn ${maxAgeHours}h (nhường chỗ cho tin mới nóng trong ngày)`;
        cancelStmt.run(reason, item.publicationId);
        cancelledCount++;
        logger.info(`[Publisher] 🗑️ Đã hủy tin quá hạn: "${item.title || item.publicationId}" (${reason})`);
      }

      if (rolledOverCount > 0 || cancelledCount > 0) {
        logger.info(`[Publisher] 🧹 Quản lý vòng đời bài viết: Đã dời lịch ${rolledOverCount} bài điểm cao, hủy ${cancelledCount} bài quá hạn.`);
      }

      return cancelledCount;
    } catch(e) {
      logger.error(`[Publisher] Lỗi khi quản lý vòng đời bài viết: ${e.message}`);
      return 0;
    }
  }

  /**
   * Tự động dồn lịch lấp đầy các khung giờ vàng bị trống (Auto Compact Schedule):
   * Quét toàn bộ video PENDING và tái phân bổ vào các slot giờ vàng sớm nhất còn trống.
   */
  compactSchedule(channelId = null) {
    try {
      const channelsToProcess = (channelId && channelId !== 'all')
        ? [channelId]
        : ['channel_domestic', 'channel_tech', 'channel_global'];

      let totalUpdated = 0;
      const allResults = [];

      for (const ch of channelsToProcess) {
        const query = `
          SELECT publicationId, channelId, language, title, createdAt, scheduledAt, priorityScore
          FROM publications
          WHERE status IN ('PENDING', 'RETRYING')
            AND (channelId = ? OR (channelId IS NULL AND ? = 'channel_domestic'))
          ORDER BY COALESCE(priorityScore, 7.5) DESC, datetime(createdAt) ASC
        `;
        const pending = this.db.prepare(query).all(ch, ch);
        if (!pending || pending.length === 0) continue;

        // Tạm thời set scheduledAt = NULL để giải phóng các slot cho kênh này
        const clearStmt = this.db.prepare(`UPDATE publications SET scheduledAt = NULL WHERE publicationId = ?`);
        const updateStmt = this.db.prepare(`UPDATE publications SET scheduledAt = ? WHERE publicationId = ?`);

        for (const item of pending) {
          clearStmt.run(item.publicationId);
        }

        for (const item of pending) {
          const nextSlot = this.calculateNextPeakSlot(false, item.language || 'vi', ch);
          updateStmt.run(nextSlot, item.publicationId);
          allResults.push({ publicationId: item.publicationId, title: item.title, channelId: ch, newSlot: nextSlot });
          totalUpdated++;
        }
      }

      logger.info(`[Publisher] ⚡ Đã tự động dồn lịch lấp đầy các khung giờ vàng cho ${totalUpdated} video.`);
      return { ok: true, updatedCount: totalUpdated, items: allResults };
    } catch(e) {
      logger.error(`[Publisher] Lỗi dồn lịch: ${e.message}`);
      return { ok: false, error: e.message };
    }
  }

  getPendingPublications() {
    this.evictStalePublications(24);
    return this.db.prepare(`
      SELECT * FROM publications
      WHERE status IN ('PENDING', 'RETRYING')
      AND (scheduledAt IS NULL OR datetime(scheduledAt) <= datetime('now'))
    `).all();
  }

  async processQueue(publicationIds = null) {
    if (this.isProcessingQueue) {
      logger.warn('[Publisher] ⏳ Đang có một tiến trình xuất bản chạy nền. Bỏ qua lượt gọi mới để chống trùng lặp upload video!');
      return;
    }
    this.isProcessingQueue = true;

    try {
      this.evictStalePublications(24);
      let pubs;
      if (publicationIds && Array.isArray(publicationIds) && publicationIds.length > 0) {
        const placeholders = publicationIds.map(() => '?').join(',');
        pubs = this.db.prepare(`
          SELECT * FROM publications
          WHERE publicationId IN (${placeholders})
            AND status NOT IN ('PUBLISHED', 'PUBLISHING')
        `).all(...publicationIds);
      } else {
        pubs = this.getPendingPublications();
      }

      for (const pub of pubs) {
        // Khóa nguyên tử (Atomic Lock): Chỉ nhận xử lý nếu status vẫn là PENDING/RETRYING/FAILED
        const lockRes = this.db.prepare(`
          UPDATE publications 
          SET status = 'PUBLISHING', updatedAt = CURRENT_TIMESTAMP 
          WHERE publicationId = ? AND status IN ('PENDING', 'RETRYING', 'FAILED')
        `).run(pub.publicationId);

        if (lockRes.changes === 0) {
          logger.warn(`[Publisher] Bỏ qua publication ${pub.publicationId} vì đã được luồng khác tiếp nhận.`);
          continue;
        }

        await this.publish(pub);
      }
    } finally {
      this.isProcessingQueue = false;
    }
  }

  async publish(pub) {
    logger.info(`[Publisher] Đang xử lý publication ${pub.publicationId} cho ${pub.platform}`);
    const provider = this.providers[pub.platform];

    if (!provider) {
      this.updateStatus(pub.publicationId, 'FAILED', `No provider found for platform: ${pub.platform}`);
      return;
    }

    try {
      // Kiểm tra an toàn: Nếu video đã có platformVideoId hoặc trạng thái PUBLISHED thì dừng ngay
      const checkRow = this.db.prepare('SELECT status, platformVideoId FROM publications WHERE publicationId = ?').get(pub.publicationId);
      if (checkRow && checkRow.status === 'PUBLISHED' && checkRow.platformVideoId) {
        logger.warn(`[Publisher] 🛑 Video ${pub.publicationId} đã được xuất bản trước đó (${checkRow.platformVideoId}). Huỷ bỏ để chống đăng kép!`);
        return;
      }

      // Kiểm tra an toàn ngôn ngữ: TikTok và Facebook Reels chỉ đăng video Tiếng Việt
      if (pub.platform !== 'youtube' && (pub.language === 'en' || pub.channelId === 'channel_global')) {
        logger.warn(`[Publisher] 🛑 Bỏ qua xuất bản #${pub.publicationId} lên ${pub.platform}: Kênh này chỉ đăng Tiếng Việt. Video tiếng Anh được bảo lưu riêng cho YouTube Kênh 3.`);
        this.updateStatus(pub.publicationId, 'CANCELLED', 'Hủy tự động: TikTok và FB Reels chỉ đăng video Tiếng Việt.');
        return;
      }

      this.updateStatus(pub.publicationId, 'PUBLISHING');

      // 1. Lấy thông tin Render
      const render = this.db.prepare('SELECT * FROM renders WHERE renderId = ?').get(pub.renderId);
      if (!render) throw new Error('Không tìm thấy thông tin render trong cơ sở dữ liệu');

      // 2. Tìm file video thực tế trên ổ cứng (hỗ trợ nhiều fallback chống ENOENT)
      const path = require('path');
      const fs = require('fs');

      let resolvedMediaPath = render.videoPath;
      if (!resolvedMediaPath || !fs.existsSync(resolvedMediaPath)) {
        // Fallback 1: Tìm đệ quy trong thư mục out/videos theo tiền tố renderId (hỗ trợ cả slug và thư mục ngày/kênh)
        const findVideoRecursive = (dir) => {
          if (!fs.existsSync(dir)) return null;
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              const res = findVideoRecursive(full);
              if (res) return res;
            } else if (entry.isFile() && entry.name.endsWith('.mp4')) {
              if (entry.name === `${pub.renderId}.mp4` || entry.name.startsWith(`${pub.renderId}_`) || entry.name.startsWith(pub.renderId)) {
                return full;
              }
            }
          }
          return null;
        };

        const foundPath = findVideoRecursive(path.join(process.cwd(), 'out', 'videos'));
        if (foundPath) {
          resolvedMediaPath = foundPath;
        } else {
          // Fallback 2: Tìm file preview out/auto_news_result.mp4
          const defaultPath = path.join(process.cwd(), 'out', 'auto_news_result.mp4');
          if (fs.existsSync(defaultPath)) {
            resolvedMediaPath = defaultPath;
          } else {
            throw new Error(`File video không còn trên ổ cứng (có thể đã được dọn dẹp sau 24h). Vui lòng render lại video này.`);
          }
        }
      }

      // 3. Load cấu hình quyền riêng tư
      let privacyStatus = 'public';
      try {
        const confPath = path.join(__dirname, '../../config.json');
        if (fs.existsSync(confPath)) {
          const conf = JSON.parse(fs.readFileSync(confPath, 'utf-8'));
          if (conf.YOUTUBE_PRIVACY) privacyStatus = conf.YOUTUBE_PRIVACY;
        }
      } catch(e) {}
      if (process.env.YOUTUBE_PRIVACY) privacyStatus = process.env.YOUTUBE_PRIVACY;
      if (process.env.DEFAULT_PRIVACY) privacyStatus = process.env.DEFAULT_PRIVACY;

      // 4. Thực hiện xuất bản lên nền tảng
      const cleanCaption = (pub.caption || '').replace(/__lang:[a-z]+__/gi, '').trim();

      // Kiểm tra xem có Custom Thumbnail 9:16 tương ứng với render này không
      let resolvedThumbnailPath = null;
      if (pub.renderId) {
        const potentialThumb = path.join(process.cwd(), 'out', `thumb_${pub.renderId}.jpg`);
        if (fs.existsSync(potentialThumb)) {
          resolvedThumbnailPath = potentialThumb;
        }
      }

      const result = await provider.publish({
        storyId: pub.storyId,
        mediaPath: resolvedMediaPath,
        thumbnailPath: resolvedThumbnailPath,
        title: pub.title,
        caption: cleanCaption,
        language: pub.language || 'vi',
        channelId: pub.channelId || 'channel_domestic',
        privacyStatus: privacyStatus
      });

      // 5. Ghi nhận thành công
      this.db.prepare(`
        UPDATE publications
        SET status = 'PUBLISHED', platformVideoId = ?, url = ?, publishedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
        WHERE publicationId = ?
      `).run(result.platformVideoId, result.url, pub.publicationId);

      logger.info(`[Publisher] ✅ Xuất bản thành công: ${result.url}`);
    } catch (err) {
      logger.error(`[Publisher] ❌ Lỗi xuất bản ${pub.publicationId}: ${err.message}`);

      // Tự động hoãn sang khung giờ vàng ngày mai nếu chạm giới hạn upload của YouTube
      const isQuotaExceeded = (err.message && (
        err.message.includes('exceeded the number of videos') ||
        err.message.includes('quotaExceeded') ||
        err.message.includes('uploadLimitExceeded')
      ));

      if (isQuotaExceeded) {
        // Thử lên lịch hôm nay trước, chỉ sang ngày mai nếu hôm nay hết slot
        const nextSlot = this.calculateNextPeakSlot(false);
        this.db.prepare(`
          UPDATE publications 
          SET status = 'RETRYING', scheduledAt = ?, lastError = ?, updatedAt = CURRENT_TIMESTAMP 
          WHERE publicationId = ?
        `).run(nextSlot, '⚠️ Đã chạm hạn ngạch upload YouTube. Hệ thống tự động dời lịch sang khung giờ vàng gần nhất.', pub.publicationId);
        logger.warn(`[Publisher] ⏳ Đã tự động dời lịch publication ${pub.publicationId} sang ${nextSlot}`);
        return;
      }

      this.updateStatus(pub.publicationId, 'FAILED', err.message);
    }
  }

  updateStatus(pubId, status, error = null) {
    this.db.prepare(`
      UPDATE publications
      SET status = ?, lastError = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE publicationId = ?
    `).run(status, error, pubId);
  }
}

module.exports = { Publisher };
