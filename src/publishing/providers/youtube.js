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

  async publish(publicationRecord) {
    logger.info(`[YouTubeProvider] Uploading to YouTube for story ${publicationRecord.storyId}`);

    
    if (process.env.DRY_RUN === 'true') {
      logger.info("[YouTubeProvider] DRY_RUN: Upload skipped. Returning DRY_RUN status.");
      throw new Error("DRY_RUN: API Upload aborted deliberately. No fake ID will be generated.");
    }


    if (!this.oauth2Client) throw new Error('Not authenticated with YouTube. Missing client_secret.json or tokens.json');

    const youtube = google.youtube({ version: 'v3', auth: this.oauth2Client });
    const fileSize = fs.statSync(publicationRecord.mediaPath).size;

    const autoTags = (publicationRecord.caption.match(/#[\p{L}\p{N}_]+/gu) || []).map(t => t.slice(1));
    const mergedTags = [...new Set([...autoTags, 'shorts', 'news', 'thoisu', 'xuhuong'])];

    const res = await youtube.videos.insert({
      part: 'snippet,status',
      requestBody: {
        snippet: {
          title: (publicationRecord.title || 'Bản Tin Nóng').substring(0, 100),
          description: publicationRecord.caption || '',
          tags: mergedTags,
          categoryId: '28',
          defaultLanguage: 'vi',
          defaultAudioLanguage: 'vi'
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

    return {
      platformVideoId: res.data.id,
      url: `https://youtube.com/shorts/${res.data.id}`
    };
  }
}

module.exports = { YouTubeProvider };
