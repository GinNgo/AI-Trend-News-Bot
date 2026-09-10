const { getDb } = require('./src/storage/db.js');
const db = getDb();
console.log(JSON.stringify(db.prepare('SELECT * FROM renders').all(), null, 2));
