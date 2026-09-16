const { getDb } = require('../src/storage/db.js');
const db = getDb();

try {
  db.prepare("ALTER TABLE publications ADD COLUMN language TEXT DEFAULT 'vi'").run();
  console.log("✅ Added language column to publications");
} catch(e) {
  console.log("ℹ️ Language column info:", e.message);
}

const rows = db.prepare("SELECT publicationId, caption FROM publications WHERE caption LIKE '%__lang%'").all();
console.log(`Found ${rows.length} rows with __lang tag.`);

const updateStmt = db.prepare("UPDATE publications SET caption = ?, language = ? WHERE publicationId = ?");

for (const r of rows) {
  let lang = 'vi';
  const match = r.caption.match(/__lang:([a-z]+)__/i);
  if (match) lang = match[1];
  const cleanCaption = r.caption.replace(/__lang:[a-z]+__/gi, '').trim();
  updateStmt.run(cleanCaption, lang, r.publicationId);
}

console.log("✅ Cleaned all captions in publications table successfully!");
process.exit(0);
