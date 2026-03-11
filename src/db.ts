import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.resolve(process.cwd(), 'data.db');
const db = new Database(dbPath);

// Initialize database schema
export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS decks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      deck_id TEXT NOT NULL,
      type TEXT NOT NULL, -- 'qa', 'cloze', 'image_occlusion'
      front TEXT,
      back TEXT,
      image_url TEXT,
      embedding TEXT, -- JSON array of floats
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS image_masks (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      x REAL NOT NULL,
      y REAL NOT NULL,
      width REAL NOT NULL,
      height REAL NOT NULL,
      text TEXT,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL,
      rating TEXT NOT NULL, -- 'again', 'hard', 'good', 'easy'
      review_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      next_review_date DATETIME,
      interval REAL,
      ease_factor REAL,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    );
  `);

  try {
    db.exec(`ALTER TABLE cards ADD COLUMN embedding TEXT;`);
  } catch (e) {
    // Column might already exist
  }
}

export default db;
