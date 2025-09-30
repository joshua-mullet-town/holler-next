#!/usr/bin/env node

/**
 * 📝 Plan Update CLI
 * 
 * Simple script for Claude to update session plans.
 * Usage: node scripts/set-plan.js <session-id> "plan content"
 */

const SessionManager = require('../lib/SessionManager');

async function setPlan() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log('Usage: node scripts/set-plan.js <session-id> "plan content"');
    console.log('Example: node scripts/set-plan.js session-123 "Build a new dashboard feature"');
    process.exit(1);
  }

  const sessionId = args[0];
  const planContent = args.slice(1).join(' '); // Join all remaining args as plan content

  try {
    const sessionManager = new SessionManager();
    
    // Verify session exists
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      console.error(`❌ Session ${sessionId} not found`);
      process.exit(1);
    }

    console.log(`📝 Setting plan for session ${sessionId}...`);
    
    // Update plan in SQLite
    const success = sessionManager.updateSessionPlan(sessionId, planContent);
    
    if (success) {
      console.log('✅ Plan updated successfully');
      console.log(`📋 New plan: ${planContent.substring(0, 200)}${planContent.length > 200 ? '...' : ''}`);
    } else {
      console.error('❌ Plan update failed');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

setPlan();