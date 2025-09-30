#!/usr/bin/env node

/**
 * 🛠️ Session Update CLI
 * 
 * Allows Claude Code to update SQLite database fields via Bash commands.
 * Maintains JSON compatibility during dual-write mode.
 */

const HollerDatabase = require('../lib/Database');
const SessionManager = require('../lib/SessionManager');

function showUsage() {
  console.log(`
🛠️ SESSION UPDATE CLI

Usage:
  node scripts/update-session.js <session-id> <field> <value>
  node scripts/update-session.js <session-id> --<field>=<value>

Fields:
  plan              Set the Jarvis plan content
  jarvis-mode       Enable/disable Jarvis mode (true/false)
  claude-id         Set Claude session ID
  mode              Set session mode (planning/execution/etc)

Examples:
  node scripts/update-session.js session-123 plan "Build a new feature"
  node scripts/update-session.js session-123 --jarvis-mode=true
  node scripts/update-session.js session-123 --claude-id=abc-def-123
  node scripts/update-session.js session-123 --mode=planning

Quick Commands:
  node scripts/update-session.js session-123 enable-jarvis
  node scripts/update-session.js session-123 disable-jarvis
  node scripts/update-session.js session-123 set-planning
  node scripts/update-session.js session-123 set-execution
`);
}

async function updateSession() {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    showUsage();
    process.exit(1);
  }

  const sessionId = args[0];
  const operation = args[1];
  const value = args[2];

  try {
    // Initialize dual-write system
    const sessionManager = new SessionManager();
    
    // Verify session exists
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      console.error(`❌ Session ${sessionId} not found`);
      process.exit(1);
    }

    console.log(`🔄 Updating session ${sessionId}...`);

    // Parse operation
    let updates = {};
    
    if (operation.startsWith('--')) {
      // Flag-style argument: --jarvis-mode=true
      const [field, val] = operation.substring(2).split('=');
      updates[convertFieldName(field)] = parseValue(val);
    } else if (operation === 'enable-jarvis') {
      updates.jarvisMode = true;
    } else if (operation === 'disable-jarvis') {
      updates.jarvisMode = false;
    } else if (operation === 'set-planning') {
      updates.mode = 'planning';
    } else if (operation === 'set-execution') {
      updates.mode = 'execution';
    } else {
      // Standard argument: field value
      const field = convertFieldName(operation);
      updates[field] = parseValue(value);
    }

    // Validate updates
    if (Object.keys(updates).length === 0) {
      console.error('❌ No valid updates specified');
      showUsage();
      process.exit(1);
    }

    // Apply updates via SessionManager (dual-write)
    let success = false;
    
    for (const [field, value] of Object.entries(updates)) {
      try {
        if (field === 'plan') {
          sessionManager.updateSessionPlan(sessionId, value);
          success = true;
        } else if (field === 'jarvisMode') {
          sessionManager.updateSessionJarvisMode(sessionId, value);
          success = true;
        } else if (field === 'claudeSessionId') {
          sessionManager.updateSessionWithClaude(sessionId, value);
          success = true;
        } else if (field === 'mode') {
          sessionManager.updateSessionMode(sessionId, value);
          success = true;
        } else {
          console.warn(`⚠️ Unknown field: ${field}`);
        }
        
        console.log(`✅ Updated ${field}: ${JSON.stringify(value)}`);
      } catch (error) {
        console.error(`❌ Failed to update ${field}:`, error.message);
      }
    }
    
    if (success) {
      console.log('\n📋 Session update completed');
      
      // Show updated session
      const updatedSession = sessionManager.getSession(sessionId);
      console.log(`   Name: ${updatedSession.name}`);
      console.log(`   Jarvis Mode: ${updatedSession.jarvisMode}`);
      console.log(`   Mode: ${updatedSession.mode || '(none)'}`);
      console.log(`   Claude ID: ${updatedSession.claudeSessionId || '(none)'}`);
      if (updatedSession.plan) {
        console.log(`   Plan: ${updatedSession.plan.substring(0, 100)}...`);
      }
    } else {
      console.error('❌ No updates applied');
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

function convertFieldName(field) {
  const fieldMap = {
    'plan': 'plan',
    'jarvis-mode': 'jarvisMode',
    'claude-id': 'claudeSessionId',
    'mode': 'mode'
  };
  
  return fieldMap[field] || field;
}

function parseValue(value) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (value === 'null') return null;
  if (value === 'undefined') return undefined;
  
  // Try to parse as number
  const num = Number(value);
  if (!isNaN(num) && value === num.toString()) {
    return num;
  }
  
  return value;
}

updateSession();