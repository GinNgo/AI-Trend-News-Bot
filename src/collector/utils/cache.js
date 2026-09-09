const NodeCache = require('node-cache');
// Standard TTL: 24 hours for articles
const articleCache = new NodeCache({ stdTTL: 86400 });

module.exports = {
  get: (key) => articleCache.get(key),
  set: (key, value) => articleCache.set(key, value),
  has: (key) => articleCache.has(key),
  del: (key) => articleCache.del(key)
};