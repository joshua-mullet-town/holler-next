/**
 * 🗄️ SQLite Database Manager
 * 
 * Manages SQLite database operations for Holler sessions and correlations.
 * Includes migration functionality to import data from legacy JSON files.
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

class HollerDatabase {
  constructor() {
    this.dbPath = '/Users/joshuamullet/code/holler/holler.db';
    this.db = null;

    this.initializeDatabase();
  }

  /**
   * Initialize database connection and create tables
   */
  initializeDatabase() {
    try {
      console.log('🗄️ Initializing SQLite database...');
      this.db = new Database(this.dbPath);

      // Enable WAL mode for better concurrency
      this.db.exec('PRAGMA journal_mode = WAL');
      this.db.exec('PRAGMA synchronous = NORMAL');
      this.db.exec('PRAGMA foreign_keys = ON');

      this.createTables();
      this.migrateExistingData();

      console.log('✅ SQLite-only database initialized successfully');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Create database tables and handle schema migrations
   */
  createTables() {
    // First create tables with original schema if they don't exist
    const createBasicTablesSQL = `
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created TEXT NOT NULL,
        terminal_id TEXT NOT NULL,
        claude_session_id TEXT,
        plan TEXT,
        jarvis_mode BOOLEAN DEFAULT FALSE,
        mode TEXT
      );

      CREATE TABLE IF NOT EXISTS metadata (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `;

    this.db.exec(createBasicTablesSQL);

    // Check if we need to add new columns
    const sessionTableInfo = this.db.prepare("PRAGMA table_info(sessions)").all();
    const hasLastUuid = sessionTableInfo.some(col => col.name === 'last_uuid');
    const hasCorrelationUpdatedAt = sessionTableInfo.some(col => col.name === 'correlation_updated_at');
    const hasClaudePid = sessionTableInfo.some(col => col.name === 'claude_pid');
    const hasLastCpuTime = sessionTableInfo.some(col => col.name === 'last_cpu_time');
    const hasLastCpuTimeCheck = sessionTableInfo.some(col => col.name === 'last_cpu_time_check');
    const hasLastCpuTimeGrowth = sessionTableInfo.some(col => col.name === 'last_cpu_time_growth');

    if (!hasLastUuid || !hasCorrelationUpdatedAt || !hasClaudePid || !hasLastCpuTime || !hasLastCpuTimeCheck || !hasLastCpuTimeGrowth) {
      console.log('📋 Migrating sessions table to latest schema...');

      // Add new columns for unified correlation tracking
      if (!hasLastUuid) {
        this.db.exec('ALTER TABLE sessions ADD COLUMN last_uuid TEXT');
        console.log('✅ Added last_uuid column');
      }

      if (!hasCorrelationUpdatedAt) {
        this.db.exec('ALTER TABLE sessions ADD COLUMN correlation_updated_at TEXT');
        console.log('✅ Added correlation_updated_at column');
      }

      // Add new column for Claude Code PID tracking
      if (!hasClaudePid) {
        this.db.exec('ALTER TABLE sessions ADD COLUMN claude_pid TEXT');
        console.log('✅ Added claude_pid column for execution monitoring');
      }

      // Add CPU time tracking columns for execution completion detection
      if (!hasLastCpuTime) {
        this.db.exec('ALTER TABLE sessions ADD COLUMN last_cpu_time REAL DEFAULT 0');
        console.log('✅ Added last_cpu_time column for CPU time monitoring');
      }

      if (!hasLastCpuTimeCheck) {
        this.db.exec('ALTER TABLE sessions ADD COLUMN last_cpu_time_check INTEGER DEFAULT 0');
        console.log('✅ Added last_cpu_time_check column for timing debugging');
      }

      if (!hasLastCpuTimeGrowth) {
        this.db.exec('ALTER TABLE sessions ADD COLUMN last_cpu_time_growth REAL DEFAULT 0');
        console.log('✅ Added last_cpu_time_growth column for activity debugging');
      }
    }

    // Create indexes
    const createIndexesSQL = `
      CREATE INDEX IF NOT EXISTS idx_sessions_claude_id ON sessions(claude_session_id);
      CREATE INDEX IF NOT EXISTS idx_sessions_jarvis_mode ON sessions(jarvis_mode);
      CREATE INDEX IF NOT EXISTS idx_sessions_last_uuid ON sessions(last_uuid);
    `;

    this.db.exec(createIndexesSQL);
    console.log('📋 Database tables created/migrated successfully');
  }

  /**
   * No migration needed - pure SQLite mode
   */
  migrateExistingData() {
    // Migration removed - pure SQLite mode
    console.log('🗄️ SQLite-only mode - no migration needed');
  }


  /**
   * SESSION OPERATIONS
   */

  getAllSessions() {
    const query = this.db.prepare('SELECT * FROM sessions ORDER BY created DESC');
    return query.all().map(this.convertSessionFromDb);
  }

  getSession(sessionId) {
    const query = this.db.prepare('SELECT * FROM sessions WHERE id = ?');
    const result = query.get(sessionId);
    return result ? this.convertSessionFromDb(result) : null;
  }

  createSession(session) {
    const insert = this.db.prepare(`
      INSERT INTO sessions (id, name, created, terminal_id, claude_session_id, plan, jarvis_mode, mode, last_uuid, correlation_updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insert.run(
      session.id,
      session.name,
      session.created,
      session.terminalId,
      session.claudeSessionId || null,
      session.plan || null,
      session.jarvisMode ? 1 : 0, // Convert boolean to integer for SQLite
      session.mode || null,
      null, // lastUuid starts as null
      null  // correlation_updated_at starts as null
    );

    console.log(`🗄️ SQLite: Created session ${session.id}`);
    return session;
  }

  updateSession(sessionId, updates) {
    const fields = [];
    const values = [];

    if (updates.claudeSessionId !== undefined) {
      fields.push('claude_session_id = ?');
      values.push(updates.claudeSessionId);
    }
    if (updates.plan !== undefined) {
      fields.push('plan = ?');
      values.push(updates.plan);
    }
    if (updates.jarvisMode !== undefined) {
      fields.push('jarvis_mode = ?');
      values.push(updates.jarvisMode ? 1 : 0); // Convert boolean to integer
    }
    if (updates.mode !== undefined) {
      fields.push('mode = ?');
      values.push(updates.mode);
    }
    if (updates.lastUuid !== undefined) {
      fields.push('last_uuid = ?');
      values.push(updates.lastUuid);
      fields.push('correlation_updated_at = ?');
      values.push(new Date().toISOString());
    }
    if (updates.claudePid !== undefined) {
      fields.push('claude_pid = ?');
      values.push(updates.claudePid);
    }
    if (updates.lastCpuTime !== undefined) {
      fields.push('last_cpu_time = ?');
      values.push(updates.lastCpuTime);
    }
    if (updates.lastCpuTimeCheck !== undefined) {
      fields.push('last_cpu_time_check = ?');
      values.push(updates.lastCpuTimeCheck);
    }
    if (updates.lastCpuTimeGrowth !== undefined) {
      fields.push('last_cpu_time_growth = ?');
      values.push(updates.lastCpuTimeGrowth);
    }

    if (fields.length === 0) return false;

    values.push(sessionId);
    const query = `UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`;
    const result = this.db.prepare(query).run(...values);

    return result.changes > 0;
  }

  deleteSession(sessionId) {
    const deleteSession = this.db.prepare('DELETE FROM sessions WHERE id = ?');
    const result = deleteSession.run(sessionId);

    console.log(`🗄️ SQLite: Deleted session ${sessionId}`);
    return result.changes > 0;
  }

  /**
   * CORRELATION OPERATIONS (now unified with sessions)
   */

  getCorrelation(sessionId) {
    const query = this.db.prepare('SELECT last_uuid FROM sessions WHERE id = ?');
    const result = query.get(sessionId);
    return result?.last_uuid || null;
  }

  updateCorrelation(sessionId, lastUuid) {
    return this.updateSession(sessionId, { lastUuid });
  }

  findSessionByParentUuid(parentUuid) {
    const query = this.db.prepare('SELECT id FROM sessions WHERE last_uuid = ?');
    const result = query.get(parentUuid);
    return result?.id || null;
  }

  getAllCorrelations() {
    const query = this.db.prepare('SELECT id, last_uuid FROM sessions WHERE last_uuid IS NOT NULL');
    const results = query.all();

    const correlations = new Map();
    for (const row of results) {
      correlations.set(row.id, row.last_uuid);
    }
    return correlations;
  }

  /**
   * METADATA OPERATIONS
   */

  getMetadata(key) {
    const query = this.db.prepare('SELECT value FROM metadata WHERE key = ?');
    const result = query.get(key);
    return result?.value || null;
  }

  setMetadata(key, value) {
    const upsert = this.db.prepare(`
      INSERT INTO metadata (key, value) 
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET 
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `);

    upsert.run(key, value);
    console.log(`🗄️ SQLite: Set metadata ${key} = ${value}`);
    return true;
  }

  /**
   * UTILITY METHODS
   */

  convertSessionFromDb(dbRow) {
    return {
      id: dbRow.id,
      name: dbRow.name,
      created: dbRow.created,
      terminalId: dbRow.terminal_id,
      claudeSessionId: dbRow.claude_session_id,
      plan: dbRow.plan,
      jarvisMode: Boolean(dbRow.jarvis_mode),
      mode: dbRow.mode,
      lastUuid: dbRow.last_uuid,
      correlationUpdatedAt: dbRow.correlation_updated_at,
      claudePid: dbRow.claude_pid,
      lastCpuTime: dbRow.last_cpu_time,
      lastCpuTimeCheck: dbRow.last_cpu_time_check,
      lastCpuTimeGrowth: dbRow.last_cpu_time_growth
    };
  }

  getStats() {
    const sessionCount = this.db.prepare('SELECT COUNT(*) as count FROM sessions').get().count;
    const correlationCount = this.db.prepare('SELECT COUNT(*) as count FROM sessions WHERE last_uuid IS NOT NULL').get().count;

    return {
      sessions: sessionCount,
      correlations: correlationCount,
      databasePath: this.dbPath,
      mode: 'SQLite-only'
    };
  }


  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      console.log('🗄️ SQLite database connection closed');
    }
  }
}

module.exports = HollerDatabase;