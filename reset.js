const db = require('better-sqlite3')('data/factory.db');
const info = db.prepare("UPDATE jobs SET status = 'PENDING', lockedBy = NULL, lockedAt = NULL WHERE status = 'PROCESSING'").run();
console.log(info.changes + " jobs reset to PENDING");
