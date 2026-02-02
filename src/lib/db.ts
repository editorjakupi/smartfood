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
    
    // Initialize Postgres tables (run once, ignore errors if exists)
    ;(async () => {
      try {
        await db.query(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `)
        await db.query(`
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
        await db.query(`
          CREATE INDEX IF NOT EXISTS idx_food_history_user_id ON food_history(user_id);
        `).catch(() => {})
        await db.query(`
          CREATE INDEX IF NOT EXISTS idx_food_history_date ON food_history(date);
        `).catch(() => {})
        try {
          await db.query(`ALTER TABLE food_history ADD COLUMN meal_type TEXT;`)
        } catch (_) {}
        await db.query(`
          CREATE TABLE IF NOT EXISTS user_settings (
            user_id TEXT PRIMARY KEY,
            daily_calories_goal REAL,
            daily_protein_goal REAL,
            water_glasses INTEGER DEFAULT 0,
            water_date DATE,
            current_weight_kg REAL,
            target_weight_kg REAL,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `).catch(() => {})
        try { await db.query(`ALTER TABLE user_settings ADD COLUMN current_weight_kg REAL;`) } catch (_) {}
        try { await db.query(`ALTER TABLE user_settings ADD COLUMN target_weight_kg REAL;`) } catch (_) {}
        try { await db.query(`ALTER TABLE user_settings ADD COLUMN daily_fat_goal REAL;`) } catch (_) {}
        try { await db.query(`ALTER TABLE user_settings ADD COLUMN daily_carbs_goal REAL;`) } catch (_) {}
        await db.query(`
          CREATE TABLE IF NOT EXISTS daily_goal_logs (
            user_id TEXT NOT NULL,
            log_date DATE NOT NULL,
            calories_goal REAL,
            protein_goal REAL,
            fat_goal REAL,
            carbs_goal REAL,
            PRIMARY KEY (user_id, log_date)
          );
        `).catch(() => {})
        await db.query(`
          CREATE TABLE IF NOT EXISTS favorites (
            id SERIAL PRIMARY KEY,
            user_id TEXT NOT NULL,
            food_class TEXT NOT NULL,
            calories REAL DEFAULT 0,
            protein REAL DEFAULT 0,
            carbs REAL DEFAULT 0,
            fat REAL DEFAULT 0,
            fiber REAL DEFAULT 0
          );
        `).catch(() => {})
      } catch (error) {
        // Tables might already exist, ignore
        console.log('Postgres tables initialization:', error)
      }
    })()
  } catch (error) {
    console.error('Failed to load pg module. Make sure to run: npm install', error)
    // Fallback to SQLite if pg is not available
    dbType = 'sqlite'
  }
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
  try {
    db.exec(`ALTER TABLE food_history ADD COLUMN meal_type TEXT;`)
  } catch (_) {}
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_settings (
      user_id TEXT PRIMARY KEY,
      daily_calories_goal REAL,
      daily_protein_goal REAL,
      water_glasses INTEGER DEFAULT 0,
      water_date TEXT,
      current_weight_kg REAL,
      target_weight_kg REAL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      food_class TEXT NOT NULL,
      calories REAL DEFAULT 0,
      protein REAL DEFAULT 0,
      carbs REAL DEFAULT 0,
      fat REAL DEFAULT 0,
      fiber REAL DEFAULT 0
    );
  `)
  try { db.exec(`ALTER TABLE user_settings ADD COLUMN current_weight_kg REAL;`) } catch (_) {}
  try { db.exec(`ALTER TABLE user_settings ADD COLUMN target_weight_kg REAL;`) } catch (_) {}
  try { db.exec(`ALTER TABLE user_settings ADD COLUMN daily_fat_goal REAL;`) } catch (_) {}
  try { db.exec(`ALTER TABLE user_settings ADD COLUMN daily_carbs_goal REAL;`) } catch (_) {}
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_goal_logs (
      user_id TEXT NOT NULL,
      log_date TEXT NOT NULL,
      calories_goal REAL,
      protein_goal REAL,
      fat_goal REAL,
      carbs_goal REAL,
      PRIMARY KEY (user_id, log_date)
    );
  `)
}

// Database operations (works with both Postgres and SQLite)
export const dbOperations = {
  // User operations
  async userExists(userId: string): Promise<boolean> {
    if (dbType === 'postgres') {
      const result = await db.query('SELECT 1 FROM users WHERE id = $1 LIMIT 1', [userId])
      return (result.rows?.length ?? 0) > 0
    } else {
      const stmt = db.prepare('SELECT 1 FROM users WHERE id = ? LIMIT 1')
      const row = stmt.get(userId)
      return !!row
    }
  },

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
    meal_type?: string | null
  }): Promise<number> {
    const mealType = entry.meal_type ?? null
    if (dbType === 'postgres') {
      const result = await db.query(`
        INSERT INTO food_history 
        (user_id, date, food_class, calories, protein, carbs, fat, fiber, confidence, meal_type)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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
        entry.confidence,
        mealType
      ])
      return result.rows[0].id
    } else {
      const stmt = db.prepare(`
        INSERT INTO food_history 
        (user_id, date, food_class, calories, protein, carbs, fat, fiber, confidence, meal_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        entry.confidence,
        mealType
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
    meal_type: string | null
  }>> {
    if (dbType === 'postgres') {
      const result = await db.query(`
        SELECT id, date, food_class, calories, protein, carbs, fat, fiber, confidence, meal_type
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
        confidence: r.confidence,
        meal_type: r.meal_type ?? null
      }))
    } else {
      const stmt = db.prepare(`
        SELECT id, date, food_class, calories, protein, carbs, fat, fiber, confidence, meal_type
        FROM food_history
        WHERE user_id = ?
        ORDER BY date DESC
      `)
      const rows = stmt.all(userId) as any[]
      return rows.map(r => ({
        ...r,
        meal_type: r.meal_type ?? null
      }))
    }
  },

  async updateFoodEntry(entryId: number, userId: string, entry: {
    date?: string
    food_class?: string
    calories?: number
    protein?: number
    carbs?: number
    fat?: number
    fiber?: number
    confidence?: number
    meal_type?: string | null
  }): Promise<boolean> {
    const mealType = entry.meal_type !== undefined ? entry.meal_type : null
    if (dbType === 'postgres') {
      const result = await db.query(`
        UPDATE food_history SET
          date = COALESCE($3::timestamp, date),
          food_class = COALESCE($4, food_class),
          calories = COALESCE($5, calories),
          protein = COALESCE($6, protein),
          carbs = COALESCE($7, carbs),
          fat = COALESCE($8, fat),
          fiber = COALESCE($9, fiber),
          confidence = COALESCE($10, confidence),
          meal_type = $11
        WHERE id = $1 AND user_id = $2
      `, [
        entryId,
        userId,
        entry.date ?? null,
        entry.food_class ?? null,
        entry.calories ?? null,
        entry.protein ?? null,
        entry.carbs ?? null,
        entry.fat ?? null,
        entry.fiber ?? null,
        entry.confidence ?? null,
        mealType
      ])
      return (result.rowCount ?? 0) > 0
    } else {
      const stmt = db.prepare(`
        UPDATE food_history SET
          date = COALESCE(?, date),
          food_class = COALESCE(?, food_class),
          calories = COALESCE(?, calories),
          protein = COALESCE(?, protein),
          carbs = COALESCE(?, carbs),
          fat = COALESCE(?, fat),
          fiber = COALESCE(?, fiber),
          confidence = COALESCE(?, confidence),
          meal_type = ?
        WHERE id = ? AND user_id = ?
      `)
      const result = stmt.run(
        entry.date ?? null,
        entry.food_class ?? null,
        entry.calories ?? null,
        entry.protein ?? null,
        entry.carbs ?? null,
        entry.fat ?? null,
        entry.fiber ?? null,
        entry.confidence ?? null,
        mealType,
        entryId,
        userId
      )
      return result.changes > 0
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
  },

  /** Permanently delete all data for a user (history + user row). Cannot be undone. */
  async deleteUserData(userId: string): Promise<boolean> {
    if (dbType === 'postgres') {
      await db.query('DELETE FROM food_history WHERE user_id = $1', [userId])
      await db.query('DELETE FROM user_settings WHERE user_id = $1', [userId]).catch(() => {})
      await db.query('DELETE FROM favorites WHERE user_id = $1', [userId]).catch(() => {})
      const userResult = await db.query('DELETE FROM users WHERE id = $1', [userId])
      return (userResult.rowCount ?? 0) > 0
    } else {
      db.prepare('DELETE FROM food_history WHERE user_id = ?').run(userId)
      db.prepare('DELETE FROM user_settings WHERE user_id = ?').run(userId)
      db.prepare('DELETE FROM favorites WHERE user_id = ?').run(userId)
      const stmt = db.prepare('DELETE FROM users WHERE id = ?')
      const result = stmt.run(userId)
      return result.changes > 0
    }
  },

  // User settings (goals, water)
  async getUserSettings(userId: string): Promise<{
    daily_calories_goal: number | null
    daily_protein_goal: number | null
    daily_fat_goal: number | null
    daily_carbs_goal: number | null
    water_glasses: number
    water_date: string | null
    current_weight_kg: number | null
    target_weight_kg: number | null
  }> {
    const today = new Date().toISOString().slice(0, 10)
    const defaults = {
      daily_calories_goal: null as number | null,
      daily_protein_goal: null as number | null,
      daily_fat_goal: null as number | null,
      daily_carbs_goal: null as number | null,
      water_glasses: 0,
      water_date: null as string | null,
      current_weight_kg: null as number | null,
      target_weight_kg: null as number | null
    }
    if (dbType === 'postgres') {
      const result = await db.query(
        'SELECT daily_calories_goal, daily_protein_goal, daily_fat_goal, daily_carbs_goal, water_glasses, water_date, current_weight_kg, target_weight_kg FROM user_settings WHERE user_id = $1',
        [userId]
      ).catch(() => ({ rows: [] }))
      const r = result.rows?.[0]
      if (!r) return { ...defaults }
      const waterDate = r.water_date instanceof Date ? r.water_date.toISOString().slice(0, 10) : r.water_date
      const waterGlasses = (waterDate === today ? (r.water_glasses ?? 0) : 0) as number
      return {
        daily_calories_goal: r.daily_calories_goal ?? null,
        daily_protein_goal: r.daily_protein_goal ?? null,
        daily_fat_goal: r.daily_fat_goal ?? null,
        daily_carbs_goal: r.daily_carbs_goal ?? null,
        water_glasses: waterGlasses,
        water_date: waterDate ?? null,
        current_weight_kg: r.current_weight_kg ?? null,
        target_weight_kg: r.target_weight_kg ?? null
      }
    } else {
      const stmt = db.prepare('SELECT daily_calories_goal, daily_protein_goal, daily_fat_goal, daily_carbs_goal, water_glasses, water_date, current_weight_kg, target_weight_kg FROM user_settings WHERE user_id = ?')
      const r = stmt.get(userId) as any
      if (!r) return { ...defaults }
      const waterDate = r.water_date ? String(r.water_date).slice(0, 10) : null
      const waterGlasses = waterDate === today ? (r.water_glasses ?? 0) : 0
      return {
        daily_calories_goal: r.daily_calories_goal ?? null,
        daily_protein_goal: r.daily_protein_goal ?? null,
        daily_fat_goal: r.daily_fat_goal ?? null,
        daily_carbs_goal: r.daily_carbs_goal ?? null,
        water_glasses: waterGlasses,
        water_date: waterDate ?? null,
        current_weight_kg: r.current_weight_kg ?? null,
        target_weight_kg: r.target_weight_kg ?? null
      }
    }
  },

  async setUserSettings(userId: string, settings: {
    daily_calories_goal?: number | null
    daily_protein_goal?: number | null
    daily_fat_goal?: number | null
    daily_carbs_goal?: number | null
    water_glasses?: number
    current_weight_kg?: number | null
    target_weight_kg?: number | null
  }): Promise<void> {
    const today = new Date().toISOString().slice(0, 10)
    if (dbType === 'postgres') {
      const current = await this.getUserSettings(userId)
      const calories = settings.daily_calories_goal !== undefined ? settings.daily_calories_goal : current.daily_calories_goal
      const protein = settings.daily_protein_goal !== undefined ? settings.daily_protein_goal : current.daily_protein_goal
      const fat = settings.daily_fat_goal !== undefined ? settings.daily_fat_goal : current.daily_fat_goal
      const carbs = settings.daily_carbs_goal !== undefined ? settings.daily_carbs_goal : current.daily_carbs_goal
      const water = settings.water_glasses !== undefined ? settings.water_glasses : current.water_glasses
      const cw = settings.current_weight_kg !== undefined ? settings.current_weight_kg : current.current_weight_kg
      const tw = settings.target_weight_kg !== undefined ? settings.target_weight_kg : current.target_weight_kg
      await db.query(`
        INSERT INTO user_settings (user_id, daily_calories_goal, daily_protein_goal, daily_fat_goal, daily_carbs_goal, water_glasses, water_date, current_weight_kg, target_weight_kg, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
          daily_calories_goal = COALESCE($2, user_settings.daily_calories_goal),
          daily_protein_goal = COALESCE($3, user_settings.daily_protein_goal),
          daily_fat_goal = COALESCE($4, user_settings.daily_fat_goal),
          daily_carbs_goal = COALESCE($5, user_settings.daily_carbs_goal),
          water_glasses = CASE WHEN $7::date = user_settings.water_date THEN COALESCE($6, user_settings.water_glasses) ELSE COALESCE($6, 0) END,
          water_date = COALESCE($7::date, user_settings.water_date),
          current_weight_kg = COALESCE($8, user_settings.current_weight_kg),
          target_weight_kg = COALESCE($9, user_settings.target_weight_kg),
          updated_at = NOW()
      `, [
        userId,
        calories ?? null,
        protein ?? null,
        fat ?? null,
        carbs ?? null,
        water ?? 0,
        today,
        cw ?? null,
        tw ?? null
      ])
    } else {
      const existing = db.prepare('SELECT daily_calories_goal, daily_protein_goal, daily_fat_goal, daily_carbs_goal, water_glasses, water_date, current_weight_kg, target_weight_kg FROM user_settings WHERE user_id = ?').get(userId) as any
      const todayStr = today
      const calories = settings.daily_calories_goal !== undefined ? settings.daily_calories_goal : (existing?.daily_calories_goal ?? null)
      const protein = settings.daily_protein_goal !== undefined ? settings.daily_protein_goal : (existing?.daily_protein_goal ?? null)
      const fat = settings.daily_fat_goal !== undefined ? settings.daily_fat_goal : (existing?.daily_fat_goal ?? null)
      const carbs = settings.daily_carbs_goal !== undefined ? settings.daily_carbs_goal : (existing?.daily_carbs_goal ?? null)
      let water = settings.water_glasses
      if (water === undefined && existing) {
        const prevDate = existing.water_date ? String(existing.water_date).slice(0, 10) : null
        water = prevDate === todayStr ? (existing.water_glasses ?? 0) : 0
      } else {
        water = water ?? 0
      }
      const cw = settings.current_weight_kg !== undefined ? settings.current_weight_kg : (existing?.current_weight_kg ?? null)
      const tw = settings.target_weight_kg !== undefined ? settings.target_weight_kg : (existing?.target_weight_kg ?? null)
      db.prepare(`
        INSERT INTO user_settings (user_id, daily_calories_goal, daily_protein_goal, daily_fat_goal, daily_carbs_goal, water_glasses, water_date, current_weight_kg, target_weight_kg, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT (user_id) DO UPDATE SET
          daily_calories_goal = excluded.daily_calories_goal,
          daily_protein_goal = excluded.daily_protein_goal,
          daily_fat_goal = excluded.daily_fat_goal,
          daily_carbs_goal = excluded.daily_carbs_goal,
          water_glasses = excluded.water_glasses,
          water_date = excluded.water_date,
          current_weight_kg = excluded.current_weight_kg,
          target_weight_kg = excluded.target_weight_kg,
          updated_at = datetime('now')
      `).run(userId, calories, protein, fat, carbs, water, todayStr, cw, tw)
    }
  },

  async addWater(userId: string): Promise<number> {
    const today = new Date().toISOString().slice(0, 10)
    const cur = await this.getUserSettings(userId)
    const newGlasses = cur.water_glasses + 1
    await this.setUserSettings(userId, { water_glasses: newGlasses })
    return newGlasses
  },

  /** Save today's goals as a daily log (for history). Called when user saves settings. */
  async saveDailyGoalLog(userId: string, date: string, goals: { calories?: number | null; protein?: number | null; fat?: number | null; carbs?: number | null }): Promise<void> {
    const logDate = date.slice(0, 10)
    const calories = goals.calories ?? null
    const protein = goals.protein ?? null
    const fat = goals.fat ?? null
    const carbs = goals.carbs ?? null
    if (dbType === 'postgres') {
      await db.query(`
        INSERT INTO daily_goal_logs (user_id, log_date, calories_goal, protein_goal, fat_goal, carbs_goal)
        VALUES ($1, $2::date, $3, $4, $5, $6)
        ON CONFLICT (user_id, log_date) DO UPDATE SET
          calories_goal = EXCLUDED.calories_goal,
          protein_goal = EXCLUDED.protein_goal,
          fat_goal = EXCLUDED.fat_goal,
          carbs_goal = EXCLUDED.carbs_goal
      `, [userId, logDate, calories, protein, fat, carbs])
    } else {
      db.prepare(`
        INSERT INTO daily_goal_logs (user_id, log_date, calories_goal, protein_goal, fat_goal, carbs_goal)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (user_id, log_date) DO UPDATE SET
          calories_goal = excluded.calories_goal,
          protein_goal = excluded.protein_goal,
          fat_goal = excluded.fat_goal,
          carbs_goal = excluded.carbs_goal
      `).run(userId, logDate, calories, protein, fat, carbs)
    }
  },

  // Favorites
  async getFavorites(userId: string): Promise<Array<{ id: number; food_class: string; calories: number; protein: number; carbs: number; fat: number; fiber: number }>> {
    if (dbType === 'postgres') {
      const result = await db.query(
        'SELECT id, food_class, calories, protein, carbs, fat, fiber FROM favorites WHERE user_id = $1 ORDER BY id DESC',
        [userId]
      ).catch(() => ({ rows: [] }))
      return result.rows ?? []
    } else {
      return (db.prepare('SELECT id, food_class, calories, protein, carbs, fat, fiber FROM favorites WHERE user_id = ? ORDER BY id DESC').all(userId) as any[]) ?? []
    }
  },

  async addFavorite(userId: string, entry: { food_class: string; calories: number; protein: number; carbs: number; fat: number; fiber: number }): Promise<number> {
    if (dbType === 'postgres') {
      const result = await db.query(
        `INSERT INTO favorites (user_id, food_class, calories, protein, carbs, fat, fiber) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [userId, entry.food_class, entry.calories, entry.protein, entry.carbs, entry.fat, entry.fiber]
      )
      return result.rows[0].id
    } else {
      const result = db.prepare(
        'INSERT INTO favorites (user_id, food_class, calories, protein, carbs, fat, fiber) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(userId, entry.food_class, entry.calories, entry.protein, entry.carbs, entry.fat, entry.fiber)
      return result.lastInsertRowid as number
    }
  },

  async removeFavorite(id: number, userId: string): Promise<boolean> {
    if (dbType === 'postgres') {
      const result = await db.query('DELETE FROM favorites WHERE id = $1 AND user_id = $2', [id, userId])
      return (result.rowCount ?? 0) > 0
    } else {
      const result = db.prepare('DELETE FROM favorites WHERE id = ? AND user_id = ?').run(id, userId)
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
