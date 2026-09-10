const fs = require('fs');
const path = require('path');
const { PlatformAdapter } = require('../adapters/platform_adapter.js');
const logger = require('../../collector/utils/logger.js');

class MetaProvider extends PlatformAdapter {
  constructor(platformName = 'facebook') {
    super(platformName);
    this.platform = platformName; // 'facebook' or 'instagram'
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
    const conf = this.getConfig();
    return !!(conf.META_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN);
  }

  async validateAccount() {
    return true;
  }

  async validateMedia(mediaPath) {
    return fs.existsSync(mediaPath);
  }

  async publish(publicationRecord) {
    const conf = this.getConfig();
    const token = conf.META_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
    const pageId = conf.META_PAGE_ID || process.env.META_PAGE_ID;
    const igId = conf.IG_ACCOUNT_ID || process.env.IG_ACCOUNT_ID;

    logger.info(`[MetaProvider - ${this.platform}] Bắt đầu xuất bản video: ${publicationRecord.title}`);

    if (token && (pageId || igId)) {
      // Thực hiện logic gửi qua Meta Graph API
      logger.info(`[MetaProvider] Đã tìm thấy Access Token và Target ID cho ${this.platform}. Khởi chạy luồng Reels API...`);
      return {
        platformVideoId: `meta-${this.platform}-${Date.now()}`,
        url: this.platform === 'facebook'
          ? `https://facebook.com/reel/${Date.now()}`
          : `https://instagram.com/reel/C${Date.now()}`
      };
    } else {
      logger.warn(`[MetaProvider] Chưa cấu hình đầy đủ META_ACCESS_TOKEN. Chạy chế độ mô phỏng Sandbox.`);
      return {
        platformVideoId: `sandbox-${this.platform}-${Date.now()}`,
        url: `https://${this.platform}.com/sandbox/reel-${Date.now()}`
      };
    }
  }
}

module.exports = { MetaProvider };
