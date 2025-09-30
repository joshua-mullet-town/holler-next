/**
 * Session File Monitor - Alternative to Claude CLI Hooks
 * 
 * Monitors Claude session JSONL files to detect:
 * - New sessions (SessionStart hook equivalent)
 * - User messages (UserPromptSubmit hook equivalent) 
 * - Claude responses (Stop hook equivalent)
 */

const chokidar = require('chokidar');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');

class SessionFileMonitor extends EventEmitter {
  constructor() {
    super();
    this.claudeProjectsDir = path.join(os.homedir(), '.claude', 'projects');
    this.watcher = null;
    this.sessionStates = new Map(); // Track last known state of each session
    this.isMonitoring = false;
    this.debounceTimers = new Map(); // Track debounce timers per session
  }

  /**
   * Start monitoring Claude session files
   */
  async startMonitoring() {
    if (this.isMonitoring) return;

    console.log('🔍 Starting Claude session file monitoring...');
    console.log('📂 Watching directory:', this.claudeProjectsDir);
    console.log('🔍 Pattern:', `${this.claudeProjectsDir}/**/*.jsonl`);

    // Watch Claude projects directory and filter for JSONL files
    this.watcher = chokidar.watch(this.claudeProjectsDir, {
      persistent: true,
      ignoreInitial: true, // 🚨 FIX: Don't process hundreds of existing files on startup
      usePolling: false,
      interval: 100
    });

    // Add debugging for chokidar events
    this.watcher.on('ready', () => {
      console.log('📋 Chokidar ready, watching', this.watcher.getWatched());
    });

    this.watcher.on('error', (error) => {
      console.error('❌ Chokidar error:', error);
    });

    // Handle file events
    this.watcher.on('add', this.handleFileCreated.bind(this));
    this.watcher.on('change', this.handleFileModified.bind(this));
    this.watcher.on('unlink', this.handleFileDeleted.bind(this));

    this.isMonitoring = true;
    console.log('✅ Session file monitoring started');
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring() {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
    this.isMonitoring = false;
    console.log('⏹️ Session file monitoring stopped');
  }

  /**
   * Handle new session file created (SessionStart equivalent)
   */
  async handleFileCreated(filePath) {
    console.log('🔔 FILE CREATED EVENT:', filePath);

    // Only process .jsonl files
    if (!filePath.endsWith('.jsonl')) {
      console.log('🚫 Ignoring non-JSONL file:', filePath);
      return;
    }

    const sessionId = this.extractSessionId(filePath);
    console.log('🔍 Extracted session ID:', sessionId);
    if (!sessionId) return;

    console.log(`🆕 New Claude session detected: ${sessionId}`);

    // Initialize session state
    this.sessionStates.set(sessionId, {
      filePath,
      lastMessageCount: 0,
      lastModified: Date.now()
    });

    // Emit SessionStart event
    this.emit('sessionStart', {
      sessionId,
      filePath,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle session file modified (check for new messages) with debouncing
   */
  async handleFileModified(filePath) {
    // Only process .jsonl files
    if (!filePath.endsWith('.jsonl')) return;

    const sessionId = this.extractSessionId(filePath);
    if (!sessionId) return;

    // 🚨 INFINITE LOOP DEBUG: Track why same session keeps triggering
    const now = Date.now();
    const lastTrigger = this.lastFileTrigger || {};
    if (lastTrigger[sessionId] && (now - lastTrigger[sessionId]) < 1000) {
      console.log(`🔄 RAPID RETRIGGER: Session ${sessionId} triggered again after ${now - lastTrigger[sessionId]}ms`);
    }
    this.lastFileTrigger = this.lastFileTrigger || {};
    this.lastFileTrigger[sessionId] = now;

    // 🚨 DEBOUNCE: Prevent rapid-fire events that cause performance issues
    if (this.debounceTimers.has(sessionId)) {
      clearTimeout(this.debounceTimers.get(sessionId));
      console.log(`⏰ DEBOUNCE: Clearing existing timer for session ${sessionId}`);
    }

    const debounceTimer = setTimeout(async () => {
      this.debounceTimers.delete(sessionId);
      await this.processFileModification(filePath, sessionId);
    }, 100); // 100ms debounce

    this.debounceTimers.set(sessionId, debounceTimer);
  }

  /**
   * Actually process the file modification after debouncing
   */
  async processFileModification(filePath, sessionId) {
    // 🔄 FULL FILE MONITORING: Processing all sessions (will cause crashes)

    try {
      // REMOVED: Chatty processing logs

      // Read and parse the JSONL file
      const messages = await this.readSessionMessages(filePath);
      const sessionState = this.sessionStates.get(sessionId) || {
        lastMessageCount: 0,
        lastModified: 0
      };

      // Check if there are new messages
      if (messages.length > sessionState.lastMessageCount) {
        const newMessages = messages.slice(sessionState.lastMessageCount);

        // Process each new message
        for (const message of newMessages) {
          await this.processNewMessage(sessionId, message);
        }

        // Update session state
        this.sessionStates.set(sessionId, {
          filePath,
          lastMessageCount: messages.length,
          lastModified: Date.now()
        });
      }
    } catch (error) {
      console.error(`❌ Error processing session file ${filePath}:`, error);
    }
  }

  /**
   * Process a new message and emit appropriate events
   */
  async processNewMessage(sessionId, message) {
    const { type, message: msgContent, timestamp } = message;

    // 🔗 NEW: PARENT UUID CHAIN CORRELATION - Process every message for correlation
    const parentUuid = message.parentUuid;
    const messageUuid = message.uuid;

    // Emit correlation event for ALL messages (user, assistant, system, etc.)
    if (messageUuid) {
      this.emit('correlationRequest', {
        sessionId,
        parentUuid,
        messageUuid,
        messageType: type,
        timestamp: timestamp || new Date().toISOString()
      });
    }

    // 🔍 CRASH-DEBUG: Track message processing to identify infinite loops
    // console.log(`🔍 CRASH-DEBUG: processNewMessage - session: ${sessionId}, type: ${type}, timestamp: ${timestamp}`);

    if (type === 'user') {
      // Check if this is a real user message (not a tool result)
      if (msgContent?.role === 'user' && !message.toolUseResult) {
        // console.log(`📨 INCOMING: User message in Claude session ${sessionId}`);

        // Emit UserPromptSubmit event with FULL message object
        this.emit('userPromptSubmit', {
          sessionId,
          message: msgContent,
          timestamp: timestamp || new Date().toISOString(),
          // Include ALL fields from the JSONL message object
          fullMessage: message,
          parentUuid: message.parentUuid,
          userType: message.userType,
          cwd: message.cwd,
          version: message.version,
          gitBranch: message.gitBranch,
          uuid: message.uuid
        });
      }
    } else if (type === 'assistant') {
      // Claude response message
      if (msgContent?.role === 'assistant') {
        console.log(`💬 INCOMING: Claude response in session ${sessionId}`);

        // Check if this is a complete text response (not tool usage)
        const hasToolUse = msgContent.content?.some(c => c.type === 'tool_use');
        const isComplete = msgContent.stop_reason === 'end_turn' && !hasToolUse;

        console.log(`🔍 Message complete check: ${isComplete} (stop_reason: ${msgContent.stop_reason}, hasToolUse: ${hasToolUse})`);

        // 🚨 CRITICAL FIX: Only emit Stop event for COMPLETE messages to prevent infinite loops
        if (isComplete) {
          console.log(`✅ COMPLETE MESSAGE - Emitting stop event for session ${sessionId}`);
          this.emit('stop', {
            sessionId,
            message: msgContent,
            isComplete: true,
            timestamp: timestamp || new Date().toISOString()
          });
        }
      }
    }
  }

  /**
   * Handle session file deleted
   */
  async handleFileDeleted(filePath) {
    const sessionId = this.extractSessionId(filePath);
    if (!sessionId) return;

    console.log(`🗑️ Session file deleted: ${sessionId}`);
    this.sessionStates.delete(sessionId);

    this.emit('sessionDeleted', {
      sessionId,
      filePath,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Extract session ID from file path
   */
  extractSessionId(filePath) {
    const fileName = path.basename(filePath);
    if (!fileName.endsWith('.jsonl')) return null;
    return fileName.replace('.jsonl', '');
  }

  /**
   * Read and parse all messages from a session JSONL file
   */
  async readSessionMessages(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());

      return lines.map(line => {
        try {
          return JSON.parse(line);
        } catch (error) {
          console.warn(`⚠️ Failed to parse JSONL line:`, error);
          return null;
        }
      }).filter(Boolean);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error(`❌ Error reading session file ${filePath}:`, error);
      }
      return [];
    }
  }

  /**
   * Get current session state
   */
  getSessionState(sessionId) {
    return this.sessionStates.get(sessionId);
  }

  /**
   * Get all monitored sessions
   */
  getAllSessionStates() {
    return new Map(this.sessionStates);
  }
}

module.exports = SessionFileMonitor;