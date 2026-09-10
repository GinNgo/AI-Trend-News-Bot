const { getDb } = require('../storage/db.js');
const { YouTubeProvider } = require('./providers/youtube.js');
const { TikTokProvider } = require('./providers/tiktok.js');
const { MetaProvider } = require('./providers/meta.js');
const { MockProvider } = require('./providers/mock.js');
const logger = require('../collector/utils/logger.js');

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
  }

  createPublication(storyId, renderId, platform, title, caption, tags = []) {
    const pubId = `PUB-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    this.db.prepare(`
      INSERT INTO publications (publicationId, storyId, renderId, platform, title, caption, status)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(pubId, storyId, renderId, platform, title, caption, 'PENDING');

    return pubId;
  }

  getPendingPublications() {
    return this.db.prepare(`
      SELECT * FROM publications
      WHERE status IN ('PENDING', 'RETRYING')
      AND (scheduledAt IS NULL OR scheduledAt <= CURRENT_TIMESTAMP)
    `).all();
  }

  async processQueue() {
    const pubs = this.getPendingPublications();
    for (const pub of pubs) {
      await this.publish(pub);
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
      this.updateStatus(pub.publicationId, 'PUBLISHING');

      // 1. Get render info
      const render = this.db.prepare('SELECT * FROM renders WHERE renderId = ?').get(pub.renderId);
      if (!render) throw new Error('Render not found');

      // 2. Load platform credentials (mocked for now unless via oauth flow)
      // Usually would come from a tokens table or env

      // 3. Perform upload
      const result = await provider.publish({
        storyId: pub.storyId,
        mediaPath: render.videoPath,
        title: pub.title,
        caption: pub.caption,
        privacyStatus: process.env.DEFAULT_PRIVACY || 'private'
      });

      // 4. Record success
      this.db.prepare(`
        UPDATE publications
        SET status = 'PUBLISHED', platformVideoId = ?, url = ?, publishedAt = CURRENT_TIMESTAMP, updatedAt = CURRENT_TIMESTAMP
        WHERE publicationId = ?
      `).run(result.platformVideoId, result.url, pub.publicationId);

      logger.info(`[Publisher] ✅ Xuất bản thành công: ${result.url}`);
    } catch (err) {
      logger.error(`[Publisher] ❌ Lỗi xuất bản ${pub.publicationId}: ${err.message}`);
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
