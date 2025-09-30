/**
 * 🎯 HOLLER SESSION MANAGER
 * Manages Holler sessions with terminal + Claude Code integration
 * Uses SQLite-only storage for reliable session management
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const ClaudiaSessionDiscovery = require('./ClaudiaSessionDiscovery');
const SimpleClaudeDetector = require('../../simple-claude-detector');
const SessionDiscoveryService = require('./SessionDiscoveryService');
const HollerDatabase = require('./Database');

class SessionManager {
  constructor() {
    this.claudeDir = path.join(os.homedir(), '.claude');
    this.claudeDetector = new SimpleClaudeDetector();
    
    // 🗄️ SQLite-only database
    this.db = new HollerDatabase();
    console.log('🗄️ SessionManager: SQLite-only mode initialized');
    
    this.loadSessions();
  }

  /**
   * Load sessions from SQLite database
   */
  loadSessions() {
    try {
      const sessions = this.db.getAllSessions();
      console.log('🗄️ Loaded sessions from SQLite:', sessions.length);
      return { sessions, activeSessionId: this.db.getMetadata('activeSessionId') };
    } catch (error) {
      console.error('❌ Error loading sessions from SQLite:', error);
      return { sessions: [], activeSessionId: null };
    }
  }

  /**
   * Update active session metadata in SQLite
   */
  updateActiveSession(sessionId) {
    try {
      this.db.setMetadata('activeSessionId', sessionId);
      console.log('🗄️ SQLite: Updated activeSessionId:', sessionId);
      return true;
    } catch (error) {
      console.error('❌ Error updating active session:', error);
      return false;
    }
  }


  /**
   * Create a new Holler session
   */
  createSession(options) {
    const sessionId = `session-${Date.now()}`;
    const terminalId = `terminal-${Date.now()}`;
    
    // Handle both string and object formats for backwards compatibility
    let sessionName;
    if (typeof options === 'string') {
      sessionName = options;
    } else if (typeof options === 'object' && options) {
      sessionName = options.name;
    } else {
      const existingSessions = this.db.getAllSessions();
      sessionName = `Session ${existingSessions.length + 1}`;
    }
    
    const session = {
      id: sessionId,
      name: sessionName || `Session ${this.db.getAllSessions().length + 1}`,
      created: new Date().toISOString(),
      terminalId: terminalId,
      claudeSessionId: null, // Will be populated when Claude session is detected
      plan: null // Plan storage in SQLite
    };
    
    // Create in SQLite
    const createdSession = this.db.createSession(session);
    this.updateActiveSession(sessionId);
    
    console.log('🚀 Created new session:', createdSession);
    return createdSession;
  }

  /**
   * Add a pre-built session (for promotion)
   */
  addSession(session) {
    if (!session.id) {
      throw new Error('Session must have an ID');
    }
    
    const createdSession = this.db.createSession(session);
    console.log('➕ Added session:', session.id, session.name);
    return createdSession;
  }

  /**
   * Get all sessions
   */
  getAllSessions() {
    return this.db.getAllSessions();
  }

  /**
   * Get session by ID
   */
  getSession(sessionId) {
    return this.db.getSession(sessionId);
  }

  /**
   * Update session with Claude session ID
   */
  updateSessionWithClaude(sessionId, claudeSessionId) {
    const updated = this.db.updateSession(sessionId, { claudeSessionId });
    if (updated) {
      console.log(`🔗 Linked session ${sessionId} with Claude session ${claudeSessionId}`);
      return this.db.getSession(sessionId);
    }
    return null;
  }

  /**
   * Update session plan
   */
  updateSessionPlan(sessionId, plan) {
    const updated = this.db.updateSession(sessionId, { plan });
    if (updated) {
      console.log(`📋 Updated plan for session ${sessionId}`);
      return this.db.getSession(sessionId);
    }
    return null;
  }

  /**
   * Get session plan
   */
  getSessionPlan(sessionId) {
    const session = this.db.getSession(sessionId);
    return session?.plan || null;
  }

  /**
   * Update session autonomous mode flag
   */
  updateSessionAutonomousMode(sessionId, autonomousMode) {
    // Note: autonomousMode is not currently part of the SQLite schema
    // This method may need schema updates if autonomous mode is still needed
    console.warn('⚠️ autonomousMode not implemented in SQLite schema');
    return false;
  }

  /**
   * Update session Jarvis mode flag
   */
  updateSessionJarvisMode(sessionId, jarvisMode) {
    const mode = jarvisMode ? "planning" : null;
    const updated = this.db.updateSession(sessionId, { jarvisMode, mode });
    
    if (updated) {
      if (jarvisMode) {
        console.log(`🤖 Session ${sessionId} entering Jarvis Mode: mode=planning`);
      } else {
        console.log(`🔄 Session ${sessionId} exiting Jarvis Mode`);
      }
      return true;
    }
    
    console.error(`❌ Session ${sessionId} not found for Jarvis mode update`);
    return false;
  }


  /**
   * Update session mode (planning/execution)
   */
  updateSessionMode(sessionId, mode) {
    const session = this.db.getSession(sessionId);
    if (session && session.jarvisMode) {
      const updated = this.db.updateSession(sessionId, { mode });
      if (updated) {
        console.log(`🔄 Session ${sessionId} mode updated: ${mode}`);
        return true;
      }
    }
    console.error(`❌ Session ${sessionId} not found or not in Jarvis mode for mode update`);
    return false;
  }

  /**
   * Get active session ID
   */
  getActiveSessionId() {
    // First try to get from metadata
    const activeId = this.db.getMetadata('activeSessionId');
    if (activeId) {
      return activeId;
    }
    
    // Fallback: most recently created session
    const sessions = this.getAllSessions();
    if (sessions.length === 0) return null;
    
    return sessions.sort((a, b) => new Date(b.created) - new Date(a.created))[0].id;
  }

  /**
   * Simple Claude session detection using proven direct JSONL reading approach
   */
  detectAndLinkCurrentClaudeSession(hollerSessionId) {
    console.log('🎯 Using simple Claude session detection (proven approach)...');
    
    try {
      // Get the current Claude session ID using the proven approach
      const currentClaudeSessionId = this.claudeDetector.getCurrentClaudeSessionId();
      
      if (currentClaudeSessionId) {
        this.updateSessionWithClaude(hollerSessionId, currentClaudeSessionId);
        console.log(`🔗 Successfully linked Holler session ${hollerSessionId} to Claude session ${currentClaudeSessionId}`);
        return currentClaudeSessionId;
      } else {
        console.log('❌ No active Claude session detected');
        return null;
      }
    } catch (error) {
      console.error('❌ Error detecting Claude session:', error);
      return null;
    }
  }

  /**
   * Extract session ID from newest Claude session file
   */
  extractClaudeSessionId(filename) {
    try {
      // Handle full path or just filename
      let filePath = filename;
      if (!path.isAbsolute(filename)) {
        filePath = path.join(this.claudeDir, filename);
      }
      
      if (!fs.existsSync(filePath)) {
        console.log('⚠️ Claude session file not found:', filePath);
        return;
      }

      // Read the JSONL file and extract session ID
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        console.log('⚠️ Empty Claude session file');
        return;
      }

      // Try to find session ID from any line (preference for later lines which have actual conversation)
      let sessionId = null;
      
      // Check lines in reverse order (most recent messages first)
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const lineData = JSON.parse(lines[i]);
          if (lineData.sessionId) {
            sessionId = lineData.sessionId;
            break;
          }
        } catch (e) {
          // Skip invalid JSON lines
          continue;
        }
      }
      
      // If no sessionId in content, try extracting from filename
      if (!sessionId) {
        const fileBasename = path.basename(filePath, '.jsonl');
        // Claude session IDs are UUIDs in the filename
        const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        const match = fileBasename.match(uuidRegex);
        if (match) {
          sessionId = match[0];
        }
      }
      
      if (sessionId) {
        console.log('🎯 Extracted Claude session ID:', sessionId);
        
        // Update the most recent Holler session with this Claude session ID
        const activeSessionId = this.getActiveSessionId();
        if (activeSessionId) {
          this.updateSessionWithClaude(activeSessionId, sessionId);
        }
      } else {
        console.log('⚠️ Could not extract session ID from file:', filename);
      }
    } catch (error) {
      console.error('❌ Error extracting Claude session ID:', error);
    }
  }

  /**
   * Link Claude session for a Holler session using simple proven approach
   */
  linkClaudeSessionForHollerSession(hollerSessionId) {
    try {
      const session = this.getSession(hollerSessionId);
      if (!session) {
        console.log('⚠️ Holler session not found:', hollerSessionId);
        return null;
      }

      console.log(`🔍 Linking Claude session for Holler session: ${hollerSessionId}`);
      
      // Use the simple proven approach - just get the current Claude session
      return this.detectAndLinkCurrentClaudeSession(hollerSessionId);
      
    } catch (error) {
      console.error('❌ Error linking Claude session for Holler session:', error);
      return null;
    }
  }

  /**
   * Find the currently active Claude session (most recently modified with content)
   */
  findCurrentActiveClaudeSession() {
    if (!this.claudeTracker) {
      return null;
    }

    try {
      // Get all tracked sessions and find the most recently modified one with real content
      const status = this.claudeTracker.getSessionStatus();
      
      if (status.sessions.length === 0) {
        return null;
      }

      // Find sessions that have been modified recently (within last hour) and have content
      const recentlyActiveThreshold = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      const activeSessions = status.sessions
        .filter(s => s.ready && s.messageCount > 0)
        .filter(s => {
          // Check if the session has been modified recently by examining the file
          try {
            const sessionData = this.claudeTracker.trackedSessions.get(s.sessionId);
            if (sessionData && sessionData.analysis.mtime) {
              return new Date(sessionData.analysis.mtime) > recentlyActiveThreshold;
            }
          } catch (e) {
            return false;
          }
          return false;
        })
        .sort((a, b) => {
          // Sort by modification time (most recent first)
          const aData = this.claudeTracker.trackedSessions.get(a.sessionId);
          const bData = this.claudeTracker.trackedSessions.get(b.sessionId);
          if (aData && bData) {
            return new Date(bData.analysis.mtime) - new Date(aData.analysis.mtime);
          }
          return 0;
        });

      if (activeSessions.length > 0) {
        const activeSession = activeSessions[0];
        const sessionData = this.claudeTracker.trackedSessions.get(activeSession.sessionId);
        console.log(`🎯 Found active Claude session: ${activeSession.sessionId} (modified: ${sessionData.analysis.mtime})`);
        return { sessionId: activeSession.sessionId, ...sessionData.analysis };
      }

      return null;
    } catch (error) {
      console.error('❌ Error finding current active Claude session:', error);
      return null;
    }
  }

  /**
   * Discovery-based session linking (replaces broken hook correlation)
   * Finds the most recent Claude session and links it to the specified Holler session
   */
  async linkLatestClaudeSessionDiscovery(hollerSessionId = null) {
    try {
      // Use active session if none specified
      const targetSessionId = hollerSessionId || this.getActiveSessionId();
      if (!targetSessionId) {
        console.log('⚠️ No Holler session to link Claude session to');
        return null;
      }

      console.log(`🔍 Discovery-based linking for Holler session: ${targetSessionId}`);
      
      // Get the most recent Claude session from our target directory
      console.log(`🔍 Scanning target directory: ~/.claude/projects/-Users-joshuamullet-code/`);
      const mostRecentSession = await SessionDiscoveryService.getMostRecentSession();
      
      if (mostRecentSession) {
        console.log(`📋 Found most recent Claude session: ${mostRecentSession.sessionId}`);
        console.log(`📊 Session details:`, JSON.stringify(mostRecentSession, null, 2));
        
        // Check if this Claude session is already linked to another Holler session
        const existingLink = this.findHollerSessionByClaudeId(mostRecentSession.sessionId);
        
        if (existingLink && existingLink.id !== targetSessionId) {
          console.log(`⚠️ Claude session ${mostRecentSession.sessionId} already linked to ${existingLink.id}`);
          return null;
        }
        
        // Link the Claude session to our Holler session
        this.updateSessionWithClaude(targetSessionId, mostRecentSession.sessionId);
        console.log(`🔗 Discovery-linked Claude session ${mostRecentSession.sessionId} to Holler session ${targetSessionId}`);
        console.log(`📋 Session details: created ${new Date(mostRecentSession.createdAt)}, project: ${mostRecentSession.projectPath}`);
        
        return mostRecentSession.sessionId;
      } else {
        console.log('❌ No Claude sessions discovered');
        return null;
      }
    } catch (error) {
      console.error('❌ Discovery-based linking failed:', error);
      return null;
    }
  }

  /**
   * Find Holler session by Claude session ID
   */
  findHollerSessionByClaudeId(claudeSessionId) {
    for (const session of this.sessions.values()) {
      if (session.claudeSessionId === claudeSessionId) {
        return session;
      }
    }
    return null;
  }

  /**
   * Legacy method - kept for compatibility but now uses discovery
   */
  async linkLatestClaudeSession() {
    console.log(`\n🔗🔗🔗 ATTEMPTING CLAUDE SESSION CORRELATION 🔗🔗🔗`);
    const activeSessionId = this.getActiveSessionId();
    console.log(`🎯 Active Holler Session ID: ${activeSessionId}`);
    
    if (activeSessionId) {
      console.log(`🔍 Using Claudia's discovery method...`);
      const claudeSession = await ClaudiaSessionDiscovery.getMostRecentSession();
      
      if (claudeSession) {
        console.log(`✅ Found most recent Claude session: ${claudeSession.sessionId}`);
        const result = this.updateSessionWithClaude(activeSessionId, claudeSession.sessionId);
        console.log(`🔗🔗🔗 END CLAUDE SESSION CORRELATION 🔗🔗🔗\n`);
        return result;
      } else {
        console.log(`❌ No Claude session found via Claudia discovery`);
        console.log(`🔗🔗🔗 END CLAUDE SESSION CORRELATION 🔗🔗🔗\n`);
        return null;
      }
    } else {
      console.log('⚠️ No active Holler session to link Claude session to');
      console.log(`🔗🔗🔗 END CLAUDE SESSION CORRELATION 🔗🔗🔗\n`);
      return null;
    }
  }

  /**
   * Extract Claude session ID from specific file for specific Holler session
   */
  extractClaudeSessionIdForSession(filePath, hollerSessionId) {
    try {
      if (!fs.existsSync(filePath)) {
        console.log('⚠️ Claude session file not found:', filePath);
        return;
      }

      // Read the JSONL file and extract session ID
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      if (lines.length === 0) {
        console.log('⚠️ Empty Claude session file:', filePath);
        return;
      }

      // Try to find session ID from any line (preference for later lines which have actual conversation)
      let sessionId = null;
      
      // Check lines in reverse order (most recent messages first)
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const lineData = JSON.parse(lines[i]);
          if (lineData.sessionId) {
            sessionId = lineData.sessionId;
            break;
          }
        } catch (e) {
          // Skip invalid JSON lines
          continue;
        }
      }
      
      // If no sessionId in content, try extracting from filename
      if (!sessionId) {
        const fileBasename = path.basename(filePath, '.jsonl');
        // Claude session IDs are UUIDs in the filename
        const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
        const match = fileBasename.match(uuidRegex);
        if (match) {
          sessionId = match[0];
        }
      }
      
      if (sessionId) {
        console.log(`🎯 Extracted Claude session ID for Holler session ${hollerSessionId}: ${sessionId}`);
        this.updateSessionWithClaude(hollerSessionId, sessionId);
      } else {
        console.log('⚠️ Could not extract session ID from file:', filePath);
      }
    } catch (error) {
      console.error('❌ Error extracting Claude session ID for session:', error);
    }
  }

  /**
   * Delete a session from SQLite
   */
  deleteSession(sessionId) {
    try {
      const session = this.db.getSession(sessionId);
      if (!session) {
        console.log('⚠️ Session not found for deletion:', sessionId);
        return { success: false, error: 'Session not found' };
      }

      const deleted = this.db.deleteSession(sessionId);
      if (deleted) {
        console.log(`🗑️ Deleted session: ${sessionId} (Terminal ID: ${session.terminalId})`);
        return { 
          success: true, 
          sessionId: sessionId,
          terminalId: session.terminalId 
        };
      }
      
      return { success: false, error: 'Failed to delete session' };
    } catch (error) {
      console.error('❌ Error deleting session:', error);
      return { success: false, error: error.message };
    }
  }


  /**
   * Get sessions ready for frontend
   */
  getSessionsForFrontend() {
    return {
      sessions: this.getAllSessions(),
      activeSessionId: this.getActiveSessionId()
    };
  }

  /**
   * Generate UUID for new Claude session IDs
   */
  generateUUID() {
    return uuidv4();
  }

  /**
   * Get Claude project directory path
   */
  getClaudeProjectDir() {
    // Find the current project directory from ~/.claude/projects/
    const projectsDir = path.join(os.homedir(), '.claude', 'projects');
    
    if (!fs.existsSync(projectsDir)) {
      throw new Error('Claude projects directory not found');
    }

    // Look for a project that matches our current working directory
    const currentDir = process.cwd();
    const projectDirs = fs.readdirSync(projectsDir);
    
    // 🎯 PRIORITY 1: Look for main code directory first
    const mainCodeDir = '-Users-joshuamullet-code';
    const mainCodePath = path.join(projectsDir, mainCodeDir);
    if (fs.existsSync(mainCodePath) && fs.statSync(mainCodePath).isDirectory()) {
      console.log(`🎯 Found main Claude project directory: ${mainCodePath}`);
      return mainCodePath;
    }
    
    // 🎯 PRIORITY 2: Look for directory that contains "holler" since we're in the holler project
    for (const projectDir of projectDirs) {
      const projectPath = path.join(projectsDir, projectDir);
      if (fs.statSync(projectPath).isDirectory()) {
        // Check if this project directory matches the holler project
        if (projectDir.includes('holler') && !projectDir.includes('holler-next')) {
          console.log(`🎯 Found Claude holler project directory: ${projectPath}`);
          return projectPath;
        }
      }
    }
    
    // 🎯 PRIORITY 3: Use any directory with .jsonl files
    for (const projectDir of projectDirs) {
      const projectPath = path.join(projectsDir, projectDir);
      if (fs.statSync(projectPath).isDirectory()) {
        const files = fs.readdirSync(projectPath);
        if (files.some(file => file.endsWith('.jsonl'))) {
          console.log(`🎯 Found project directory with .jsonl files: ${projectPath}`);
          return projectPath;
        }
      }
    }
    
    throw new Error('No Claude project directories found');
  }

  /**
   * Clone a Claude conversation to create true conversation forking
   * This creates an independent conversation history that can diverge completely
   */
  async cloneConversation(originalSessionId, newSessionId) {
    try {
      console.log(`🔄 Starting conversation clone: ${originalSessionId} -> ${newSessionId}`);
      
      // Get Claude project directory
      const claudeProjectDir = this.getClaudeProjectDir();
      
      // Read original conversation file
      const originalFile = path.join(claudeProjectDir, `${originalSessionId}.jsonl`);
      
      if (!fs.existsSync(originalFile)) {
        throw new Error(`Original conversation file not found: ${originalFile}`);
      }
      
      const originalContent = fs.readFileSync(originalFile, 'utf8');
      const originalLines = originalContent.trim().split('\n').filter(line => line.trim());
      
      if (originalLines.length === 0) {
        throw new Error('Original conversation file is empty');
      }
      
      console.log(`📋 Original conversation has ${originalLines.length} messages`);
      
      // Map to track UUID transformations for maintaining parent relationships
      const uuidMap = new Map();
      
      // Transform conversation data
      const clonedLines = originalLines.map(line => {
        if (!line.trim()) return line;
        
        try {
          const entry = JSON.parse(line);
          
          // Generate new UUID for this message
          const newUuid = this.generateUUID();
          
          // Store mapping for parent relationship preservation
          if (entry.uuid) {
            uuidMap.set(entry.uuid, newUuid);
          }
          
          // Update the entry with new session ID and UUID
          const clonedEntry = {
            ...entry,
            sessionId: newSessionId,
            uuid: newUuid
          };
          
          // Update parentUuid if it exists and we have a mapping
          if (entry.parentUuid && uuidMap.has(entry.parentUuid)) {
            clonedEntry.parentUuid = uuidMap.get(entry.parentUuid);
          }
          
          return JSON.stringify(clonedEntry);
        } catch (error) {
          console.error('❌ Error parsing conversation line:', error);
          return line; // Keep original line if parsing fails
        }
      });
      
      // Write new conversation file
      const newFile = path.join(claudeProjectDir, `${newSessionId}.jsonl`);
      fs.writeFileSync(newFile, clonedLines.join('\n'));
      
      console.log(`✅ Successfully cloned conversation to: ${newFile}`);
      console.log(`🔄 Transformed ${originalLines.length} messages with new UUIDs`);
      
      return { 
        success: true, 
        newSessionId,
        originalFile,
        newFile,
        messageCount: originalLines.length
      };
      
    } catch (error) {
      console.error('❌ Conversation cloning failed:', error);
      return { 
        success: false, 
        error: error.message 
      };
    }
  }
}

module.exports = SessionManager;