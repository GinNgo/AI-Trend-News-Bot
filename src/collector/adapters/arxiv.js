const axios = require('axios');
const xml2js = require('xml2js');
const { BaseAdapter } = require('./base');
const logger = require('../utils/logger');
const limiter = require('../utils/limiter');

class ArxivAdapter extends BaseAdapter {
  constructor() {
    super('arXiv', 'scientific_paper');
  }

  async collect(searchQuery, maxResults = 5) {
    try {
      logger.info(`Đang tìm kiếm bài báo trên arXiv với query: ${searchQuery}`);

      const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(searchQuery)}&start=0&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;

      const response = await limiter.schedule(() => axios.get(url, { timeout: 10000 }));

      const parser = new xml2js.Parser({ explicitArray: false });
      const result = await parser.parseStringPromise(response.data);

      const entries = result.feed.entry || [];
      const items = Array.isArray(entries) ? entries : [entries];

      const articles = items.map(item => {
        let authors = '';
        if (Array.isArray(item.author)) {
          authors = item.author.map(a => a.name).join(', ');
        } else if (item.author) {
          authors = item.author.name;
        }

        return this.normalize({
          sourceId: item.id,
          url: item.id,
          title: (item.title || '').replace(/\n/g, ' '),
          author: authors,
          publishedAt: item.published,
          summary: (item.summary || '').replace(/\n/g, ' '),
          content: (item.summary || '').replace(/\n/g, ' '), // Arxiv API doesn't give full text, summary is best we have
          category: item['arxiv:primary_category'] ? item['arxiv:primary_category'].$.term : 'science'
        });
      });

      logger.info(`Tìm thấy ${articles.length} bài báo từ arXiv`);
      return articles;
    } catch (error) {
      logger.error(`Lỗi khi lấy dữ liệu từ arXiv: ${error.message}`);
      throw error;
    }
  }
}

module.exports = { ArxivAdapter };