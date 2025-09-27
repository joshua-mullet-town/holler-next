/**
 * Session Discovery Service
 * 
 * Implements Claudia's approach to Claude session correlation:
 * - Scans ~/.claude/projects/[holler-encoded]/ for JSONL files  
 * - Uses JSONL filename as session ID (Claude's real UUID)
 * - Extracts project path from first line "cwd" field
 * - Provides reliable session correlation without timing issues
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const os = require('os');

class SessionDiscoveryService {
  static claudeProjectsDir = path.join(os.homedir(), '.claude', 'projects', '-Users-joshuamullet-code');

  /**
   * Discovers all Claude sessions by scanning JSONL files
   * @returns {Promise<Array>} Array of discovered sessions with metadata
   */
  static async discoverSessions() {
    try {
      const sessions = [];
      
      // Check if Claude projects directory exists
      if (!fsSync.existsSync(this.claudeProjectsDir)) {
        console.log('⚠️ Claude projects directory not found:', this.claudeProjectsDir);
        return sessions;
      }

      const files = await fs.readdir(this.claudeProjectsDir);
      
      for (const file of files) {
        if (file.endsWith('.jsonl')) {
          const sessionId = file.replace('.jsonl', '');
          const filePath = path.join(this.claudeProjectsDir, file);
          
          try {
            // Get file stats for creation and modification time
            const stats = await fs.stat(filePath);
            const createdAt = stats.birthtime || stats.ctime;
            const modifiedAt = stats.mtime;
            
            // Extract project path and metadata from first user message
            const firstUserEntry = await this.extractFirstUserEntry(filePath);
            if (firstUserEntry) {
              // Extract last user message text for display (not first)
              const lastUserMessage = await this.extractLastUserMessage(filePath);
              
              // Count messages in the session
              const messageCount = await this.countMessages(filePath);
              
              sessions.push({
                sessionId,
                projectPath: firstUserEntry.cwd,
                version: firstUserEntry.version,
                createdAt: createdAt.getTime(),
                modifiedAt: modifiedAt.getTime(),
                timestamp: firstUserEntry.timestamp,
                filePath,
                lastMessage: lastUserMessage,
                fileSize: stats.size,
                messageCount
              });
            }
          } catch (error) {
            console.warn(`⚠️ Failed to process session file ${file}:`, error.message);
            // Continue processing other files
          }
        }
      }
      
      // Sort by modification time (most recently modified first) 
      sessions.sort((a, b) => b.modifiedAt - a.modifiedAt);
      
      console.log(`🔍 Discovered ${sessions.length} Claude sessions in ${this.claudeProjectsDir}`);
      
      // Debug: Show the 3 most recent sessions
      if (sessions.length > 0) {
        console.log(`📊 Most recent sessions:`);
        for (let i = 0; i < Math.min(3, sessions.length); i++) {
          const session = sessions[i];
          console.log(`  ${i + 1}. ${session.sessionId} - Modified: ${new Date(session.modifiedAt).toISOString()}`);
        }
      }
      
      return sessions;
      
    } catch (error) {
      console.error('❌ Session discovery failed:', error);
      return [];
    }
  }

  /**
   * Get a specific discovered session by ID
   * @param {string} sessionId - Claude session ID to find
   * @returns {Promise<Object|null>} Session object or null if not found
   */
  static async getSession(sessionId) {
    const sessions = await this.discoverSessions();
    return sessions.find(session => session.sessionId === sessionId) || null;
  }

  /**
   * Find the most recently created session
   * @returns {Promise<Object|null>} Most recent session or null
   */
  static async getMostRecentSession() {
    const sessions = await this.discoverSessions();
    return sessions.length > 0 ? sessions[0] : null;
  }

  /**
   * Check if a Claude session exists
   * @param {string} sessionId - Claude session ID to check
   * @returns {Promise<boolean>} True if session exists
   */
  static async sessionExists(sessionId) {
    const filePath = path.join(this.claudeProjectsDir, `${sessionId}.jsonl`);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get sessions created after a specific timestamp
   * @param {number} afterTimestamp - Timestamp to filter after
   * @returns {Promise<Array>} Sessions created after timestamp
   */
  static async getSessionsAfter(afterTimestamp) {
    const sessions = await this.discoverSessions();
    return sessions.filter(session => session.createdAt > afterTimestamp);
  }

  /**
   * Reads the first line of a JSONL file
   * @private
   * @param {string} filePath - Path to JSONL file
   * @returns {Promise<string|null>} First line content or null
   */
  static async readFirstLine(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const lines = data.trim().split('\n');
      return lines.length > 0 ? lines[0] : null;
    } catch (error) {
      console.warn(`⚠️ Failed to read first line of ${filePath}:`, error.message);
      return null;
    }
  }

  /**
   * Extracts the first user entry (full object) from a JSONL file
   * @private  
   * @param {string} filePath - Path to JSONL file
   * @returns {Promise<Object|null>} First user entry object or null
   */
  static async extractFirstUserEntry(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const lines = data.trim().split('\n');
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const entry = JSON.parse(line);
          
          // Look for user messages with metadata
          if (entry.type === 'user' && entry.message && entry.message.role === 'user' && entry.cwd) {
            return entry;
          }
        } catch (parseError) {
          // Skip invalid JSON lines
          continue;
        }
      }
      
      return null; // No user entry found
    } catch (error) {
      console.warn(`⚠️ Failed to extract first user entry from ${filePath}:`, error.message);
      return null;
    }
  }

  /**
   * Extracts the LAST user message content from a JSONL file
   * @private  
   * @param {string} filePath - Path to JSONL file
   * @returns {Promise<string|null>} Last user message or null
   */
  static async extractLastUserMessage(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const lines = data.trim().split('\n');
      
      // Search backwards through lines to find last user message
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i];
        if (!line.trim()) continue;
        
        try {
          const entry = JSON.parse(line);
          
          // Look for user messages, skip system messages
          if (entry.type === 'user' && entry.message && entry.message.role === 'user') {
            const content = entry.message.content;
            
            // Handle both string content and array content formats
            if (typeof content === 'string') {
              return content.length > 100 ? content.substring(0, 100) + '...' : content;
            } else if (Array.isArray(content) && content[0] && content[0].text) {
              const text = content[0].text;
              return text.length > 100 ? text.substring(0, 100) + '...' : text;
            }
          }
        } catch (parseError) {
          // Skip invalid JSON lines
          continue;
        }
      }
      
      return null; // No user message found
    } catch (error) {
      console.warn(`⚠️ Failed to extract last user message from ${filePath}:`, error.message);
      return null;
    }
  }

  /**
   * Counts the total number of messages in a JSONL file
   * @private  
   * @param {string} filePath - Path to JSONL file
   * @returns {Promise<number>} Number of messages in the session
   */
  static async countMessages(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const lines = data.trim().split('\n');
      let count = 0;
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const entry = JSON.parse(line);
          
          // Count both user and assistant messages
          if (entry.type === 'user' || entry.type === 'assistant') {
            count++;
          }
        } catch (parseError) {
          // Skip invalid JSON lines
          continue;
        }
      }
      
      return count;
    } catch (error) {
      console.warn(`⚠️ Failed to count messages in ${filePath}:`, error.message);
      return 0;
    }
  }

  /**
   * Extracts the first user message content from a JSONL file
   * @private  
   * @param {string} filePath - Path to JSONL file
   * @returns {Promise<string|null>} First user message or null
   */
  static async extractFirstUserMessage(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const lines = data.trim().split('\n');
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const entry = JSON.parse(line);
          
          // Look for user messages, skip system messages
          if (entry.type === 'user' && entry.message && entry.message.role === 'user') {
            const content = entry.message.content;
            
            // Handle both string content and array content formats
            if (typeof content === 'string') {
              return content.length > 100 ? content.substring(0, 100) + '...' : content;
            } else if (Array.isArray(content) && content[0] && content[0].text) {
              const text = content[0].text;
              return text.length > 100 ? text.substring(0, 100) + '...' : text;
            }
          }
        } catch (parseError) {
          // Skip invalid JSON lines
          continue;
        }
      }
      
      return null; // No user message found
    } catch (error) {
      console.warn(`⚠️ Failed to extract first user message from ${filePath}:`, error.message);
      return null;
    }
  }

  /**
   * Get sessions sorted by modification time with optional limit
   * @param {number} limit - Maximum number of sessions to return
   * @returns {Promise<Array>} Sessions sorted by modification time (newest first)
   */
  static async getSessionsSortedByModified(limit = 10) {
    const sessions = await this.discoverSessions();
    return sessions.slice(0, limit);
  }

  /**
   * Get sessions grouped by modification date
   * @param {number} limit - Maximum number of sessions to return
   * @returns {Promise<Object>} Sessions grouped by date periods
   */
  static async getSessionsGroupedByDate(limit = 10) {
    const sessions = await this.getSessionsSortedByModified(limit);
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;

    const groups = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: []
    };

    sessions.forEach(session => {
      const timeDiff = now - session.modifiedAt;
      
      if (timeDiff < oneDay) {
        groups.today.push(session);
      } else if (timeDiff < 2 * oneDay) {
        groups.yesterday.push(session);
      } else if (timeDiff < oneWeek) {
        groups.thisWeek.push(session);
      } else {
        groups.older.push(session);
      }
    });

    return groups;
  }

  /**
   * Poll for new sessions created after a specific timestamp
   * @param {number} afterTimestamp - Timestamp to check after
   * @returns {Promise<Array>} New sessions created after timestamp
   */
  static async pollForNewSession(afterTimestamp) {
    const sessions = await this.discoverSessions();
    return sessions.filter(session => session.createdAt > afterTimestamp);
  }

  /**
   * Format file size in human readable format
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size (e.g., "1.2MB", "890KB")
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  /**
   * Format time ago in human readable format
   * @param {number} timestamp - Timestamp in milliseconds
   * @returns {string} Formatted time ago (e.g., "2 hours ago", "1 day ago")
   */
  static formatTimeAgo(timestamp) {
    const now = Date.now();
    const timeDiff = now - timestamp;
    const seconds = Math.floor(timeDiff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return days === 1 ? '1 day ago' : `${days} days ago`;
    } else if (hours > 0) {
      return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
    } else if (minutes > 0) {
      return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`;
    } else {
      return 'Just now';
    }
  }

  /**
   * Get statistics about discovered sessions
   * @returns {Promise<Object>} Session statistics
   */
  static async getStats() {
    const sessions = await this.discoverSessions();
    const totalSize = sessions.reduce((sum, session) => sum + (session.fileSize || 0), 0);
    
    return {
      totalSessions: sessions.length,
      totalSizeBytes: totalSize,
      totalSizeMB: Math.round(totalSize / (1024 * 1024) * 100) / 100,
      oldestSession: sessions.length > 0 ? sessions[sessions.length - 1] : null,
      newestSession: sessions.length > 0 ? sessions[0] : null,
      projectPath: sessions.length > 0 ? sessions[0].projectPath : null
    };
  }
}

module.exports = SessionDiscoveryService;