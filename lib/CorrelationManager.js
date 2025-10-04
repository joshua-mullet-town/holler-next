/**
 * 🔥 HOT PATH: Correlation Manager
 * 
 * Manages UUID correlation tracking using SQLite unified sessions table.
 * Handles high-frequency writes from every message correlation update.
 */

const HollerDatabase = require('./Database');

class CorrelationManager {
  constructor(sharedDb = null) {
    // 🗄️ SQLite-only: Use shared database instance or create new one
    this.db = sharedDb || new HollerDatabase();
    console.log('🗄️ CorrelationManager: SQLite-only mode initialized');
  }



  /**
   * Update UUID for a session (hot path operation)
   */
  updateLastUuid(sessionId, uuid) {
    if (!sessionId || !uuid) {
      console.warn('⚠️ Invalid correlation update:', { sessionId, uuid });
      return false;
    }

    const previousUuid = this.db.getCorrelation(sessionId);
    const updated = this.db.updateCorrelation(sessionId, uuid);

    if (updated) {
      return true;
    }

    console.warn('⚠️ Failed to update correlation in SQLite');
    return false;
  }

  /**
   * Get last UUID for a session
   */
  getLastUuid(sessionId) {
    return this.db.getCorrelation(sessionId);
  }

  /**
   * Find session by parent UUID (for correlation lookup)
   */
  findSessionByParentUuid(parentUuid) {
    return this.db.findSessionByParentUuid(parentUuid);
  }

  /**
   * Remove correlation for a session (cleanup)
   */
  removeCorrelation(sessionId) {
    // Clear last_uuid in the sessions table
    const updated = this.db.updateCorrelation(sessionId, null);
    if (updated) {
      console.log(`🗑️ Removed correlation for session ${sessionId}`);
      return true;
    }
    return false;
  }

  /**
   * Get all correlations (for debugging)
   */
  getAllCorrelations() {
    return this.db.getAllCorrelations();
  }

  /**
   * Get correlation stats
   */
  getStats() {
    const correlations = this.db.getAllCorrelations();
    return {
      totalCorrelations: correlations.size,
      storageType: 'SQLite (unified sessions table)'
    };
  }
}

module.exports = CorrelationManager;