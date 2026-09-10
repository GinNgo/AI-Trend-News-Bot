const fs = require('fs');
const path = require('path');

const ERROR_FILE = path.join(process.cwd(), 'data', 'last_error.json');

function recordError(context, err) {
  const errorPayload = {
    timestamp: new Date().toISOString(),
    context: context || 'Unknown',
    message: err?.message || String(err),
    stack: err?.stack || '',
    code: err?.code || null,
    status: 'UNRESOLVED'
  };

  try {
    const dir = path.dirname(ERROR_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ERROR_FILE, JSON.stringify(errorPayload, null, 2), 'utf-8');
    console.error(`\n🚨 [AUTO-ERROR-RECORDER] Đã lưu snapshot lỗi vào: data/last_error.json`);
    console.error(`👉 Bạn chỉ cần nhắn "fix lỗi vừa xảy ra", Claude sẽ đọc file này và tự động sửa code ngay lập tức!\n`);
  } catch (e) {
    console.error('Không thể ghi file last_error.json:', e);
  }
}

module.exports = { recordError };
