const crypto = require('crypto');
const { RSSAdapter } = require('./adapters/rss');
const { WebArticleAdapter } = require('./adapters/article');
const { ArxivAdapter } = require('./adapters/arxiv');
const cache = require('./utils/cache');
const logger = require('./utils/logger');

class CollectorManager {
  constructor() {
    this.adapters = {
      rss: new RSSAdapter('GenericRSS'),
      article: new WebArticleAdapter(),
      arxiv: new ArxivAdapter()
    };
  }

  // Generate deterministic ID for duplicate checking
  generateHash(text) {
    return crypto.createHash('sha256').update(text.toLowerCase().trim()).digest('hex');
  }

  isDuplicate(normalizedData) {
    const titleHash = this.generateHash(normalizedData.title);
    if (cache.has(`title_${titleHash}`)) {
      return true;
    }
    // Set cache to prevent future duplicates (expires based on cache config)
    cache.set(`title_${titleHash}`, true);
    return false;
  }

  async collectRSS(feedUrl) {
    try {
      const items = await this.adapters.rss.collect(feedUrl);
      const newItems = items.filter(item => !this.isDuplicate(item));
      logger.info(`Đã lọc trùng lặp cho ${feedUrl}: Còn lại ${newItems.length} tin mới.`);
      return newItems;
    } catch (e) {
      return [];
    }
  }

  async collectArticle(url) {
    try {
      // Avoid re-fetching the same URL
      if (cache.has(`url_${url}`)) {
        logger.info(`Đã cache URL: ${url}, bỏ qua fetch lại.`);
        return cache.get(`url_${url}`);
      }

      const item = await this.adapters.article.collect(url);
      if (!this.isDuplicate(item)) {
        cache.set(`url_${url}`, item);
        return item;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async collectArxiv(query, maxResults = 5) {
    try {
      const items = await this.adapters.arxiv.collect(query, maxResults);
      const newItems = items.filter(item => !this.isDuplicate(item));
      return newItems;
    } catch (e) {
      return [];
    }
  }
}

module.exports = new CollectorManager();