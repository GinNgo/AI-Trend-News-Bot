const robotsParser = require('robots-parser');
const axios = require('axios');
const logger = require('../utils/logger');

const robotsCache = new Map();

async function checkRobotsTxt(urlStr) {
  try {
    const url = new URL(urlStr);
    const robotsUrl = `${url.origin}/robots.txt`;

    if (!robotsCache.has(robotsUrl)) {
      try {
        const response = await axios.get(robotsUrl, { timeout: 5000 });
        const robots = robotsParser(robotsUrl, response.data);
        robotsCache.set(robotsUrl, robots);
      } catch (err) {
        // If no robots.txt or error, assume allowed
        robotsCache.set(robotsUrl, robotsParser(robotsUrl, 'User-agent: *\nAllow: /'));
      }
    }

    const robots = robotsCache.get(robotsUrl);
    const isAllowed = robots.isAllowed(urlStr, 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)');
    return isAllowed;
  } catch (error) {
    logger.warn(`Lỗi khi parse URL để check robots.txt: ${urlStr}`);
    return true; // Allow by default if URL parse fails
  }
}

class BaseAdapter {
  constructor(name, type) {
    this.name = name;
    this.type = type;
  }

  /**
   * Main method to collect a list of articles or single article
   */
  async collect(urlOrOptions) {
    throw new Error('Method collect() must be implemented');
  }

  /**
   * Helper to normalize output
   */
  normalize(data) {
    return {
      sourceId: data.sourceId || `${this.name}-${Date.now()}`,
      sourceName: this.name,
      sourceType: this.type,
      url: data.url || '',
      title: (data.title || '').trim(),
      author: data.author || 'Unknown',
      publishedAt: data.publishedAt || new Date().toISOString(),
      content: (data.content || '').trim(),
      summary: (data.summary || '').trim(),
      language: data.language || 'vi',
      category: data.category || 'general',
      retrievedAt: new Date().toISOString()
    };
  }

  async canScrape(url) {
    const allowed = await checkRobotsTxt(url);
    if (!allowed) {
      logger.warn(`Bỏ qua URL vì robots.txt chặn: ${url}`);
    }
    return allowed;
  }
}

module.exports = { BaseAdapter };