const fs = require('fs');
const path = require('path');
const { getDb, closeDb } = require('../db.js');

const MIGRATIONS_DIR = path.join(process.cwd(), 'src', 'storage', 'migrations');

function runMigrations() {
  const db = getDb();

  // Create migrations table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const executedMigrations = new Set(
    db.prepare(`SELECT name FROM migrations`).all().map(row => row.name)
  );

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (!executedMigrations.has(file)) {
      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');

      const transaction = db.transaction(() => {
        db.exec(sql);
        db.prepare(`INSERT INTO migrations (name) VALUES (?)`).run(file);
      });

      transaction();
      console.log(`Migration ${file} completed successfully.`);
    }
  }

  console.log('All migrations are up to date.');
  closeDb();
}

runMigrations();
