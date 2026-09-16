const { getDb } = require('../src/storage/db.js');
const db = getDb();

try {
  db.prepare("ALTER TABLE publications ADD COLUMN channelId TEXT DEFAULT 'channel_domestic'").run();
  console.log("✅ Added channelId column to publications");
} catch(e) {
  console.log("ℹ️ channelId column status:", e.message);
}

// Kiểm tra danh sách cột
const tableInfo = db.prepare("PRAGMA table_info(publications)").all();
console.log("Publications columns:", tableInfo.map(c => c.name).join(', '));
process.exit(0);
