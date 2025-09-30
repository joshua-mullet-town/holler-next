#!/usr/bin/env node

/**
 * 🗑️ Session Deletion CLI
 * 
 * Deletes sessions from SQLite database.
 * Also removes associated correlations.
 */

const SessionManager = require('../lib/SessionManager');
const CorrelationManager = require('../lib/CorrelationManager');

async function deleteSession() {
  const args = process.argv.slice(2);
  
  if (args.length < 1) {
    console.log(`
🗑️ SESSION DELETION CLI

Usage:
  node scripts/delete-session.js <session-id>
  node scripts/delete-session.js <session-id> --with-correlations

Examples:
  node scripts/delete-session.js session-123
  node scripts/delete-session.js session-123 --with-correlations

Options:
  --with-correlations    Also remove correlation data (recommended)
`);
    process.exit(1);
  }

  const sessionId = args[0];
  const withCorrelations = args.includes('--with-correlations');

  try {
    console.log(`🗑️ Deleting session ${sessionId}...`);
    
    // Initialize managers with shared database
    const sessionManager = new SessionManager();
    const correlationManager = new CorrelationManager(sessionManager.db);
    
    // Verify session exists
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      console.error(`❌ Session ${sessionId} not found`);
      process.exit(1);
    }

    console.log(`📋 Found session: ${session.name}`);
    console.log(`📅 Created: ${session.created}`);
    console.log(`🔗 Claude ID: ${session.claudeSessionId || '(none)'}`);
    
    // Check for correlations
    const hasCorrelation = correlationManager.getLastUuid(sessionId);
    if (hasCorrelation) {
      console.log(`🔗 Has correlation: ${hasCorrelation}`);
      
      if (withCorrelations) {
        console.log('🗑️ Removing correlation...');
        correlationManager.removeCorrelation(sessionId);
      } else {
        console.log('⚠️ Correlation will remain (use --with-correlations to remove)');
      }
    }

    // Delete the session from SQLite
    console.log('🗑️ Deleting session...');
    const result = sessionManager.deleteSession(sessionId);
    
    if (result.success) {
      console.log('✅ Session deleted successfully');
      console.log(`🏁 Deleted: ${sessionId} (Terminal: ${result.terminalId})`);
      
      // Show remaining sessions
      const remainingSessions = sessionManager.getAllSessions();
      console.log(`📊 Remaining sessions: ${remainingSessions.length}`);
      
      if (remainingSessions.length > 0) {
        console.log('\n📋 Remaining sessions:');
        remainingSessions.forEach(s => {
          console.log(`   🔹 ${s.id}: ${s.name}`);
        });
      }
      
    } else {
      console.error('❌ Deletion failed:', result.error);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

deleteSession();