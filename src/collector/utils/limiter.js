const Bottleneck = require('bottleneck');

// Global rate limiter to avoid overwhelming servers
const globalLimiter = new Bottleneck({
  maxConcurrent: 3, // Max 3 concurrent requests
  minTime: 2000 // Minimum 2s between requests
});

module.exports = {
  schedule: (fn, ...args) => globalLimiter.schedule(fn, ...args)
};