const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Support custom DB directory for persistent disks (e.g. Render)
const dbDir = process.env.DB_DIR || __dirname;
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'medquiz.db');
const db = new Database(dbPath);

// Enable performance mode for high concurrency
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('mmap_size = 30000000000');
db.pragma('foreign_keys = ON');

// Create tables with user_id
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    color TEXT DEFAULT '#3b82f6',
    icon TEXT DEFAULT '📚',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS decks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    subject_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    deck_id INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    options TEXT NOT NULL DEFAULT '[]',
    correct_index INTEGER NOT NULL DEFAULT 0,
    explanation TEXT DEFAULT '',
    starred INTEGER DEFAULT 0,
    times_seen INTEGER DEFAULT 0,
    times_correct INTEGER DEFAULT 0,
    last_seen_at DATETIME,
    next_review_at DATETIME,
    ease_factor REAL DEFAULT 2.5,
    interval_days INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (deck_id) REFERENCES decks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS test_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    name TEXT DEFAULT 'Test Session',
    mode TEXT DEFAULT 'untimed',
    time_limit INTEGER DEFAULT 0,
    total_questions INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    wrong_count INTEGER DEFAULT 0,
    score_percent REAL DEFAULT 0,
    deck_ids TEXT DEFAULT '[]',
    subject_ids TEXT DEFAULT '[]',
    completed INTEGER DEFAULT 0,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS test_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    session_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    selected_index INTEGER DEFAULT -1,
    is_correct INTEGER DEFAULT 0,
    time_spent INTEGER DEFAULT 0,
    flagged INTEGER DEFAULT 0,
    answered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES test_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS user_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    question_id INTEGER NOT NULL,
    note_text TEXT DEFAULT '',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, question_id)
  );

  CREATE TABLE IF NOT EXISTS daily_activity_v2 (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL DEFAULT 1,
    date TEXT NOT NULL,
    questions_answered INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, date)
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    user_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    PRIMARY KEY (user_id, key),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Migration logic: smoothly add user_id column if it doesn't exist
const checkAndAddColumn = (table, column, defValue) => {
  try {
    const info = db.pragma(`table_info(${table})`);
    if (!info.some(c => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} INTEGER NOT NULL DEFAULT ${defValue}`);
      console.log(`Added ${column} to ${table}`);
    }
  } catch (e) {
    // Table might not exist or other error, safe to ignore
  }
};

const tablesToMigrate = ['subjects', 'decks', 'questions', 'test_sessions', 'test_answers'];
tablesToMigrate.forEach(table => checkAndAddColumn(table, 'user_id', 1));

// Note migration (drop old unique constraint if possible, but SQLite doesn't support it directly.
// We handle by renaming if needed, but since it's just user_notes, let's keep it simple.
// We already re-declared it with UNIQUE(user_id, question_id). But if user_notes existed without user_id,
// we need to add it.
checkAndAddColumn('user_notes', 'user_id', 1);

// Default settings migration to user_settings
try {
  const oldSettings = db.prepare('SELECT * FROM settings').all();
  if (oldSettings && oldSettings.length > 0) {
    const insertUserSetting = db.prepare('INSERT OR IGNORE INTO user_settings (user_id, key, value) VALUES (?, ?, ?)');
    const insertTx = db.transaction((settings) => {
      for (const s of settings) {
        insertUserSetting.run(1, s.key, s.value);
      }
    });
    insertTx(oldSettings);
    // Avoid migrating again
    db.exec('DROP TABLE IF EXISTS settings');
  }
} catch (e) { }

// Daily activity migration
try {
  const oldActivity = db.prepare('SELECT * FROM daily_activity').all();
  if (oldActivity && oldActivity.length > 0) {
    const insertActivity = db.prepare('INSERT OR IGNORE INTO daily_activity_v2 (user_id, date, questions_answered, correct_count) VALUES (?, ?, ?, ?)');
    const insertTx = db.transaction((activities) => {
      for (const a of activities) {
        insertActivity.run(1, a.date, a.questions_answered, a.correct_count);
      }
    });
    insertTx(oldActivity);
    db.exec('DROP TABLE IF EXISTS daily_activity');
  }
} catch (e) { }

module.exports = db;
