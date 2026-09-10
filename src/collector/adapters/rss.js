const Parser = require('rss-parser');
const { BaseAdapter } = require('./base');
const logger = require('../utils/logger');
const { isSafeUrl } = require('../../security/url_validator');

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
  }
});

class RSSAdapter extends BaseAdapter {
  constructor(name) {
    super(name, 'rss');
  }

  async collect(feedUrl) {
    if (!isSafeUrl(feedUrl)) {
      throw new Error(`SSRF blocked: Unsafe RSS URL: ${feedUrl}`);
    }
    try {
      logger.info(`Đang lấy RSS từ ${feedUrl}`);
      const feed = await parser.parseURL(feedUrl);

      const articles = feed.items.map(item => {
        return this.normalize({
          sourceId: item.guid || item.id || item.link,
          url: item.link,
          title: item.title,
          author: item.creator || item.author,
          publishedAt: item.pubDate || item.isoDate,
          content: item.content || '',
          summary: item.contentSnippet || item.summary || ''
        });
      });

      logger.info(`Lấy thành công ${articles.length} bài viết từ RSS ${this.name}`);
      return articles;
    } catch (error) {
      logger.error(`Lỗi khi lấy RSS từ ${this.name} (${feedUrl}): ${error.message}`);
      throw error;
    }
  }
}

module.exports = { RSSAdapter };