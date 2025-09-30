/**
 * Completion Detection Test Script
 * 
 * Tests the full workflow:
 * 1. Detect Claude response completion
 * 2. Find corresponding Holler session 
 * 3. Check if Jarvis mode + planning mode
 * 4. Extract last assistant message
 * 5. Log message for debugging (SQLite-only mode)
 */

const SessionFileMonitor = require('./SessionFileMonitor');
const SessionManager = require('./SessionManager');
const fs = require('fs');
const path = require('path');

class CompletionDetectionTest {
  constructor() {
    this.sessionManager = new SessionManager();
    this.fileMonitor = new SessionFileMonitor();
    this.setupEventHandlers();
  }

  /**
   * Start the completion detection test
   */
  async start() {
    console.log('🧪 Starting Completion Detection Test...');
    await this.fileMonitor.startMonitoring();
    console.log('✅ Monitoring Claude sessions for completion events');
  }

  /**
   * Stop the test
   */
  async stop() {
    console.log('⏹️ Stopping Completion Detection Test...');
    await this.fileMonitor.stopMonitoring();
  }

  /**
   * Setup event handlers to test completion detection
   */
  setupEventHandlers() {
    // Listen for Claude response completion
    this.fileMonitor.on('stop', this.handleClaudeResponseComplete.bind(this));
  }

  /**
   * Handle Claude response complete - this is our main test function
   */
  async handleClaudeResponseComplete(event) {
    const { sessionId, message, isComplete, timestamp } = event;
    
    console.log('\n🎯 COMPLETION DETECTION TEST TRIGGERED');
    console.log('📋 Event Details:', {
      sessionId: sessionId,
      isComplete: isComplete,
      timestamp: timestamp,
      messageRole: message?.role,
      stopReason: message?.stop_reason
    });

    try {
      // STEP 1: Find corresponding Holler session
      const hollerSession = this.sessionManager.findHollerSessionByClaudeId(sessionId);
      
      if (!hollerSession) {
        console.log(`⚠️ No Holler session found for Claude session: ${sessionId}`);
        return;
      }
      
      console.log(`🔗 Found Holler session: ${hollerSession.id} (${hollerSession.name})`);

      // STEP 2: Check if Jarvis mode enabled
      if (!hollerSession.jarvisMode) {
        console.log(`⚠️ Holler session ${hollerSession.id} is not in Jarvis mode`);
        return;
      }
      
      console.log(`🤖 Holler session ${hollerSession.id} is in Jarvis mode`);

      // STEP 3: Check if planning mode
      if (hollerSession.mode !== 'planning') {
        console.log(`⚠️ Holler session ${hollerSession.id} is not in planning mode (current: ${hollerSession.mode})`);
        return;
      }
      
      console.log(`📋 Holler session ${hollerSession.id} is in planning mode`);

      // STEP 4: Extract last assistant message
      const lastMessage = await this.extractLastAssistantMessage(sessionId, message);
      
      if (!lastMessage) {
        console.log(`❌ Could not extract last assistant message from session ${sessionId}`);
        return;
      }

      console.log(`✅ Extracted last assistant message:`, {
        length: lastMessage.length,
        preview: lastMessage.substring(0, 100) + '...'
      });

      // STEP 5: Log for debugging (SQLite-only mode)
      await this.storeLastMessageInSession(hollerSession.id, lastMessage, timestamp);
      
      console.log(`✅ COMPLETION DETECTION TEST SUCCESS for session ${hollerSession.id}`);
      
    } catch (error) {
      console.error(`❌ COMPLETION DETECTION TEST ERROR:`, error);
    }
    
    console.log('🎯 COMPLETION DETECTION TEST COMPLETE\n');
  }

  /**
   * Extract the last assistant message content (text only)
   */
  async extractLastAssistantMessage(claudeSessionId, messageObj) {
    try {
      console.log(`🔍 Extracting last assistant message for Claude session: ${claudeSessionId}`);
      
      // Always read from the .jsonl file directly to test the real extraction logic
      console.log(`📂 Reading from actual Claude session file...`);
      const claudeProjectDir = this.sessionManager.getClaudeProjectDir();
      const sessionFile = path.join(claudeProjectDir, `${claudeSessionId}.jsonl`);
      
      if (!fs.existsSync(sessionFile)) {
        console.log(`⚠️ Claude session file not found: ${sessionFile}`);
        return null;
      }

      const content = fs.readFileSync(sessionFile, 'utf8');
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      // Find the last assistant message
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const entry = JSON.parse(lines[i]);
          if (entry.type === 'assistant' && entry.message?.role === 'assistant') {
            const textContent = entry.message.content
              ?.filter(c => c.type === 'text')
              ?.map(c => c.text)
              ?.join('\n');
              
            if (textContent?.trim()) {
              return textContent.trim();
            }
          }
        } catch (e) {
          continue;
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error extracting last assistant message:', error);
      return null;
    }
  }

  /**
   * Store the last message for debugging (now logs only, SQLite doesn't store debug data)
   */
  async storeLastMessageInSession(hollerSessionId, lastMessage, timestamp) {
    try {
      // Just log for debugging - we don't store debug messages in SQLite
      console.log(`💾 Debug: Last assistant message for session ${hollerSessionId}: ${lastMessage.substring(0, 100)}...`);
      console.log(`💾 Debug: Message timestamp: ${timestamp}`);
      return true;
    } catch (error) {
      console.error('❌ Error logging last message:', error);
      return false;
    }
  }

  /**
   * Get test status
   */
  getStatus() {
    return {
      isMonitoring: this.fileMonitor.isMonitoring,
      sessionCount: this.fileMonitor.getAllSessionStates().size,
      monitoredSessions: Array.from(this.fileMonitor.getAllSessionStates().keys())
    };
  }
}

module.exports = CompletionDetectionTest;