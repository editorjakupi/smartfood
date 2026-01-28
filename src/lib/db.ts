// Neon Postgres Database (or any PostgreSQL)
// Uses pg (node-postgres) for production, falls back to SQLite for local development

let db: any
let dbType: 'postgres' | 'sqlite' = 'sqlite'

// Check if we're in production (Neon Postgres or any PostgreSQL)
if (process.env.POSTGRES_URL) {
  dbType = 'postgres'
  // Use standard PostgreSQL client (pg) for Neon compatibility
  // Dynamic import to avoid loading pg when using SQLite locally
  try {
    const { Pool } = require('pg')
    const pool = new Pool({
      connectionString: process.env.POSTGRES_URL,
      ssl: process.env.POSTGRES_URL.includes('localhost') ? false : { rejectUnauthorized: false }
    })
    db = pool
  } catch (error) {
    console.error('Failed to load pg module. Make sure to run: npm install', error)
    // Fallback to SQLite if pg is not available
    dbType = 'sqlite'
  }
  
  // Initialize Postgres tables (run once, ignore errors if exists)
  ;(async () => {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `)
      await pool.query(`
        CREATE TABLE IF NOT EXISTS food_history (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          date TIMESTAMP NOT NULL,
          food_class TEXT NOT NULL,
          calories REAL DEFAULT 0,
          protein REAL DEFAULT 0,
          carbs REAL DEFAULT 0,
          fat REAL DEFAULT 0,
          fiber REAL DEFAULT 0,
          confidence REAL DEFAULT 0,
          FOREIGN KEY (user_id) REFERENCES users(id)
        );
      `)
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_food_history_user_id ON food_history(user_id);
      `).catch(() => {})
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_food_history_date ON food_history(date);
      `).catch(() => {})
    } catch (error) {
      // Tables might already exist, ignore
      console.log('Postgres tables initialization:', error)
    }
  })()
} else {
  // Local development: Use SQLite
  const Database = require('better-sqlite3')
  const path = require('path')
  const fs = require('fs')
  
  const DB_PATH = path.join(process.cwd(), 'smartfood.db')
  const dbDir = path.dirname(DB_PATH)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }
  
  db = new Database(DB_PATH)
  db.pragma('foreign_keys = ON')
  
  // Create tables for SQLite
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS food_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      date DATETIME NOT NULL,
      food_class TEXT NOT NULL,
      calories REAL DEFAULT 0,
      protein REAL DEFAULT 0,
      carbs REAL DEFAULT 0,
      fat REAL DEFAULT 0,
      fiber REAL DEFAULT 0,
      confidence REAL DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_food_history_user_id ON food_history(user_id);
    CREATE INDEX IF NOT EXISTS idx_food_history_date ON food_history(date);
  `)
}

// Database operations (works with both Postgres and SQLite)
export const dbOperations = {
  // User operations
  async getOrCreateUser(userId: string): Promise<string> {
    if (dbType === 'postgres') {
      await db.query('INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO NOTHING', [userId])
      return userId
    } else {
      const stmt = db.prepare('INSERT OR IGNORE INTO users (id) VALUES (?)')
      stmt.run(userId)
      return userId
    }
  },

  // Food history operations
  async addFoodEntry(entry: {
    user_id: string
    date: string
    food_class: string
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber: number
    confidence: number
  }): Promise<number> {
    if (dbType === 'postgres') {
      const result = await db.query(`
        INSERT INTO food_history 
        (user_id, date, food_class, calories, protein, carbs, fat, fiber, confidence)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `, [
        entry.user_id,
        entry.date,
        entry.food_class,
        entry.calories,
        entry.protein,
        entry.carbs,
        entry.fat,
        entry.fiber,
        entry.confidence
      ])
      return result.rows[0].id
    } else {
      const stmt = db.prepare(`
        INSERT INTO food_history 
        (user_id, date, food_class, calories, protein, carbs, fat, fiber, confidence)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      const result = stmt.run(
        entry.user_id,
        entry.date,
        entry.food_class,
        entry.calories,
        entry.protein,
        entry.carbs,
        entry.fat,
        entry.fiber,
        entry.confidence
      )
      return result.lastInsertRowid as number
    }
  },

  async getUserHistory(userId: string): Promise<Array<{
    id: number
    date: string
    food_class: string
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber: number
    confidence: number
  }>> {
    if (dbType === 'postgres') {
      const result = await db.query(`
        SELECT id, date, food_class, calories, protein, carbs, fat, fiber, confidence
        FROM food_history
        WHERE user_id = $1
        ORDER BY date DESC
      `, [userId])
      return result.rows.map((r: any) => ({
        id: r.id,
        date: r.date instanceof Date ? r.date.toISOString() : r.date,
        food_class: r.food_class,
        calories: r.calories,
        protein: r.protein,
        carbs: r.carbs,
        fat: r.fat,
        fiber: r.fiber,
        confidence: r.confidence
      }))
    } else {
      const stmt = db.prepare(`
        SELECT id, date, food_class, calories, protein, carbs, fat, fiber, confidence
        FROM food_history
        WHERE user_id = ?
        ORDER BY date DESC
      `)
      return stmt.all(userId) as Array<{
        id: number
        date: string
        food_class: string
        calories: number
        protein: number
        carbs: number
        fat: number
        fiber: number
        confidence: number
      }>
    }
  },

  async deleteFoodEntry(entryId: number, userId: string): Promise<boolean> {
    if (dbType === 'postgres') {
      const result = await db.query(
        'DELETE FROM food_history WHERE id = $1 AND user_id = $2',
        [entryId, userId]
      )
      return result.rowCount > 0
    } else {
      const stmt = db.prepare('DELETE FROM food_history WHERE id = ? AND user_id = ?')
      const result = stmt.run(entryId, userId)
      return result.changes > 0
    }
  },

  async deleteUserHistory(userId: string): Promise<boolean> {
    if (dbType === 'postgres') {
      const result = await db.query(
        'DELETE FROM food_history WHERE user_id = $1',
        [userId]
      )
      return result.rowCount > 0
    } else {
      const stmt = db.prepare('DELETE FROM food_history WHERE user_id = ?')
      const result = stmt.run(userId)
      return result.changes > 0
    }
  }
}

// Close SQLite database on process exit (not needed for Postgres)
if (dbType === 'sqlite') {
  process.on('exit', () => {
    db.close()
  })

  process.on('SIGINT', () => {
    db.close()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    db.close()
    process.exit(0)
  })
}
