/**
 * Hook Alternative Integration
 * 
 * Shows how to integrate SessionFileMonitor with existing Holler server
 * to replace hook-based auto-correlation and Observer AI triggers
 */

const SessionFileMonitor = require('./SessionFileMonitor');

class HookAlternativeIntegration {
  constructor(sessionManager, io) {
    this.sessionManager = sessionManager;
    this.io = io;
    this.fileMonitor = new SessionFileMonitor();
    this.setupEventHandlers();
  }

  /**
   * Start the file monitoring system
   */
  async start() {
    await this.fileMonitor.startMonitoring();
    console.log('🔄 Hook alternative integration started');
  }

  /**
   * Stop the monitoring system
   */
  async stop() {
    await this.fileMonitor.stopMonitoring();
    console.log('⏹️ Hook alternative integration stopped');
  }

  /**
   * Setup event handlers to replace hook functionality
   */
  setupEventHandlers() {
    // Replace SessionStart hook functionality
    this.fileMonitor.on('sessionStart', this.handleSessionStart.bind(this));
    
    // Replace UserPromptSubmit hook functionality
    this.fileMonitor.on('userPromptSubmit', this.handleUserPromptSubmit.bind(this));
    
    // Replace Stop hook functionality (Claude response complete)
    this.fileMonitor.on('stop', this.handleClaudeResponseComplete.bind(this));
  }

  /**
   * Handle new Claude session detected (replaces SessionStart hook)
   */
  async handleSessionStart(event) {
    const { sessionId, timestamp } = event;
    console.log(`🎯 SESSION START DETECTED: ${sessionId} at ${timestamp}`);

    // AUTO-CORRELATION: Link to most recent unlinked Holler session
    await this.performAutoCorrelation(sessionId, timestamp);
  }

  /**
   * Handle user message submitted (replaces UserPromptSubmit hook)
   */
  async handleUserPromptSubmit(event) {
    const { sessionId, message, timestamp } = event;
    console.log(`💬 USER MESSAGE DETECTED: ${sessionId} at ${timestamp}`);

    // Update Holler session status to 'loading'
    const hollerSession = this.sessionManager.findHollerSessionByClaudeId(sessionId);
    if (hollerSession) {
      hollerSession.status = 'loading';
      
      // Broadcast status update
      this.io.emit('session:status', {
        sessionId: hollerSession.id,
        status: 'loading',
        timestamp
      });

      console.log(`🔄 Updated Holler session ${hollerSession.id} status to 'loading'`);
    }

    // TRIGGER OBSERVER AI: This is where Observer AI would analyze and potentially respond
    await this.triggerObserverAI(sessionId, message, 'userMessage');
  }

  /**
   * Handle Claude response complete (replaces Stop hook)
   */
  async handleClaudeResponseComplete(event) {
    const { sessionId, message, isComplete, timestamp } = event;
    console.log(`🤖 CLAUDE RESPONSE COMPLETE: ${sessionId} at ${timestamp}`);

    // Update Holler session status to 'ready'
    const hollerSession = this.sessionManager.findHollerSessionByClaudeId(sessionId);
    if (hollerSession) {
      hollerSession.status = 'ready';
      
      // Broadcast status update
      this.io.emit('session:status', {
        sessionId: hollerSession.id,
        status: 'ready',
        timestamp
      });

      console.log(`✅ Updated Holler session ${hollerSession.id} status to 'ready'`);
    }

    // TRIGGER NOTIFICATION: Replace beep hook functionality
    await this.triggerNotification(sessionId, 'response_complete');

    // TRIGGER OBSERVER AI: Analyze Claude's response and potentially provide feedback
    if (isComplete) {
      await this.triggerObserverAI(sessionId, message, 'claudeResponse');
    }
  }

  /**
   * Perform auto-correlation (replaces SessionStart hook logic)
   */
  async performAutoCorrelation(claudeSessionId, timestamp) {
    // Find most recent unlinked Holler session
    const unlinkedSession = this.sessionManager.getAllSessions()
      .filter(session => !session.claudeSessionId)
      .sort((a, b) => new Date(b.created) - new Date(a.created))[0];

    if (unlinkedSession) {
      console.log(`🔗 AUTO-CORRELATION: Linking Holler session ${unlinkedSession.id} ↔ Claude session ${claudeSessionId}`);

      // Perform the link
      const linkSuccess = this.sessionManager.updateSessionWithClaude(unlinkedSession.id, claudeSessionId);
      
      if (linkSuccess) {
        console.log(`✅ AUTO-CORRELATION SUCCESS: ${unlinkedSession.id} ↔ ${claudeSessionId}`);
        
        // Broadcast the correlation update
        this.io.emit('session:linked', {
          sessionId: unlinkedSession.id,
          claudeSessionId: claudeSessionId,
          timestamp
        });

        // Refresh session list
        const sessionsData = this.sessionManager.getSessionsForFrontend();
        this.io.emit('session:list', sessionsData);
      } else {
        console.error(`❌ AUTO-CORRELATION FAILED: ${unlinkedSession.id} ↔ ${claudeSessionId}`);
      }
    } else {
      console.log(`⚠️ No unlinked Holler sessions found for auto-correlation`);
    }
  }

  /**
   * Trigger notification (replaces notification beep hook)
   */
  async triggerNotification(sessionId, eventType) {
    console.log(`🔔 NOTIFICATION TRIGGER: ${eventType} for session ${sessionId}`);
    
    // Instead of system beep (which doesn't work in browser), 
    // emit browser notification or UI update
    this.io.emit('session:notification', {
      sessionId,
      type: eventType,
      message: `Claude ${eventType.replace('_', ' ')} in session ${sessionId}`,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Trigger Observer AI analysis (foundation for autonomous mode)
   */
  async triggerObserverAI(sessionId, message, eventType) {
    console.log(`🔬 OBSERVER AI TRIGGER: ${eventType} in session ${sessionId}`);
    
    // This is where the Observer AI would:
    // 1. Analyze the conversation context
    // 2. Check against session plan/goals
    // 3. Decide if intervention is needed
    // 4. Potentially send automated responses

    // For now, just emit the event for future Observer AI implementation
    this.io.emit('observer:analyze', {
      sessionId,
      eventType,
      message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get current monitoring status
   */
  getStatus() {
    return {
      isMonitoring: this.fileMonitor.isMonitoring,
      sessionCount: this.fileMonitor.getAllSessionStates().size,
      monitoredSessions: Array.from(this.fileMonitor.getAllSessionStates().keys())
    };
  }
}

module.exports = HookAlternativeIntegration;