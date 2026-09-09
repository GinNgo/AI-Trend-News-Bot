const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, '../../../collector.log');

function log(level, message, meta = {}) {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
  const logMsg = `[${timestamp}] [${level.toUpperCase()}] ${message} ${metaStr}\n`;

  if (level === 'error') {
    console.error(logMsg.trim());
  } else {
    console.log(logMsg.trim());
  }

  fs.appendFileSync(logFile, logMsg);
}

module.exports = {
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
  debug: (msg, meta) => log('debug', msg, meta)
};