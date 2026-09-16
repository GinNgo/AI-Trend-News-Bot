const fs = require('fs');
const path = require('path');
const { PlatformAdapter } = require('../adapters/platform_adapter.js');
const logger = require('../../collector/utils/logger.js');
const { uploadToTikTokViaEdge, checkTikTokLoginStatus } = require('./tiktok_edge_publisher.js');

class TikTokProvider extends PlatformAdapter {
  constructor() {
    super('tiktok');
  }

  getConfig() {
    const configPath = path.join(process.cwd(), 'config.json');
    if (fs.existsSync(configPath)) {
      try {
        return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      } catch (e) {}
    }
    return {};
  }

  async authenticate() {
    return true;
  }

  async validateAccount() {
    const status = await checkTikTokLoginStatus();
    return status.loggedIn;
  }

  async validateMedia(mediaPath) {
    return fs.existsSync(mediaPath);
  }

  async publish(publicationRecord) {
    logger.info(`[TikTokProvider] Bắt đầu xuất bản video lên TikTok qua Trình duyệt: ${publicationRecord.title}`);

    const conf = this.getConfig();
    if (conf.ENABLE_TIKTOK === false) {
      throw new Error("TikTok publishing is disabled in config.json. Bật ENABLE_TIKTOK=true để tiếp tục.");
    }

    // Lọc tags từ caption
    const cleanCaption = (publicationRecord.caption || '').replace(/__lang:[a-z]+__/gi, '').trim();
    const rawTags = (cleanCaption.match(/#[\p{L}\p{N}_]+/gu) || []).map(t => t.slice(1));
    const autoTags = rawTags.filter(t => !t.toLowerCase().includes('lang') && !t.startsWith('_'));
    
    // Lấy defaultTags theo kênh (channel_domestic, channel_tech, channel_global)
    let channelTags = ['xuhuong', 'tiktoknews', 'trending', 'shorts'];
    const channelId = publicationRecord.channelId;
    if (conf.CHANNELS && channelId && conf.CHANNELS[channelId] && Array.isArray(conf.CHANNELS[channelId].defaultTags)) {
      channelTags = conf.CHANNELS[channelId].defaultTags;
    }
    const mergedTags = [...new Set([...autoTags, ...channelTags])];

    const result = await uploadToTikTokViaEdge({
      videoPath: publicationRecord.mediaPath,
      title: publicationRecord.title,
      tags: mergedTags
    });

    const postUrl = result.url || 'https://www.tiktok.com/@me';
    return {
      platformVideoId: result.postId || `tiktok-${Date.now()}`,
      url: postUrl
    };
  }
}

module.exports = { TikTokProvider };
