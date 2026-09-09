const axios = require('axios');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');
const { BaseAdapter } = require('./base');
const logger = require('../utils/logger');
const limiter = require('../utils/limiter');
const axiosRetry = require('axios-retry').default;

const client = axios.create({
  timeout: 15000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  },
  validateStatus: function (status) {
    return status >= 200 && status < 300; // Only resolve on 2xx
  }
});

axiosRetry(client, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.code === 'ECONNABORTED';
  }
});

class WebArticleAdapter extends BaseAdapter {
  constructor() {
    super('WebArticle', 'web_html');
  }

  async collect(url) {
    if (!(await this.canScrape(url))) {
      throw new Error('Robots.txt disallowed');
    }

    try {
      logger.info(`Đang trích xuất nội dung bài viết từ: ${url}`);

      const response = await limiter.schedule(() => client.get(url));
      const html = response.data;

      const doc = new JSDOM(html, { url });
      const reader = new Readability(doc.window.document);
      const article = reader.parse();

      if (!article || !article.textContent || article.textContent.length < 150) {
         throw new Error('Không thể trích xuất nội dung hoặc nội dung quá ngắn');
      }

      // Some sites return the homepage when a 404 happens (soft 404). Check title.
      if (article.title && article.title.toLowerCase().includes('404')) {
          throw new Error('Phát hiện Soft 404 qua tiêu đề trang.');
      }

      const normalized = this.normalize({
        url: url,
        title: article.title,
        author: article.byline,
        content: article.textContent.replace(/\s+/g, ' ').trim(),
        summary: article.excerpt
      });

      logger.info(`Trích xuất thành công bài viết: ${normalized.title.substring(0, 50)}...`);
      return normalized;
    } catch (error) {
      if (error.response && error.response.status === 404) {
          logger.error(`Lỗi 404 - Không tìm thấy bài viết tại ${url}`);
          throw new Error('Lỗi 404 - Article not found');
      }
      logger.error(`Lỗi trích xuất bài viết từ ${url}: ${error.message}`);
      throw error;
    }
  }
}

module.exports = { WebArticleAdapter };