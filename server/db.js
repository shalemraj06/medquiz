const { Pool } = require('pg');

// DATABASE_URL is required for production (provided by Render/Supabase)
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('[FATAL] DATABASE_URL is not set. Please set it in your environment variables.');
  // We don't exit(1) here to allow the server to boot and report the error via /api/health
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000, // 10s timeout
  idleTimeoutMillis: 30000,
  max: 20 // Max pool size
});

// Explicitly log connection attempts
pool.on('connect', () => console.log('[DB] New client connected to PostgreSQL'));
pool.on('error', (err) => console.error('[DB] Unexpected error on idle client', err));

// Initialize database tables using PostgreSQL syntax
const initDb = async () => {
  try {
    // 1. Core Tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS subjects (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT DEFAULT '',
        color VARCHAR(50) DEFAULT '#3b82f6',
        icon VARCHAR(50) DEFAULT '📚',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS decks (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subject_id INTEGER NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS questions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        deck_id INTEGER NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
        question_text TEXT NOT NULL,
        options TEXT NOT NULL DEFAULT '[]',
        correct_index INTEGER NOT NULL DEFAULT 0,
        explanation TEXT DEFAULT '',
        starred INTEGER DEFAULT 0,
        times_seen INTEGER DEFAULT 0,
        times_correct INTEGER DEFAULT 0,
        last_seen_at TIMESTAMP,
        next_review_at TIMESTAMP,
        ease_factor REAL DEFAULT 2.5,
        interval_days INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS test_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name VARCHAR(255) DEFAULT 'Test Session',
        mode VARCHAR(50) DEFAULT 'untimed',
        time_limit INTEGER DEFAULT 0,
        total_questions INTEGER DEFAULT 0,
        correct_count INTEGER DEFAULT 0,
        wrong_count INTEGER DEFAULT 0,
        score_percent REAL DEFAULT 0,
        deck_ids TEXT DEFAULT '[]',
        subject_ids TEXT DEFAULT '[]',
        completed INTEGER DEFAULT 0,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS test_answers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id INTEGER NOT NULL REFERENCES test_sessions(id) ON DELETE CASCADE,
        question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        selected_index INTEGER DEFAULT -1,
        is_correct INTEGER DEFAULT 0,
        time_spent INTEGER DEFAULT 0,
        flagged INTEGER DEFAULT 0,
        answered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_notes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        note_text TEXT DEFAULT '',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, question_id)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_activity_v2 (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        questions_answered INTEGER DEFAULT 0,
        correct_count INTEGER DEFAULT 0,
        UNIQUE(user_id, date)
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        key VARCHAR(255) NOT NULL,
        value TEXT NOT NULL,
        PRIMARY KEY (user_id, key)
      )
    `);

    // 2. Schema Enforcement: Ensure daily_activity_v2 date is DATE type
    await pool.query(`
      DO $$ 
      BEGIN 
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_activity_v2' AND column_name='date' AND data_type='text') THEN
          ALTER TABLE daily_activity_v2 ALTER COLUMN date TYPE DATE USING date::DATE;
        END IF;
      END $$;
    `);

    // Quick probe to verify connection
    const probe = await pool.query('SELECT NOW() as now');
    console.log('[DB] Connection verified at:', probe.rows[0].now);
    console.log('PostgreSQL database initialized and schema enforced successfully.');
  } catch (err) {
    console.error('Error initializing PostgreSQL database:', err);
  }
};

initDb();

module.exports = {
  // Wrapper to make transitioning easier: we will export 'query' which acts like db in our routes
  query: (text, params) => pool.query(text, params),
  pool
};
