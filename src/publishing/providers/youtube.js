const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { PlatformAdapter } = require('../adapters/platform_adapter.js');
const logger = require('../../collector/utils/logger.js');

class YouTubeProvider extends PlatformAdapter {
  constructor() {
    super('youtube');

    // Đọc từ client_secret.json (fallback cũ của user)
    const secretPath = path.join(process.cwd(), 'client_secret.json');
    if (fs.existsSync(secretPath)) {
      try {
        const rawKey = JSON.parse(fs.readFileSync(secretPath, 'utf-8'));
        const credentials = rawKey.installed || rawKey.web;
        if (credentials) {
          this.clientId = credentials.client_id;
          this.clientSecret = credentials.client_secret;
        }
      } catch (e) {}
    }

    // Nếu không có trong file json, lấy từ ENV
    if (!this.clientId) this.clientId = process.env.YOUTUBE_CLIENT_ID;
    if (!this.clientSecret) this.clientSecret = process.env.YOUTUBE_CLIENT_SECRET;

    this.redirectUri = 'http://localhost:3050/oauth2callback';

    if (this.clientId && this.clientSecret) {
      this.oauth2Client = new google.auth.OAuth2(
        this.clientId,
        this.clientSecret,
        this.redirectUri
      );

      // Auto-load token cũ (tokens.json)
      const tokenPath = path.join(process.cwd(), 'tokens.json');
      if (fs.existsSync(tokenPath)) {
        try {
          const token = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
          this.oauth2Client.setCredentials(token);
        } catch(e) {}
      }
    }
  }

  async authenticate(tokens) {
    if (!this.oauth2Client) throw new Error('Missing YOUTUBE_CLIENT_ID/SECRET');
    this.oauth2Client.setCredentials(tokens);
  }

  async validateAccount() {
    if (!this.oauth2Client) return false;
    try {
      const youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });
      const res = await youtube.channels.list({ part: 'snippet', mine: true });
      return res.data.items && res.data.items.length > 0;
    } catch (err) {
      logger.error(`[YouTubeProvider] Failed to validate account: ${err.message}`);
      return false;
    }
  }

  async validateMedia(mediaPath) {
    return fs.existsSync(mediaPath);
  }

  getClientForChannel(channelId = 'channel_domestic') {
    if (!this.clientId || !this.clientSecret) {
      throw new Error('Missing YOUTUBE_CLIENT_ID/SECRET in client_secret.json or ENV');
    }

    let tokenFile = 'tokens.json';
    if (channelId === 'channel_tech') {
      tokenFile = 'tokens_channel2.json';
    } else if (channelId === 'channel_global') {
      tokenFile = 'tokens_channel3.json';
    }

    let tokenPath = path.join(process.cwd(), tokenFile);
    if (!fs.existsSync(tokenPath)) {
      // Fallback an toàn: nếu chưa đăng nhập kênh riêng, tạm dùng tokens.json
      logger.warn(`[YouTubeProvider] Chưa có ${tokenFile} cho kênh ${channelId}. Tạm thời sử dụng tokens.json làm fallback.`);
      tokenPath = path.join(process.cwd(), 'tokens.json');
    }

    if (!fs.existsSync(tokenPath)) {
      throw new Error(`Chưa có file token YouTube (${tokenFile}). Vui lòng kết nối tài khoản.`);
    }

    const client = new google.auth.OAuth2(
      this.clientId,
      this.clientSecret,
      this.redirectUri
    );
    const token = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
    client.setCredentials(token);
    return client;
  }

  async publish(publicationRecord) {
    logger.info(`[YouTubeProvider] Uploading to YouTube for story ${publicationRecord.storyId} (Channel: ${publicationRecord.channelId || 'channel_domestic'})`);

    if (process.env.DRY_RUN === 'true') {
      logger.info("[YouTubeProvider] DRY_RUN: Upload skipped. Returning DRY_RUN status.");
      throw new Error("DRY_RUN: API Upload aborted deliberately. No fake ID will be generated.");
    }

    const authClient = this.getClientForChannel(publicationRecord.channelId);
    const youtube = google.youtube({ version: 'v3', auth: authClient });
    const fileSize = fs.statSync(publicationRecord.mediaPath).size;

    let botConfig = {};
    const configPath = path.join(process.cwd(), 'config.json');
    if (fs.existsSync(configPath)) {
      try { botConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8')); } catch(e) {}
    }
    const channelId = publicationRecord.channelId || 'channel_domestic';
    const chanConfig = (botConfig.CHANNELS && botConfig.CHANNELS[channelId]) || {};

    const cleanCaption = (publicationRecord.caption || '').replace(/__lang:[a-z]+__/gi, '').trim();
    const rawTags = (cleanCaption.match(/#[\p{L}\p{N}_]+/gu) || []).map(t => t.slice(1));
    const autoTags = rawTags.filter(t => !t.toLowerCase().includes('lang') && !t.startsWith('_'));

    const lang = publicationRecord.language || chanConfig.language || (channelId === 'channel_global' ? 'en' : 'vi');

    // Thẻ tags mặc định linh hoạt theo kênh (Tránh việc video tiếng Anh Kênh 3 bị gán thoisu, xuhuong)
    const defaultChannelTags = chanConfig.defaultTags || (
      channelId === 'channel_global'
        ? ['shorts', 'curiousglobe', 'facts', 'science', 'mysteries', 'didyouknow', 'space', 'trending']
        : (channelId === 'channel_tech'
            ? ['shorts', 'congnghe', 'tech', 'kaiviet', 'ai', 'khoahoc', 'tintuc']
            : ['shorts', 'thoisu', 'tintuc', 'xuhuong', 'vietnam', 'thoisuvn'])
    );
    const mergedTags = [...new Set([...autoTags, ...defaultChannelTags])];

    const categoryId = chanConfig.categoryId || (channelId === 'channel_domestic' ? '25' : '28');

    // Lời kêu gọi đăng ký (CTA) & Tuyên bố AI phù hợp từng kênh
    const ctaText = chanConfig.ctaText || (
      lang === 'en'
        ? '\n\n🔔 Subscribe to Curious Globe for daily mind-blowing facts & mysteries!'
        : '\n\n🔔 Đăng ký kênh để cập nhật những thông tin mới nhất mỗi ngày!'
    );

    const aiDisclosure = chanConfig.aiDisclosure || (
      lang === 'en'
        ? '\n⚠️ Content synthesized and edited with AI News Bot assistance. #AI #Shorts #Facts'
        : '\n⚠️ Bản tin được tổng hợp và hỗ trợ biên tập bằng công nghệ AI Tin Tức. #AI #TinNong #Shorts'
    );

    let finalDescription = cleanCaption;
    if (!finalDescription.toLowerCase().includes('subscribe') && !finalDescription.toLowerCase().includes('đăng ký')) {
      finalDescription += ctaText;
    }
    if (!finalDescription.includes('#AI')) {
      finalDescription += '\n' + aiDisclosure;
    }

    const res = await youtube.videos.insert({
      part: 'snippet,status',
      requestBody: {
        snippet: {
          title: (publicationRecord.title || (lang === 'en' ? 'Curious Globe Shorts' : 'Bản Tin Nóng')).substring(0, 100),
          description: finalDescription,
          tags: mergedTags,
          categoryId: categoryId,
          defaultLanguage: lang,
          defaultAudioLanguage: lang === 'en' ? 'en-US' : 'vi-VN'
        },
        status: {
          privacyStatus: publicationRecord.privacyStatus || 'public',
          selfDeclaredMadeForKids: false
        }
      },
      media: {
        body: fs.createReadStream(publicationRecord.mediaPath)
      }
    });

    logger.info(`[YouTubeProvider] Uploaded successfully: ${res.data.id}`);

    // Tự động tải lên Custom Shorts Thumbnail 9:16 (5:4 Safe Zone) nếu có
    if (publicationRecord.thumbnailPath && fs.existsSync(publicationRecord.thumbnailPath)) {
      try {
        logger.info(`[YouTubeProvider] Đang tải lên Custom Shorts Thumbnail (9:16) cho video ${res.data.id}...`);
        await youtube.thumbnails.set({
          videoId: res.data.id,
          media: {
            mimeType: 'image/jpeg',
            body: fs.createReadStream(publicationRecord.thumbnailPath)
          }
        });
        logger.info(`[YouTubeProvider] ✅ Custom Shorts Thumbnail đã được áp dụng thành công cho ${res.data.id}!`);
      } catch (thumbErr) {
        logger.warn(`[YouTubeProvider] ⚠️ Không thể tải lên Custom Thumbnail: ${thumbErr.message}`);
      }
    }

    return {
      platformVideoId: res.data.id,
      url: `https://youtube.com/shorts/${res.data.id}`
    };
  }
}

module.exports = { YouTubeProvider };
