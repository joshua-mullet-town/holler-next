#!/usr/bin/env node

/**
 * Completion Detection Simulation Test
 * 
 * This directly tests the completion detection logic by simulating
 * a Claude response completion event with your real session data.
 */

const CompletionDetectionTest = require('./lib/CompletionDetectionTest');
const SessionManager = require('./lib/SessionManager');

async function main() {
  console.log('🧪 COMPLETION DETECTION SIMULATION TEST');
  console.log('🎯 This will simulate a Claude completion event to test our logic\n');

  const detector = new CompletionDetectionTest();
  const sessionManager = new SessionManager();
  
  try {
    // Get your current Jarvis session from SQLite
    const sessions = sessionManager.getAllSessions();
    const jarvisSession = sessions.find(s => s.jarvisMode && s.mode === 'planning');
    
    if (!jarvisSession) {
      console.log('❌ No Jarvis planning session found in SQLite database');
      return;
    }
    
    console.log('📋 Found Jarvis planning session:', {
      id: jarvisSession.id,
      name: jarvisSession.name,
      claudeSessionId: jarvisSession.claudeSessionId,
      mode: jarvisSession.mode
    });

    // Simulate a Claude completion event - but WITHOUT fake message content
    // The real test is whether we can extract the actual last message from the real .jsonl file
    const simulatedEvent = {
      sessionId: jarvisSession.claudeSessionId,
      message: null, // Force the extraction logic to read from the actual file
      isComplete: true,
      timestamp: new Date().toISOString()
    };

    console.log('🎬 Simulating Claude completion event...\n');
    
    // Directly call the completion handler
    await detector.handleClaudeResponseComplete(simulatedEvent);
    
    console.log('\n📊 Checking if message was stored...');
    
    // SQLite-only: Data is always current
    const updatedSession = sessionManager.getSession(jarvisSession.id);
    
    if (updatedSession && updatedSession.lastAssistantMessage) {
      console.log('✅ SUCCESS! Message was stored in session:', {
        sessionId: updatedSession.id,
        messageLength: updatedSession.lastAssistantMessage.length,
        messagePreview: updatedSession.lastAssistantMessage.substring(0, 100) + '...',
        capturedAt: updatedSession.lastMessageCaptured
      });
    } else {
      console.log('❌ FAILED! No message was stored in the session');
    }
    
  } catch (error) {
    console.error('❌ Simulation test error:', error);
  }
}

if (require.main === module) {
  main();
}

module.exports = main;