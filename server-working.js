/**
 * 🎯 WORKING TERMINAL SERVER - Exact copy of node-pty example pattern
 * Based on proven node-pty + XTerm.js implementation
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const pty = require('node-pty');
const os = require('os');
const fs = require('fs');
const path = require('path');
const TailingReadableStream = require('tailing-stream');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3002;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// 🎯 EXECUTION COMPLETION DETECTION: Now handled by Stop hook integration

// PROVEN PATTERN: Direct PTY management like node-pty example
class WorkingTerminalManager {
  constructor() {
    this.terminals = new Map();
  }

  createTerminal(sessionId, claudeSessionId = null) {
    if (this.terminals.has(sessionId)) {
      return this.terminals.get(sessionId);
    }

    // Create environment with CLAUDE_SESSION_ID for CLAUDE.md routing
    const terminalEnv = { ...process.env };
    if (claudeSessionId) {
      terminalEnv.CLAUDE_SESSION_ID = claudeSessionId;
    }


    // EXACT node-pty example pattern
    const shell = process.env[os.platform() === 'win32' ? 'COMSPEC' : 'SHELL'];
    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: '/Users/joshuamullet/code',
      env: terminalEnv
    });

    const terminalData = {
      ptyProcess,
      sessionId,
      clients: new Set(),
      created: new Date()
    };

    this.terminals.set(sessionId, terminalData);


    return terminalData;
  }

  getTerminal(sessionId) {
    return this.terminals.get(sessionId);
  }

  writeToTerminal(sessionId, data) {
    const terminal = this.terminals.get(sessionId);
    if (terminal && terminal.ptyProcess) {
      // EXACT node-pty example pattern: direct write to PTY
      terminal.ptyProcess.write(data);
      return true;
    }
    return false;
  }

  resizeTerminal(sessionId, cols, rows) {
    const terminal = this.terminals.get(sessionId);
    if (terminal && terminal.ptyProcess) {
      terminal.ptyProcess.resize(cols, rows);
    }
  }

  killTerminal(sessionId) {
    const terminal = this.terminals.get(sessionId);
    if (terminal) {
      terminal.ptyProcess.kill();
      this.terminals.delete(sessionId);
    }
  }

  listTerminals() {
    return Array.from(this.terminals.keys());
  }

  /**
   * Check if a terminal has active child processes running
   * @param {string} sessionId - Terminal session ID
   * @returns {Promise<boolean>} True if terminal has active processes
   */
  async hasActiveProcesses(sessionId) {
    const terminal = this.terminals.get(sessionId);
    if (!terminal || !terminal.ptyProcess) {
      console.log(`⚠️ Terminal ${sessionId} not found or no process`);
      return false;
    }

    const { spawn } = require('child_process');
    const terminalPid = terminal.ptyProcess.pid;

    try {
      // Use ps to check for child processes of the terminal
      const ps = spawn('ps', ['--ppid', terminalPid.toString(), '-o', 'pid,comm', '--no-headers']);

      return new Promise((resolve) => {
        let output = '';

        ps.stdout.on('data', (data) => {
          output += data.toString();
        });

        ps.on('close', (code) => {
          const processes = output.trim().split('\n').filter(line => line.trim().length > 0);
          const hasActiveChildren = processes.length > 0;

          if (hasActiveChildren) {
            console.log(`🔍 Terminal ${sessionId} (PID: ${terminalPid}) has ${processes.length} active child processes:`);
            processes.forEach(proc => console.log(`  └─ ${proc.trim()}`));
          } else {
            console.log(`💤 Terminal ${sessionId} (PID: ${terminalPid}) is idle - no active child processes`);
          }

          resolve(hasActiveChildren);
        });

        ps.on('error', (err) => {
          console.warn(`⚠️ Failed to check processes for terminal ${sessionId}:`, err.message);
          // Default to false (no active processes) on error
          resolve(false);
        });
      });

    } catch (error) {
      console.warn(`⚠️ Error checking active processes for terminal ${sessionId}:`, error.message);
      return false;
    }
  }
}

const terminalManager = new WorkingTerminalManager();
const SessionManager = require('./lib/SessionManager');
const CorrelationManager = require('./lib/CorrelationManager');

// 📝 SIMPLE SESSION TRACKING: React to file monitor events

// 📁 PROJECT PATH DETECTION: Find project directory for Claude session
function findSessionProjectPath(claudeSessionId) {
  try {
    const claudeProjectsDir = path.join(os.homedir(), '.claude', 'projects');
    const { execSync } = require('child_process');

    // Find the Claude session file across all project directories
    const sessionFileResult = execSync(`find "${claudeProjectsDir}" -name "${claudeSessionId}.jsonl" -type f`, { encoding: 'utf8' }).trim();

    if (sessionFileResult) {
      // Extract project directory from Claude path
      // Example: ~/.claude/projects/-Users-joshuamullet-code-holler/session.jsonl
      // Extract: -Users-joshuamullet-code-holler
      const pathParts = sessionFileResult.split('/');
      const claudeProjectDir = pathParts[pathParts.length - 2]; // Get directory name

      // Convert Claude project directory to actual file system path
      // -Users-joshuamullet-code-holler → /Users/joshuamullet/code/holler
      if (claudeProjectDir.startsWith('-Users-joshuamullet-code')) {
        const projectSuffix = claudeProjectDir.replace('-Users-joshuamullet-code', '');
        if (projectSuffix === '') {
          return '/Users/joshuamullet/code'; // Main code directory
        } else {
          return `/Users/joshuamullet/code${projectSuffix.replace(/-/g, '/')}`; // Sub-project
        }
      }
    }

    // Fallback to main code directory
    return '/Users/joshuamullet/code';
  } catch (error) {
    console.error('❌ Error finding project path:', error);
    return '/Users/joshuamullet/code'; // Safe fallback
  }
}

// 🎯 CONTENT-MATCHING SESSION TRACKER
function findActiveClaudeSession(messageContent, hollerSessionId) {
  // Looking for message content to find active Claude session

  try {
    const claudeProjectsDir = path.join(os.homedir(), '.claude', 'projects');
    if (!fs.existsSync(claudeProjectsDir)) {
      console.error('❌ Claude projects directory not found');
      return null;
    }

    // Search for message content across all session files
    const searchPattern = messageContent.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // Escape regex chars

    // Use grep to find files containing the message
    const grepCommand = `find "${claudeProjectsDir}" -name "*.jsonl" -exec grep -l "${searchPattern}" {} \\;`;

    let matchingFiles = [];
    try {
      const { execSync } = require('child_process');
      const grepResult = execSync(grepCommand, { encoding: 'utf8' });
      matchingFiles = grepResult.trim().split('\n').filter(file => file.length > 0);
    } catch (error) {
      return null;
    }

    if (matchingFiles.length === 0) {
      return null;
    }

    // Found message in session files

    // Get file modification times and find most recent
    const fileStats = matchingFiles.map(filePath => {
      const stats = fs.statSync(filePath);
      const sessionId = path.basename(filePath, '.jsonl');
      return {
        filePath,
        sessionId,
        modifiedTime: stats.mtime,
        size: stats.size
      };
    });

    // Sort by modification time (most recent first)
    fileStats.sort((a, b) => b.modifiedTime - a.modifiedTime);

    const activeSession = fileStats[0];
    // Active session detected

    // Other session candidates available

    return activeSession.sessionId;

  } catch (error) {
    console.error('❌ Error finding active Claude session:', error);
    return null;
  }
}

/**
 * 🎯 FILE MONITOR EVENT SETUP
 * Set up file monitor events with access to Socket.IO for status updates
 */
function setupFileMonitorEvents(fileMonitor, io, sessionManager, terminalManager) {
  // Add event listeners for auto-correlation and status updates
  fileMonitor.on('sessionStart', async (event) => {
    // New Claude session detected, waiting for user message to determine linkage

    // SQLite-only: No need to reload, data is always current
  });

  // 🔗 NEW: PARENT UUID CHAIN CORRELATION - Handle every message for correlation
  fileMonitor.on('correlationRequest', async (event) => {
    try {

      // Call the new correlation function
      const linkedSession = await correlateByParentUuidChain(
        event.sessionId,
        event.parentUuid,
        event.messageUuid,
        sessionManager,
        io
      );
    } catch (error) {
      console.error('❌ CORRELATION REQUEST ERROR:', error);
    }
  });

  fileMonitor.on('userPromptSubmit', async (event) => {
    // User message in session

    // 🎯 STEP 1: RUN CORRELATION FIRST - Find which Holler session should be linked
    let linkedHollerSession = null;
    try {
      // Find the Claude session file across ALL project directories
      const claudeProjectsDir = path.join(os.homedir(), '.claude', 'projects');
      const { execSync } = require('child_process');
      const sessionFileResult = execSync(`find "${claudeProjectsDir}" -name "${event.sessionId}.jsonl" -type f`, { encoding: 'utf8' }).trim();

      if (sessionFileResult) {
        const claudeSessionFile = sessionFileResult;
        // console.log(`📁 FOUND SESSION FILE: ${claudeSessionFile}`);

        // Read the last few lines to find the user message  
        const lastLines = execSync(`tail -5 "${claudeSessionFile}"`, { encoding: 'utf8' });

        // Find user message content
        const lines = lastLines.trim().split('\n');
        for (let i = lines.length - 1; i >= 0; i--) {
          try {
            const data = JSON.parse(lines[i]);
            if (data.type === 'user' && data.message && data.message.content) {
              const messageContent = typeof data.message.content === 'string'
                ? data.message.content
                : data.message.content[0]?.text || '';

              if (messageContent.trim().length > 10 && !messageContent.includes('/Users/joshuamullet/code')) { // Only track substantial messages, ignore project paths
                // 🚫 DISABLED: Auto-correlation (infinite loop source) 
                break; // Found user message, don't need to check other lines
              }
            }
          } catch (e) {
            // Skip malformed JSON lines
          }
        }
      }
    } catch (error) {
      console.error('❌ Error in simple session tracking:', error);
    }

    // 🎯 STEP 2: NOW EMIT STATUS UPDATE (after correlation is done)
    if (linkedHollerSession) {
      console.log(`🟡 STATUS: Holler session ${linkedHollerSession.id} → THINKING (yellow) [Claude: ${event.sessionId}]`);
      io.emit('session:status-update', {
        claudeSessionId: event.sessionId,
        status: 'loading' // Yellow + pulse
      });
    }
  });

  fileMonitor.on('stop', async (event) => {
    console.log('🛑 event:', event)
    const logMessage = `${new Date().toISOString()} 🤖 FILE MONITOR: Claude response detected in session: ${event.sessionId}`;
    // console.log(logMessage);
    fs.appendFileSync('/tmp/file-monitor-test.log', logMessage + '\n');

    // Find Holler session for this Claude session
    let hollerSession = sessionManager.getAllSessions()
      .find(session => session.claudeSessionId === event.sessionId);

    // 🎯 EXECUTION SESSION DETECTION: Check if this is an execution session
    if (!hollerSession && event.isComplete) {
      hollerSession = await checkForExecutionSession(event.sessionId, sessionManager);
    }

    // Stop event received

    // 🟢 STATUS UPDATE: Claude finished response, ready for user input  
    if (event.isComplete) {
      // Claude session ready
      io.emit('session:status-update', {
        claudeSessionId: event.sessionId,
        status: 'ready' // Green
      });

      // Check for autonomous mode

      // SQLite-only: Data is always current, no reload needed

      // Find Holler session to check autonomous mode
      const hollerSession = sessionManager.getAllSessions()
        .find(session => session.claudeSessionId === event.sessionId);

      // Found holler session

      if (hollerSession && hollerSession.autonomousMode) {
        // Generate test message with counter
        const testMessage = `🤖 Autonomous test response ${Date.now()} - Observer AI responding automatically`;

        try {
          // Add delay to let Claude CLI fully settle before sending autonomous message
          setTimeout(() => {

            // Use the EXACT same multi-sequence approach as the working button
            // Method 1: Standard newline
            let success = terminalManager.writeToTerminal(hollerSession.terminalId, testMessage + '\n');
            console.log(`📝 AUTONOMOUS Test 1 (\\n): ${success ? 'Success' : 'Failed'}`);

            // Method 2: Carriage return + newline (after 100ms delay)
            setTimeout(() => {
              success = terminalManager.writeToTerminal(hollerSession.terminalId, '\r\n');
              console.log(`📝 AUTONOMOUS Test 2 (\\r\\n): ${success ? 'Success' : 'Failed'}`);
            }, 100);

            // Method 3: Just carriage return (after 200ms delay)
            setTimeout(() => {
              success = terminalManager.writeToTerminal(hollerSession.terminalId, '\r');
              console.log(`📝 AUTONOMOUS Test 3 (\\r): ${success ? 'Success' : 'Failed'}`);

              if (success) {
                console.log(`✅ AUTONOMOUS SUCCESS: Message sequence sent to Claude session ${hollerSession.claudeSessionId}`);
                console.log(`🎯 CLAUDE CLI RESPONSE COMPLETED!`);
              } else {
                console.error('❌ AUTONOMOUS FAILED: Could not complete terminal sequence');
              }
            }, 200);

          }, 1000); // 1 second delay

        } catch (error) {
          console.error('❌ AUTONOMOUS ERROR:', error);
        }
      } else if (!hollerSession) {
        // No Holler session found for autonomous mode
      } else if (!hollerSession.autonomousMode) {
        // Session autonomous mode check
      }

      // Note: Jarvis mode logic moved outside isComplete check to process every message
    }

    // 🤖 JARVIS MODE: Process EVERY assistant message for TTS (outside isComplete check)
    // Check Jarvis mode for TTS

    if (hollerSession && hollerSession.jarvisMode && hollerSession.mode === 'planning') {
      handleJarvisPlanningCompletion(hollerSession, event, io);
    } else if (hollerSession && hollerSession.jarvisMode && hollerSession.mode === 'execution') {
      handleJarvisExecutionCompletion(hollerSession, event, io, terminalManager);
    } else {
      // Skipping TTS - not in planning mode
    }
  });

  // 🔊 NEW: IMMEDIATE TTS DETECTION - Handle text content as soon as it appears
  fileMonitor.on('assistantTextMessage', async (event) => {

    // Find the Holler session for this Claude session
    const hollerSession = sessionManager.getAllSessions()
      .find(session => session.claudeSessionId === event.sessionId);

    if (hollerSession && hollerSession.jarvisMode && hollerSession.mode === 'planning') {
      // Emit TTS event to frontend immediately
      const ttsPayload = {
        sessionId: hollerSession.id,
        text: event.text,
        timestamp: event.timestamp,
        messageLength: event.messageLength
      };

      io.emit('jarvis-tts', ttsPayload);
    }

  });

  // 🎯 EXECUTION MONITORING: Handle first assistant response for execution sessions
  fileMonitor.on('assistantFirstResponse', async (event) => {
    // Call the handler to check if this session is waiting for first response
    handleFirstExecutionResponse(event.sessionId, event.sessionId);
  });
}

/**
 * Handle Jarvis Mode planning completion - extract and store last assistant message
 */
async function handleJarvisPlanningCompletion(hollerSession, event, io) {
  try {
    // Extract the last assistant message from the Claude session
    const lastMessage = await extractLastAssistantMessage(event.sessionId);

    if (lastMessage) {
      // Store the message in session data for debugging/TTS
      const session = sessionManager.getSession(hollerSession.id);

      if (session) {
        // Check if this is the same message as last time
        const isDuplicate = session.lastAssistantMessage === lastMessage;

        if (!isDuplicate) {
          session.lastAssistantMessage = lastMessage;
          session.lastMessageTimestamp = event.timestamp;
          session.lastMessageCaptured = new Date().toISOString();

          sessionManager.saveSessions();

          // 🔊 TTS: Emit message to frontend for speech synthesis
          const ttsPayload = {
            sessionId: hollerSession.id,
            text: lastMessage,
            timestamp: event.timestamp,
            messageLength: lastMessage.length
          };

          io.emit('jarvis-tts', ttsPayload);
          console.log(`🔊 TTS DEBUG: ✅ Successfully emitted jarvis-tts event (${lastMessage.length} chars)`);
        }
      } else {
        console.log(`❌ TTS DEBUG: Failed to get session from sessionManager`);
      }
    } else {
      console.log(`❌ TTS DEBUG: No message extracted from Claude session`);
    }

    console.log(`🎯 TTS DEBUG: ========== END PLANNING COMPLETION ==========`);
  } catch (error) {
    console.error(`❌ TTS DEBUG: PLANNING ERROR:`, error);
  }
}

/**
 * Check if a Claude session is an execution session by looking at execution mappings
 */
async function checkForExecutionSession(claudeSessionId, sessionManager) {
  try {
    const mappingFile = '/Users/joshuamullet/code/holler/holler-next/execution-mappings.json';
    const mappings = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));

    // Check if there's a pending execution
    if (mappings.pendingExecution) {
      console.log(`🔍 EXECUTION CHECK: Found pending execution for session ${mappings.pendingExecution.hollerSessionId}`);

      // Update mapping with actual execution session ID
      mappings[claudeSessionId] = mappings.pendingExecution;
      delete mappings.pendingExecution;
      fs.writeFileSync(mappingFile, JSON.stringify(mappings, null, 2));

      // Return the original Holler session that started execution
      const hollerSession = sessionManager.getSession(mappings[claudeSessionId].hollerSessionId);
      console.log(`✅ EXECUTION CORRELATION: Linked execution session ${claudeSessionId} to Holler session ${hollerSession?.id}`);
      return hollerSession;
    }

    // Check if this session ID is already mapped
    if (mappings[claudeSessionId]) {
      const hollerSession = sessionManager.getSession(mappings[claudeSessionId].hollerSessionId);
      console.log(`✅ EXECUTION CORRELATION: Found existing mapping for ${claudeSessionId} → ${hollerSession?.id}`);
      return hollerSession;
    }

  } catch (error) {
    console.log(`⚠️ EXECUTION CHECK: Could not read execution mappings: ${error.message}`);
  }

  return null;
}

/**
 * Handle Jarvis Mode execution completion - switch back to planning mode
 */
async function handleJarvisExecutionCompletion(hollerSession, event, io, terminalManager) {
  try {
    // Update session mode from execution → planning
    const session = sessionManager.getSession(hollerSession.id);
    if (session) {
      console.log(`🔄 JARVIS EXECUTION: Switching session ${hollerSession.id} from execution → planning mode`);
      session.mode = 'planning';
      session.lastUpdated = new Date().toISOString();

      console.log(`✅ JARVIS EXECUTION: Mode switch complete for session ${hollerSession.id}`);

      // Schedule planning prompt injection after a short delay
      setTimeout(async () => {
        await injectPlanningPrompt(hollerSession, terminalManager, io);
      }, 2000); // 2 second delay to ensure execution is fully complete

    } else {
      console.error(`❌ JARVIS EXECUTION: Could not find session ${hollerSession.id} for mode switch`);
    }

  } catch (error) {
    console.log(`🔍 EXECUTION-DEBUG: ❌ EXCEPTION IN handleJarvisExecutionCompletion: ${error.message}`);
    console.error(`❌ JARVIS EXECUTION ERROR:`, error);
  }
}

/**
 * Build unified planning prompt with context-specific intro
 */
function buildPlanningPrompt(sessionId, contextType = 'initial') {
  const contextIntro = contextType === 'post-execution'
    ? `## Execution Complete - Planning Mode Resumed

Check what was executed and identify any issues or next steps.`
    : `🤖 **JARVIS PLANNING MODE**

Check for context above to understand what we're working on.`;

  return `${contextIntro}

## Your Goal
Create a plan that will be handled by another coding agent. **You do NOT code anything yourself.**

Work with the user to build this plan and store it in the database. When they're ready, the plan will automatically activate.

## Plan Management Scripts
**Session ID:** ${sessionId}

- Check current plan: \`node /Users/joshuamullet/code/holler/holler-next/scripts/db-viewer.js sessions\`
- Store plan: \`node /Users/joshuamullet/code/holler/holler-next/scripts/set-plan.js ${sessionId} "plan content"\`

## User Context
- User is not looking at screen - keep responses short
- **DO NOT enter Claude Code voice mode**
- Ask simple questions, give direct answers

## Plan Format
Make the plan actionable for the execution agent:
- Include necessary codebase context
- Specify exactly what needs to be done  
- List files to examine
- Note any constraints`;
}

/**
 * Inject planning prompt to restart the planning cycle
 */
async function injectPlanningPrompt(hollerSession, terminalManager, io) {
  try {
    console.log(`\n🎯 JARVIS PLANNING: Injecting planning prompt for session ${hollerSession.id}`);
    console.log(`📋 PLANNING INJECTION SESSION DETAILS:`);
    console.log(`   Holler Session ID: ${hollerSession.id}`);
    console.log(`   Terminal ID: ${hollerSession.terminalId}`);
    console.log(`   Current Claude Session ID: ${hollerSession.claudeSessionId}`);
    console.log(`   Mode: ${hollerSession.mode}`);
    console.log(`   Jarvis Mode: ${hollerSession.jarvisMode}`);

    const planningPrompt = buildPlanningPrompt(hollerSession.id, 'post-execution');
    console.log(`📝 Planning prompt length: ${planningPrompt.length} chars`);

    // Send the planning prompt to the terminal
    const terminal = terminalManager.getTerminal(hollerSession.terminalId);
    if (terminal) {
      console.log(`✅ Terminal found for ${hollerSession.terminalId}`);
      console.log(`📤 Writing planning prompt directly to terminal`);

      // Send the prompt directly to terminal
      terminalManager.writeToTerminal(hollerSession.terminalId, planningPrompt);
      
      // Use the WORKING pattern from scheduled command execution
      setTimeout(() => {
        console.log(`⚡ JARVIS PLANNING: Sending execution signal to ${hollerSession.terminalId}`);
        if (terminal && terminal.ptyProcess) {
          terminal.ptyProcess.write('\r'); // Send enter directly through PTY
        }
      }, 1000); // Same delay as working scheduled commands

      console.log(`✅ JARVIS PLANNING: Planning prompt injected successfully`);
    } else {
      console.error(`❌ JARVIS PLANNING: Terminal ${hollerSession.terminalId} not found`);
    }

  } catch (error) {
    console.error(`❌ JARVIS PLANNING INJECTION ERROR:`, error);
  }
}

// 🗑️ REMOVED: Plan functions - plans now stored in SQLite database
// Use sessionManager.getSessionPlan() and sessionManager.updateSessionPlan() instead

/**
 * Extract the last assistant message from a Claude session file
 */
async function extractLastAssistantMessage(claudeSessionId) {
  try {
    // Get Claude project directory
    const claudeProjectDir = sessionManager.getClaudeProjectDir();
    const sessionFile = path.join(claudeProjectDir, `${claudeSessionId}.jsonl`);

    if (!fs.existsSync(sessionFile)) {
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
 * 🔗 NEW: PARENT UUID CHAIN CORRELATION
 * 
 * Simple approach: For every message, check if its parentUuid exists in any Holler session's chain.
 * If found, update that session to point to the current Claude sessionId.
 * This creates an "infinite chain" that always tracks the latest sessionId.
 */
async function correlateByParentUuidChain(sessionId, parentUuid, messageUuid, sessionManager, io) {
  try {

    // STEP 1: Handle new sessions (no parentUuid)
    if (!parentUuid || parentUuid === null) {

      // Use existing new session logic
      const event = { sessionId, parentUuid, uuid: messageUuid };
      const linkedSession = await handleNewSession(event, sessionManager, io);

      // 🔗 CRITICAL FIX: Set the first message's UUID to start the chain!
      if (linkedSession && messageUuid) {
        console.log(`🔗 STARTING CHAIN: Setting first UUID ${messageUuid} for session ${linkedSession.id}`);
        correlationManager.updateLastUuid(linkedSession.id, messageUuid);
      }

      return linkedSession;
    }

    // STEP 2: Search correlation manager for this parentUuid (hot path lookup)
    const matchingSessionId = correlationManager.findSessionByParentUuid(parentUuid);
    const matchingSession = matchingSessionId ? sessionManager.getSession(matchingSessionId) : null;

    if (matchingSession) {

      // Update the session's claudeSessionId to current sessionId
      const updateSuccess = sessionManager.updateSessionWithClaude(matchingSession.id, sessionId);

      if (updateSuccess) {
        // Update correlation manager with current message UUID (hot path)
        correlationManager.updateLastUuid(matchingSession.id, messageUuid);

        // Real-time sync
        if (io) {
          io.emit('session:updated', {
            sessionId: matchingSession.id,
            claudeSessionId: sessionId,
            timestamp: new Date().toISOString()
          });
        }

        return matchingSession;
      }
    }

    return null;
  } catch (error) {
    console.error('❌ CHAIN CORRELATION ERROR:', error);
    return null;
  }
}

/**
 * 🚫 OLD: PARENT UUID CORRELATION (Kept for fallback)
 * 
 * NEW SIMPLIFIED CORRELATION: Parent UUID-based deterministic session linking
 * No more guessing - know definitively what to do based on parentUuid
 * 
 * ⚠️ DISABLED: This approach caused infinite loops due to filesystem scanning
 */
async function handleSessionCorrelation(event, sessionManager, io) {
  try {
    console.log(`🎯 PARENT UUID CORRELATION: Processing session ${event.sessionId}`);
    console.log(`🔍 Parent UUID: ${event.parentUuid}`);

    // STEP 1: Brand new session detection
    if (event.parentUuid === null) {
      console.log(`🆕 NEW SESSION DETECTED: parentUuid is null - this is a brand new conversation`);
      return await handleNewSession(event, sessionManager, io);
    }

    // STEP 2: Session switch detection  
    console.log(`🔄 EXISTING CONVERSATION: parentUuid exists - checking for session switches`);
    return await handleSessionSwitch(event, sessionManager, io);

  } catch (error) {
    console.error('❌ SESSION CORRELATION ERROR:', error);
    return null;
  }
}

/**
 * Handle brand new sessions (parentUuid === null)
 */
async function handleNewSession(event, sessionManager, io) {
  console.log(`🆕 HANDLING NEW SESSION: ${event.sessionId}`);

  // Find first Holler session without a Claude session ID
  const allSessions = sessionManager.getAllSessions();
  const unlinkedSession = allSessions.find(session => !session.claudeSessionId);

  if (unlinkedSession) {
    console.log(`🔗 LINKING NEW SESSION: Holler ${unlinkedSession.id} ↔ Claude ${event.sessionId}`);

    const linkSuccess = sessionManager.updateSessionWithClaude(unlinkedSession.id, event.sessionId);

    if (linkSuccess) {
      console.log(`✅ NEW SESSION LINKED: ${unlinkedSession.id} ↔ ${event.sessionId}`);

      // Real-time sync
      if (io) {
        io.emit('session:updated', {
          sessionId: unlinkedSession.id,
          claudeSessionId: event.sessionId,
          timestamp: new Date().toISOString()
        });
      }

      return unlinkedSession;
    }
  } else {
    console.log(`⚠️ NEW SESSION: No unlinked Holler sessions available`);
  }

  return null;
}

/**
 * 🚫 OLD: Handle session switches (parentUuid !== null) - DISABLED 
 * 
 * ⚠️ INFINITE LOOP SOURCE: This function scans filesystem with grep, causing cascading file events
 * REPLACED BY: correlateByParentUuidChain() which uses simple JSON lookups instead
 */
async function handleSessionSwitch(event, sessionManager, io) {
  console.log(`🚫 OLD SESSION SWITCH: Function disabled - using parentUuid chain correlation instead`);
  return null;

  /* 🚫 COMMENTED OUT: Filesystem scanning logic that caused infinite loops
  
  console.log(`🔄 CHECKING SESSION SWITCH: ${event.sessionId}`);

  // Check if this session is already linked - if so, ignore
  const allSessions = sessionManager.getAllSessions();
  const existingLink = allSessions.find(session => session.claudeSessionId === event.sessionId);

  if (existingLink) {
    console.log(`✅ SESSION ALREADY LINKED: ${existingLink.id} ↔ ${event.sessionId} - ignoring`);
    return existingLink;
  }

  // Check if parentUuid exists in multiple files (session switch indicator)
  const claudeProjectsDir = path.join(os.homedir(), '.claude', 'projects');

  try {
    const { execSync } = require('child_process');
    const grepResult = execSync(`find "${claudeProjectsDir}" -name "*.jsonl" -exec grep -l "${event.parentUuid}" {} \\;`, { encoding: 'utf8' });
    const filesWithParent = grepResult.trim().split('\n').filter(file => file.length > 0);

    console.log(`🔍 PARENT UUID SEARCH: Found ${filesWithParent.length} files containing parentUuid ${event.parentUuid}`);

    if (filesWithParent.length > 1) {
      console.log(`🔄 SESSION SWITCH DETECTED: Same parentUuid in multiple files`);

      // Find the older file (session switch source)
      const filesWithStats = filesWithParent.map(filePath => {
        const stats = fs.statSync(filePath);
        const sessionId = path.basename(filePath, '.jsonl');
        return { filePath, sessionId, modTime: stats.mtime };
      });

      // Sort by modification time (oldest first for switch source)
      filesWithStats.sort((a, b) => a.modTime - b.modTime);
      const olderFile = filesWithStats[0];

      console.log(`📁 OLDER FILE: ${olderFile.sessionId} → NEWER FILE: ${event.sessionId}`);

      // Check if older session is linked to Holler
      const hollerSession = allSessions.find(session => session.claudeSessionId === olderFile.sessionId);

      if (hollerSession) {
        console.log(`🔄 SESSION SWITCH CONFIRMED: Updating ${hollerSession.id} from ${olderFile.sessionId} → ${event.sessionId}`);

        const updateSuccess = sessionManager.updateSessionWithClaude(hollerSession.id, event.sessionId);

        if (updateSuccess) {
          console.log(`✅ SESSION SWITCH COMPLETE: ${hollerSession.id} now points to ${event.sessionId}`);

          // Real-time sync
          if (io) {
            io.emit('session:updated', {
              sessionId: hollerSession.id,
              claudeSessionId: event.sessionId,
              timestamp: new Date().toISOString()
            });
          }

          return hollerSession;
        }
      } else {
        console.log(`⚠️ SESSION SWITCH: Older session ${olderFile.sessionId} not linked to Holler - ignoring`);
      }
    } else {
      console.log(`⚠️ SESSION SWITCH: parentUuid only in one file - not a session switch`);
    }

  } catch (error) {
    console.log(`⚠️ SESSION SWITCH: Error searching for parentUuid - ${error.message}`);
  }

  return null;
  
  */ // End of commented out filesystem scanning logic
}

// 🗑️ DEMOLISHED: Priority-based guessing logic replaced with parentUuid deterministic correlation

/**
 * 🔍 Claude Session Discovery Service
 * Mimics Claudia's project-based session discovery approach
 * Monitors ~/.claude/projects directory for new sessions and correlates them
 */
class ClaudeSessionDiscoveryService {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
    this.claudeProjectsDir = path.join(os.homedir(), '.claude', 'projects');
    this.lastDiscoveryTime = Date.now();
    this.discoveryInterval = null;

    console.log(`🔍 Claude Session Discovery: Monitoring ${this.claudeProjectsDir}`);
  }

  /**
   * Start periodic discovery of new Claude sessions
   */
  startDiscovery() {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
    }

    // Check every 5 seconds for new sessions (similar to Claudia's real-time updates)
    this.discoveryInterval = setInterval(() => {
      this.discoverNewSessions();
    }, 5000);

    console.log('🔍 Claude Session Discovery: Started periodic scanning');
  }

  /**
   * Stop discovery
   */
  stopDiscovery() {
    if (this.discoveryInterval) {
      clearInterval(this.discoveryInterval);
      this.discoveryInterval = null;
      console.log('🔍 Claude Session Discovery: Stopped');
    }
  }

  /**
   * Discover new Claude sessions by scanning projects directory
   * Similar to Claudia's listProjects() and getProjectSessions() approach
   */
  async discoverNewSessions() {
    try {
      if (!fs.existsSync(this.claudeProjectsDir)) {
        return; // No Claude projects directory yet
      }

      const projects = fs.readdirSync(this.claudeProjectsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      for (const projectDir of projects) {
        await this.scanProjectForNewSessions(projectDir);
      }
    } catch (error) {
      console.error('🔍 Error during session discovery:', error);
    }
  }

  /**
   * Scan a specific project directory for new sessions
   */
  async scanProjectForNewSessions(projectDir) {
    try {
      const projectPath = path.join(this.claudeProjectsDir, projectDir);
      const files = fs.readdirSync(projectPath);

      // Look for .jsonl files (session files)
      const sessionFiles = files.filter(file => file.endsWith('.jsonl'));

      for (const sessionFile of sessionFiles) {
        const sessionId = sessionFile.replace('.jsonl', '');
        const sessionFilePath = path.join(projectPath, sessionFile);

        // Check if this is a new session (created after last discovery)
        const stats = fs.statSync(sessionFilePath);
        if (stats.mtime.getTime() > this.lastDiscoveryTime) {
          await this.handleNewClaudeSession(sessionId, projectDir, sessionFilePath);
        }
      }
    } catch (error) {
      // Ignore errors for individual projects (might be permission issues)
    }
  }

  /**
   * Handle discovery of a new Claude session
   */
  async handleNewClaudeSession(claudeSessionId, projectDir, sessionFilePath) {
    try {
      console.log(`🔍 New Claude session discovered: ${claudeSessionId} in project ${projectDir}`);

      // Decode project path (similar to Claudia's Project.path decoding)
      const decodedProjectPath = this.decodeProjectPath(projectDir);
      console.log(`🔍 Decoded project path: ${decodedProjectPath}`);

      // Try to find a matching Holler session that needs Claude correlation
      const unlinkedSession = this.sessionManager.getAllSessions()
        .find(session =>
          !session.claudeSessionId && // Not already linked
          this.isProjectPathMatch(session.projectPath, decodedProjectPath)
        );

      if (unlinkedSession) {
        console.log(`🔗 Correlating new Claude session ${claudeSessionId} with Holler session ${unlinkedSession.id}`);

        // Link the sessions
        this.sessionManager.updateSessionWithClaude(unlinkedSession.id, claudeSessionId);

        console.log(`✅ Session correlation successful: ${unlinkedSession.id} ↔ ${claudeSessionId}`);
      } else {
        console.log(`🔍 No matching Holler session found for Claude session ${claudeSessionId} in ${decodedProjectPath}`);
      }

    } catch (error) {
      console.error(`🔍 Error handling new Claude session ${claudeSessionId}:`, error);
    }
  }

  /**
   * Decode Claude project directory name back to original path
   * Similar to Claudia's Project.path decoding logic
   */
  decodeProjectPath(projectDir) {
    try {
      // Claude encodes project paths using URL encoding
      return decodeURIComponent(projectDir);
    } catch (error) {
      return projectDir; // Fallback to original if decoding fails
    }
  }

  /**
   * Check if two project paths match (allowing for some flexibility)
   */
  isProjectPathMatch(hollerPath, claudePath) {
    if (!hollerPath || !claudePath) return false;

    // Direct match
    if (hollerPath === claudePath) return true;

    // Check if one is a substring of the other (for flexibility)
    if (hollerPath.includes(claudePath) || claudePath.includes(hollerPath)) return true;

    return false;
  }

  /**
   * Update last discovery time
   */
  updateLastDiscoveryTime() {
    this.lastDiscoveryTime = Date.now();
  }
}

/**
 * 🔍 Check network activity for a Claude PID
 * Returns CPU% and connection count to determine if Claude is active
 */
/**
 * Parse time string (MM:SS.ss or HH:MM:SS) to seconds
 */
// 🗑️ REMOVED parseTimeToSeconds - no longer needed

    terminalId,
    startTime: Date.now()
  });

  console.log(`🎯 EXEC TRACE: [1/5] ✅ Session registered, waiting for Claude to respond...`);
}

/**
 * 🎯 Handle first assistant response for execution session
 */
function handleFirstExecutionResponse(sessionId, claudeSessionId) {
  // Find the Holler session that corresponds to this Claude session
  const hollerSession = sessionManager.getAllSessions()
    .find(session => session.claudeSessionId === claudeSessionId);

  if (!hollerSession) {
    return;
  }

  // 🚫 DISABLED: Old execution monitoring replaced with Stop hook detection
  console.log(`🎯 EXEC TRACE: [2/5] 🚫 Session ${hollerSession.id} not waiting for response - ignoring`);
}

/**
 * 🎯 Handle execution completion (moved from terminal logic)
 */
async function handleExecutionCompletion(sessionId) {
  console.log(`🎯 EXEC TRACE: [5/5] 🏁 Processing execution completion for session ${sessionId}`);

  try {
    // Find the Holler session by session ID
    const hollerSession = sessionManager.getSession(sessionId);
    if (!hollerSession) {
      console.error(`🎯 EXEC TRACE: [5/5] ❌ Session ${sessionId} not found`);
      return;
    }

    console.log(`🎯 EXEC TRACE: [5/5] 🔄 Switching session ${sessionId} back to planning mode`);
    const updated = sessionManager.db.updateSession(sessionId, {
      mode: 'planning'
    });

    if (updated) {
      console.log(`🎯 EXEC TRACE: [5/5] ✅ Session switched to planning mode`);

      // Build and send planning restart message
      const planningRestartPrompt = `## Execution Complete - Planning Mode Resumed

Great work! The execution phase has completed and I'm now back in planning mode.

**What would you like to work on next?**

I can help you:
- 🛠️ Plan new features or improvements
- 🔧 Analyze and fix issues  
- 📊 Review and optimize code
- 🧪 Create tests
- 📝 Add documentation

Just describe what you'd like to accomplish and I'll create a detailed plan.

**Session ID**: ${sessionId}
**Mode**: PLANNING (ready for next task)

What's our next mission?`;

      console.log(`📝 EXECUTION COMPLETION: Sending planning restart prompt to terminal ${hollerSession.terminalId}`);

      // Step 1: Write the message (paste it)
      const promptSuccess = terminalManager.writeToTerminal(hollerSession.terminalId, planningRestartPrompt + '\n');

      if (promptSuccess) {
        // Step 2: Submit the message after a brief delay
        setTimeout(() => {
          console.log(`🚀 EXECUTION COMPLETION: Submitting planning restart prompt to ${hollerSession.terminalId}`);
          const terminal = terminalManager.getTerminal(hollerSession.terminalId);
          if (terminal && terminal.ptyProcess) {
            terminal.ptyProcess.write('\r'); // Send enter through PTY
            console.log(`🎯 EXECUTION COMPLETION: ✅ Planning restart completed for session ${sessionId}`);
          } else {
            console.error(`❌ EXECUTION COMPLETION: Could not find terminal ${hollerSession.terminalId} to submit message`);
          }
        }, 1000); // 1 second delay for the paste to settle
      } else {
        console.error(`❌ EXECUTION COMPLETION: Failed to send planning prompt to terminal ${hollerSession.terminalId}`);
      }
    } else {
      console.error(`❌ EXECUTION COMPLETION: Failed to update session ${sessionId} mode`);
    }
  } catch (error) {
    console.error(`❌ EXECUTION COMPLETION: Error processing completion for session ${sessionId}:`, error);
  }
}

const sessionManager = new SessionManager();
const correlationManager = new CorrelationManager(sessionManager.db); // Share database instance
const claudeDiscoveryService = new ClaudeSessionDiscoveryService(sessionManager);

// TESTING: Basic file monitoring to replace hooks
const SessionFileMonitor = require('./lib/SessionFileMonitor');
console.log('🧪 TESTING: Initializing basic file monitoring...');
const fileMonitor = new SessionFileMonitor();

// Start monitoring with heavy logging for testing
fileMonitor.startMonitoring().then(() => {
  console.log('📁 File monitoring started - watching for Claude session activity');
}).catch(error => {
  console.error('❌ Failed to start file monitoring:', error);
});

// 🧪 REMOVED: Tail stream debug test

// Claude session detection using real-time Claude Code hooks
console.log('🎯 Using Claude Code hooks for real-time session correlation');

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    const parsedUrl = parse(req.url, true);


    // Handle Claude session events from hooks
    if (parsedUrl.pathname === '/api/claude-session-event' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', () => {
        try {
          const eventData = JSON.parse(body);
          const { sessionId, timestamp, hookType } = eventData;

          console.log(`\n🎯🎯🎯 CLAUDE SESSION EVENT RECEIVED 🎯🎯🎯`);
          console.log(`📊 Hook Type: ${hookType}`);
          console.log(`🆔 Session ID: ${sessionId}`);
          console.log(`⏰ Timestamp: ${timestamp}`);
          console.log(`📦 Full Event Data:`, JSON.stringify(eventData, null, 2));
          console.log(`🎯🎯🎯 END CLAUDE SESSION EVENT 🎯🎯🎯\n`);

          console.log(`🚨 DISABLED: Hook-based correlation replaced by file monitor system`);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, sessionId }));

        } catch (error) {
          console.error('❌ Error processing Claude session event:', error);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid event data' }));
        }
      });

      return;
    }

    // 🎯 NEW: Hook-based execution completion detection  
    if (parsedUrl.pathname === '/api/session-status-update' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', async () => {
        try {
          console.log(`\n🎯🎯🎯 STOP HOOK API CALLED 🎯🎯🎯`);
          console.log(`📦 Raw body: ${body}`);

          const { claudeSessionId, status, hookType, timestamp } = JSON.parse(body);

          console.log(`📊 Parsed data:`);
          console.log(`   claudeSessionId: ${claudeSessionId}`);
          console.log(`   status: ${status}`);
          console.log(`   hookType: ${hookType}`);
          console.log(`   timestamp: ${timestamp}`);

          if (status === 'ready' && hookType === 'Stop') {
            console.log(`✅ Conditions met: status=ready, hookType=Stop`);

            // Find Holler session by Claude session ID
            const allSessions = sessionManager.getAllSessions();
            console.log(`📋 Searching through ${allSessions.length} Holler sessions for claudeSessionId: ${claudeSessionId}`);

            allSessions.forEach((session, index) => {
              console.log(`   Session ${index + 1}: id=${session.id}, claudeSessionId=${session.claudeSessionId}, mode=${session.mode}, jarvis=${session.jarvisMode}`);
            });

            const hollerSession = allSessions.find(session => session.claudeSessionId === claudeSessionId);

            if (hollerSession) {
              console.log(`🎯 FOUND HOLLER SESSION: ${hollerSession.id}`);
              console.log(`   mode: ${hollerSession.mode}`);
              console.log(`   jarvisMode: ${hollerSession.jarvisMode}`);

              if (hollerSession.mode === 'execution' && hollerSession.jarvisMode) {
                console.log(`🏁 EXECUTION COMPLETE: All conditions met, switching to planning mode`);

                // Switch back to planning mode
                const updated = sessionManager.db.updateSession(hollerSession.id, {
                  mode: 'planning'
                });

                console.log(`📝 Database update result: ${updated}`);

                if (updated) {
                  console.log(`✅ SUCCESS: Session ${hollerSession.id} switched to planning mode`);

                  // Emit status update to frontend
                  io.emit('session:status-update', {
                    claudeSessionId,
                    status: 'ready'
                  });

                  console.log(`📡 Emitted status update to frontend`);

                  // Trigger planning prompt injection (using existing function)
                  console.log(`🎯 HOOK COMPLETION: Triggering planning prompt injection`);
                  await handleJarvisExecutionCompletion(hollerSession, { sessionId: claudeSessionId }, io, terminalManager);

                } else {
                  console.error(`❌ FAILED: Database update failed for session ${hollerSession.id}`);
                }
              } else {
                console.log(`⚠️ SKIP: Session ${hollerSession.id} not in execution+jarvis mode`);
                console.log(`   Expected: mode='execution' && jarvisMode=true`);
                console.log(`   Actual: mode='${hollerSession.mode}' && jarvisMode=${hollerSession.jarvisMode}`);
              }
            } else {
              console.log(`❌ NO MATCH: No Holler session found with claudeSessionId: ${claudeSessionId}`);
            }
          } else {
            console.log(`⚠️ SKIP: Conditions not met`);
            console.log(`   Expected: status='ready' && hookType='Stop'`);
            console.log(`   Actual: status='${status}' && hookType='${hookType}'`);
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, claudeSessionId, status }));

        } catch (error) {
          console.error('❌ Error processing session status update:', error);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid status update data' }));
        }
      });

      return;
    }

    // Handle terminal cleanup requests from API routes
    if (parsedUrl.pathname === '/api/sessions/delete' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });

      req.on('end', () => {
        try {
          const { sessionId, terminalId } = JSON.parse(body);
          console.log(`🗑️ Terminal cleanup request received for session: ${sessionId}, terminal: ${terminalId}`);

          if (sessionId) {
            // Kill the terminal instance using sessionId (server stores terminals by sessionId key)
            terminalManager.killTerminal(sessionId);
            console.log(`💀 Killed terminal for session ${sessionId}`);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              sessionId,
              terminalId
            }));
          } else {
            console.log(`⚠️ No terminal ID provided for session: ${sessionId}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              success: true,
              sessionId,
              message: 'No terminal to cleanup'
            }));
          }

        } catch (error) {
          console.error('❌ Error processing terminal cleanup:', error);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid cleanup request' }));
        }
      });

      return;
    }

    // Handle DELETE session requests (RESTful: DELETE /api/sessions/{sessionId})
    if (parsedUrl.pathname.startsWith('/api/sessions/') && req.method === 'DELETE') {
      const sessionId = parsedUrl.pathname.split('/api/sessions/')[1];
      console.log(`🗑️ DELETE request received for session: ${sessionId}`);

      const errors = [];
      let jsonDeleted = false;
      let terminalKilled = false;

      let sessionManager;

      try {
        // Delete from backend session manager (SQLite)
        sessionManager = new SessionManager();
        const result = sessionManager.deleteSession(sessionId);

        if (result.success) {
          jsonDeleted = true;
          console.log(`✅ Session ${sessionId} deleted from backend`);
        } else {
          errors.push(`Session not found in JSON: ${result.error}`);
          console.log(`⚠️ Session ${sessionId} not found in backend storage`);
        }
      } catch (error) {
        errors.push(`Backend deletion failed: ${error.message}`);
        console.error(`❌ Backend deletion failed for ${sessionId}:`, error);
      }

      try {
        // Also clean up terminal
        terminalManager.killTerminal(sessionId);
        terminalKilled = true;
        console.log(`✅ Terminal killed for session: ${sessionId}`);
      } catch (error) {
        errors.push(`Terminal cleanup failed: ${error.message}`);
        console.error(`❌ Terminal cleanup failed for ${sessionId}:`, error);
      }

      // Clean up correlations using shared database instance
      try {
        const CorrelationManager = require('./lib/CorrelationManager');
        const correlationManager = new CorrelationManager(sessionManager?.db);
        correlationManager.removeCorrelation(sessionId);
        console.log(`🔗 Cleaned up correlation for session ${sessionId}`);
      } catch (error) {
        errors.push(`Correlation cleanup failed: ${error.message}`);
        console.warn(`⚠️ Correlation cleanup failed for ${sessionId}:`, error.message);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        details: {
          sessionId,
          jsonDeleted,
          terminalKilled,
          errors,
          timestamp: new Date().toISOString()
        }
      }));

      return;
    }

    await handle(req, res, parsedUrl);
  });

  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // Set up file monitor event listeners with access to io
  setupFileMonitorEvents(fileMonitor, io, sessionManager, terminalManager);

  /**
   * 🤖 JARVIS MODE: Send planning prompt to existing session (simplified approach)
   */
  async function sendPlanningPromptToSession(sessionId, sessionManager, io) {
    try {
      console.log(`🤖 JARVIS: Sending planning prompt to existing session: ${sessionId}`);

      const session = sessionManager.getSession(sessionId);
      if (!session) {
        console.error(`❌ JARVIS: Session ${sessionId} not found`);
        return;
      }

      // Build the unified planning prompt
      const planningPrompt = buildPlanningPrompt(sessionId, 'initial');

      // Send the planning prompt to the existing session
      console.log(`📤 JARVIS: Sending planning prompt to terminal ${session.terminalId}`);

      const success = terminalManager.writeToTerminal(session.terminalId, planningPrompt + '\n');

      if (!success) {
        console.error(`❌ JARVIS: Failed to write planning prompt to terminal ${session.terminalId}`);
        return;
      }

      // Send enter to submit the prompt (after a short delay for paste)
      setTimeout(() => {
        console.log(`🚀 JARVIS: Submitting planning prompt to ${session.terminalId}`);
        const terminal = terminalManager.getTerminal(session.terminalId);
        if (terminal && terminal.ptyProcess) {
          terminal.ptyProcess.write('\r'); // Send enter through PTY
        }
      }, 1000);

      console.log(`✅ JARVIS: Planning prompt sent to existing session ${sessionId}`);

    } catch (error) {
      console.error('❌ JARVIS: Error sending planning prompt to session:', error);
    }
  }

  /**
   * 🤖 JARVIS MODE: Start Planner cycle by cloning session (DEPRECATED - keeping for reference)
   */
  async function startJarvisPlannerCycle_DEPRECATED(executorSessionId, sessionManager, io) {
    try {
      console.log(`🤖 JARVIS: Starting Planner cycle for executor session: ${executorSessionId}`);

      // Get the executor session details
      const executorSession = sessionManager.getSession(executorSessionId);
      if (!executorSession) {
        console.error(`❌ JARVIS: Executor session ${executorSessionId} not found`);
        return;
      }

      if (!executorSession.claudeSessionId) {
        console.error(`❌ JARVIS: Executor session ${executorSessionId} has no Claude session to clone`);
        return;
      }

      // Generate new IDs for the Planner session
      const timestamp = Date.now();
      const plannerHollerSessionId = `jarvis-planner-${timestamp}`;
      const plannerClaudeSessionId = generateUUID();
      const plannerTerminalId = `jarvis-terminal-${timestamp}`;

      console.log(`🧬 JARVIS: Cloning session ${executorSession.claudeSessionId} → ${plannerClaudeSessionId}`);

      // Clone the conversation using existing method
      const cloneResult = await fetch('http://localhost:3002/api/sessions/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalClaudeSessionId: executorSession.claudeSessionId,
          newClaudeSessionId: plannerClaudeSessionId
        })
      });

      if (!cloneResult.ok) {
        const errorData = await cloneResult.json();
        throw new Error(errorData.error || 'Failed to clone conversation for Planner');
      }

      const cloneData = await cloneResult.json();
      console.log(`✅ JARVIS: Conversation cloned successfully: ${cloneData.messageCount} messages`);

      // Create Planner Holler session
      const plannerSession = {
        id: plannerHollerSessionId,
        name: `🤖 Jarvis Planner (${executorSession.name})`,
        terminalId: plannerTerminalId,
        claudeSessionId: plannerClaudeSessionId,
        created: new Date().toISOString(),
        projectPath: executorSession.projectPath || '/Users/joshuamullet/code/holler',
        isJarvisPlanner: true,
        parentExecutorSession: executorSessionId
      };

      // Add Planner session to session manager
      sessionManager.addSession(plannerSession);

      // Launch Planner session with comprehensive prompt
      await launchPlannerSession(plannerSession, io);

      console.log(`🚀 JARVIS: Planner cycle started successfully: ${plannerHollerSessionId}`);

    } catch (error) {
      console.error('❌ JARVIS: Error starting Planner cycle:', error);
    }
  }

  /**
   * 🧠 JARVIS: Launch Planner session with comprehensive prompt
   */
  async function launchPlannerSession(plannerSession, io) {
    try {
      console.log(`🧠 JARVIS: Launching Planner session: ${plannerSession.id}`);

      // Emit session creation to establish terminal connection
      io.emit('session:created', plannerSession);

      // Wait a moment for terminal to be ready, then start the Claude session
      setTimeout(async () => {
        await startClaudeSessionInTerminal(plannerSession, io);
      }, 2000); // 2 second delay to ensure terminal is ready

      console.log(`✅ JARVIS: Planner session launched: ${plannerSession.id}`);

    } catch (error) {
      console.error('❌ JARVIS: Error launching Planner session:', error);
    }
  }

  /**
   * 🧠 JARVIS: Start Claude session in terminal for Planner
   */
  async function startClaudeSessionInTerminal(plannerSession, io) {
    try {
      console.log(`🔥 JARVIS: Starting Claude session in terminal for: ${plannerSession.id}`);
      console.log(`🔥 JARVIS: Using terminal ID: ${plannerSession.terminalId}`);

      // Wait for terminal to be actually created by polling
      const maxAttempts = 20; // 10 seconds max
      let attempts = 0;

      const waitForTerminal = () => {
        return new Promise((resolve, reject) => {
          const checkTerminal = () => {
            attempts++;
            console.log(`🔍 JARVIS: Checking for terminal (attempt ${attempts}/${maxAttempts})`);

            const terminalExists = terminalManager.terminals.has(plannerSession.terminalId);

            if (terminalExists) {
              console.log(`✅ JARVIS: Terminal found: ${plannerSession.terminalId}`);
              resolve(true);
            } else if (attempts >= maxAttempts) {
              console.error(`❌ JARVIS: Terminal not found after ${maxAttempts} attempts`);
              console.log(`🔍 JARVIS: Available terminals:`, Array.from(terminalManager.terminals.keys()));
              reject(new Error('Terminal not found'));
            } else {
              setTimeout(checkTerminal, 500); // Check every 500ms
            }
          };

          checkTerminal();
        });
      };

      // Wait for terminal to be ready
      await waitForTerminal();

      // Send the holler command to start a fresh Claude session (cloned conversation will be in the prompt)
      const hollerCommand = `holler\n`;
      console.log(`💻 JARVIS: Executing command: ${hollerCommand.trim()}`);

      const success = terminalManager.writeToTerminal(plannerSession.terminalId, hollerCommand);

      if (!success) {
        console.error(`❌ JARVIS: Failed to write to terminal ${plannerSession.terminalId}`);
        console.log(`🔍 JARVIS: Available terminals:`, Array.from(terminalManager.terminals.keys()));
        return;
      }

      // Wait a moment for Claude to start, then send the Planner prompt
      setTimeout(async () => {
        await sendPlannerPrompt(plannerSession, io);
      }, 5000); // 5 second delay for Claude to fully load

      console.log(`✅ JARVIS: Claude session started in terminal: ${plannerSession.id}`);

    } catch (error) {
      console.error('❌ JARVIS: Error starting Claude session in terminal:', error);
    }
  }

  /**
   * 🎯 JARVIS: Send comprehensive Planner prompt with conversation context
   */
  async function sendPlannerPrompt(plannerSession, io) {
    try {
      console.log(`🎯 JARVIS: Sending Planner prompt to session: ${plannerSession.id}`);

      // Get conversation context from the cloned session
      let conversationContext = "";
      try {
        const SessionManager = require('/Users/joshuamullet/code/holler/holler-next/lib/SessionManager');
        const sessionManager = new SessionManager();
        const claudeProjectDir = sessionManager.getClaudeProjectDir();
        const fs = require('fs');
        const path = require('path');

        console.log(`🐛 JARVIS CONTEXT DEBUG: claudeProjectDir = ${claudeProjectDir}`);
        console.log(`🐛 JARVIS CONTEXT DEBUG: plannerSession.claudeSessionId = ${plannerSession.claudeSessionId}`);

        const clonedFile = path.join(claudeProjectDir, `${plannerSession.claudeSessionId}.jsonl`);
        console.log(`🐛 JARVIS CONTEXT DEBUG: Looking for cloned file at: ${clonedFile}`);
        console.log(`🐛 JARVIS CONTEXT DEBUG: File exists? ${fs.existsSync(clonedFile)}`);

        if (fs.existsSync(clonedFile)) {
          const content = fs.readFileSync(clonedFile, 'utf8');
          console.log(`🐛 JARVIS CONTEXT DEBUG: File content length: ${content.length}`);

          const lines = content.trim().split('\n').filter(line => line.trim());
          console.log(`🐛 JARVIS CONTEXT DEBUG: Found ${lines.length} lines in conversation`);

          if (lines.length > 0) {
            // Extract all message objects (no limit, keep it simple)
            const messageObjects = lines.map(line => {
              try {
                const entry = JSON.parse(line);

                // Just extract the message object if it exists, with cleanup
                if (entry.message) {
                  const cleanMessage = { ...entry.message };

                  // Remove metadata fields that clutter the context
                  delete cleanMessage.id;
                  delete cleanMessage.model;
                  delete cleanMessage.stop_reason;
                  delete cleanMessage.stop_sequence;
                  delete cleanMessage.usage;

                  return JSON.stringify(cleanMessage, null, 2);
                }

                console.log(`🐛 JARVIS CONTEXT DEBUG: Skipped entry (no message field), type: ${entry.type}`);
                return null;
              } catch (e) {
                console.log(`🐛 JARVIS CONTEXT DEBUG: Failed to parse line: ${e.message}`);
                return null;
              }
            }).filter(msg => msg !== null);

            if (messageObjects.length > 0) {
              conversationContext = `\n\n## 📋 CONVERSATION CONTEXT\nHere are the message objects from the Executor session:\n\n${messageObjects.join('\n\n')}\n\n`;
              console.log(`🐛 JARVIS CONTEXT DEBUG: Successfully loaded ${messageObjects.length} message objects`);
            } else {
              conversationContext = "\n\n## ⚠️ CONVERSATION CONTEXT\nCloned file found but no readable messages - proceeding without context.\n\n";
              console.log(`🐛 JARVIS CONTEXT DEBUG: File found but no readable messages`);
            }
          } else {
            conversationContext = "\n\n## ⚠️ CONVERSATION CONTEXT\nCloned file is empty - proceeding without context.\n\n";
            console.log(`🐛 JARVIS CONTEXT DEBUG: File found but empty`);
          }
        } else {
          conversationContext = "\n\n## ⚠️ CONVERSATION CONTEXT\nCloned session file not found - proceeding without context.\n\n";
          console.log(`🐛 JARVIS CONTEXT DEBUG: Cloned file does not exist`);
        }
      } catch (error) {
        console.error('❌ JARVIS: Error reading conversation context:', error);
        conversationContext = "\n\n## ⚠️ CONVERSATION CONTEXT\nUnable to load conversation history - proceed based on available context.\n\n";
      }

      const plannerPrompt = `
🤖 **JARVIS MODE: You are now the PLANNER AGENT**
${conversationContext}
## Your Role
You are a collaborative planning partner building an execution plan with the user. Your job is to:

1. **Analyze the conversation context** - Look at the last user request and Claude's response
2. **Build/update the plan** in holler-plans.json for the next Executor session
3. **Research files when needed** to understand the codebase and context
4. **Collaborate with user** to refine the plan together

## Plan Management
You must manage the plan in the holler-plans.json file:

**File Location:** /Users/joshuamullet/code/holler/holler-plans.json
**Your Session ID:** ${plannerSession.parentExecutorSession}

**Instructions:**
- Read the sessions file to understand current state
- Find your session using the ID above
- Update the "plan" field with your analysis and next steps
- If the "plan" field doesn't exist, create it
- Keep the plan focused and actionable for the next Executor Claude session

## Critical Constraints

### 🚫 **VOICE-ONLY USER**
- User is walking around, can't see screen or retain long explanations
- Keep responses **short and decision-focused**
- Don't describe every tool - just important findings
- Ask simple yes/no questions when possible

### 🔍 **QUICK ANALYSIS** 
- Check: Did Claude do what was asked?
- Point out: Any major deviations or problems
- Be direct: "I found an issue with..." or "Everything looks good"

### 📁 **TARGETED RESEARCH**
- Only research when you need specific info for next steps
- Say: "Checking X file" then report key findings only
- No exhaustive explanations - just what matters for decisions

### 🎤 **BRIEF COLLABORATION**
- Short questions: "Should we fix X first?" or "Ready to proceed?"
- Small decisions: "Option A or B?"
- Wait for "go get 'em" to finalize

## Workflow

1. **Quick Analysis**: Analyze the conversation - what did Claude do vs what was requested?
2. **Initial Plan**: Create/update the plan using CLI scripts with your findings
3. **Collaborate**: Discuss the plan with the user, refine based on their feedback
4. **Final Plan**: Keep updating the plan until it's ready for execution

## Plan Format
The plan should be a clear, actionable prompt that a fresh Executor Claude session can follow:

- Include necessary context about the codebase
- Specify exactly what needs to be done
- List any files that need to be examined
- Note any constraints or requirements

## Important Notes
- Always update the plan using CLI scripts after analysis
- Keep responses short and decision-focused
- The plan is the deliverable - make it comprehensive for the Executor

---

**Start by analyzing what happened in the last conversation and creating an initial plan.**
`;

      // 🐛 DEBUG: Write prompt to debug file for troubleshooting
      try {
        const fs = require('fs');
        const path = require('path');
        const debugDir = '/Users/joshuamullet/code/holler/holler-next/debug';

        // Ensure debug directory exists
        if (!fs.existsSync(debugDir)) {
          fs.mkdirSync(debugDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const debugFile = path.join(debugDir, `planner-prompt-${timestamp}.txt`);

        // Read the raw cloned file content for debugging
        let rawClonedFileContent = 'No cloned file found';
        try {
          const SessionManager = require('/Users/joshuamullet/code/holler/holler-next/lib/SessionManager');
          const sessionManager = new SessionManager();
          const claudeProjectDir = sessionManager.getClaudeProjectDir();
          const clonedFile = path.join(claudeProjectDir, `${plannerSession.claudeSessionId}.jsonl`);

          if (fs.existsSync(clonedFile)) {
            rawClonedFileContent = fs.readFileSync(clonedFile, 'utf8');
          } else {
            rawClonedFileContent = `File not found at: ${clonedFile}`;
          }
        } catch (error) {
          rawClonedFileContent = `Error reading file: ${error.message}`;
        }

        const debugContent = `
=== JARVIS PLANNER DEBUG ===
Timestamp: ${new Date().toISOString()}
Planner Session ID: ${plannerSession.id}
Terminal ID: ${plannerSession.terminalId}
Claude Session ID: ${plannerSession.claudeSessionId}
Parent Executor: ${plannerSession.parentExecutorSession}

=== CONVERSATION CONTEXT ===
${conversationContext || 'No conversation context loaded'}

=== FULL PROMPT SENT ===
${plannerPrompt}

=== RAW CLONED JSONL FILE CONTENT ===
${rawClonedFileContent}

=== END DEBUG ===
`;

        fs.writeFileSync(debugFile, debugContent);
        console.log(`🐛 JARVIS DEBUG: Prompt written to ${debugFile}`);

      } catch (debugError) {
        console.error('❌ JARVIS DEBUG: Failed to write debug file:', debugError);
      }

      // Send the prompt to the Planner session terminal (like the test message button)
      console.log(`📤 JARVIS: Sending prompt to terminal ${plannerSession.terminalId}`);

      // Method 1: Write to terminal display (paste the text)
      const displaySuccess = terminalManager.writeToTerminal(plannerSession.terminalId, plannerPrompt);

      // Method 2: Send as actual input through socket (actually send it)
      setTimeout(() => {
        console.log(`🚀 JARVIS: Sending prompt as terminal input to ${plannerSession.terminalId}`);
        io.emit('terminal:output', plannerSession.terminalId, '\r'); // Enter key to send

        // Also trigger the terminal input handler directly
        const terminal = terminalManager.getTerminal(plannerSession.terminalId);
        if (terminal && terminal.ptyProcess) {
          terminal.ptyProcess.write('\r'); // Send enter through PTY
        }
      }, 1000); // 1 second delay for the big paste to settle

      if (displaySuccess) {
        console.log(`✅ JARVIS: Planner prompt pasted and sent to ${plannerSession.id}`);
      } else {
        console.error(`❌ JARVIS: Failed to paste Planner prompt to ${plannerSession.id}`);
      }

    } catch (error) {
      console.error('❌ JARVIS: Error sending Planner prompt:', error);
    }
  }


  /**
   * Generate UUID helper function
   */
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  io.on('connection', (socket) => {
    console.log(`🔗 CONNECT: ${socket.id} at ${new Date().toISOString()}`);

    socket.on('disconnect', (reason) => {
      console.log(`🔌 DISCONNECT: ${socket.id} - Reason: ${reason} at ${new Date().toISOString()}`);
    });
    let currentTerminal = null;

    socket.on('terminal:create', (sessionId) => {
      // Reduced logging for routine operations
      if (process.env.DEBUG_TERMINALS) {
        console.log(`🚀 Creating terminal for session: ${sessionId}`);
      }

      try {
        // Look up Claude session ID for this session
        const hollerSession = sessionManager.getAllSessions()
          .find(session => session.terminalId === sessionId);
        const claudeSessionId = hollerSession?.claudeSessionId;

        const terminal = terminalManager.createTerminal(sessionId, claudeSessionId);
        currentTerminal = terminal;
        terminal.clients.add(socket.id);

        // Cancel cleanup timeout if client reconnected
        if (terminal.cleanupTimeout) {
          console.log(`🔄 Client reconnected to ${sessionId}, canceling cleanup`);
          clearTimeout(terminal.cleanupTimeout);
          terminal.cleanupTimeout = null;
        }

        // EXACT node-pty example pattern: PTY output to client
        const handlePtyData = (data) => {
          // Reduced logging - only log when debugging
          if (process.env.DEBUG_PTY) {
            console.log(`📤 PTY output (${data.length} chars) for ${sessionId}`);
          }
          socket.emit('terminal:output', sessionId, data);
        };

        const handlePtyExit = (exitData) => {
          console.log(`💀 PTY exited for ${sessionId}:`, exitData);
          socket.emit('terminal:exit', sessionId, exitData);
          terminalManager.killTerminal(sessionId);
        };

        // Attach PTY event handlers (like node-pty example)
        terminal.ptyProcess.on('data', handlePtyData);
        terminal.ptyProcess.on('exit', handlePtyExit);

        // Store handlers for cleanup
        terminal.socketHandlers = { handlePtyData, handlePtyExit };

        // Send ready signal and apply smart resumption for restored sessions
        setTimeout(async () => {
          console.log(`✅ Terminal ready: ${sessionId}`);
          socket.emit('terminal:ready', sessionId);

          // Check if this is a restored session with Claude session ID (smart resumption)
          const hollerSession = sessionManager.getAllSessions()
            .find(session => session.terminalId === sessionId);

          if (hollerSession && hollerSession.claudeSessionId) {
            console.log(`🧠 Smart resumption check for restored session: ${hollerSession.id} with Claude session: ${hollerSession.claudeSessionId}`);

            // Check if terminal has active processes
            const hasActiveProcesses = await terminalManager.hasActiveProcesses(sessionId);

            if (hasActiveProcesses) {
              console.log(`🔄 Restored terminal has active processes - continuing existing session (preserving processes)`);
              // Don't send any commands, just let the existing terminal continue
            } else {
              console.log(`🔄 Restored terminal is idle - creating fresh terminal for resume`);
              // Terminal is idle, kill it and create fresh one for clean resume
              console.log(`🗑️ Killing idle terminal: ${sessionId}`);
              terminalManager.killTerminal(sessionId);

              // Create fresh terminal and send resume command
              setTimeout(() => {
                console.log(`🆕 Creating fresh terminal for resume: ${sessionId}`);
                const freshTerminal = terminalManager.createTerminal(sessionId, hollerSession.claudeSessionId);
                freshTerminal.clients.add(socket.id);

                // Setup fresh terminal handlers
                const handlePtyData = (data) => {
                  socket.emit('terminal:output', sessionId, data);
                };
                const handlePtyExit = (exitData) => {
                  console.log(`💀 Fresh PTY exited for ${sessionId}:`, exitData);
                  socket.emit('terminal:exit', sessionId, exitData);
                  terminalManager.killTerminal(sessionId);
                };

                freshTerminal.ptyProcess.on('data', handlePtyData);
                freshTerminal.ptyProcess.on('exit', handlePtyExit);
                freshTerminal.socketHandlers = { handlePtyData, handlePtyExit };

                // Send resume command to fresh terminal with project-aware path
                setTimeout(() => {
                  const projectPath = findSessionProjectPath(hollerSession.claudeSessionId);
                  const hollerCmd = `holler --resume ${hollerSession.claudeSessionId} --project-path "${projectPath}"`;
                  // console.log(`🚀 Sending resume command: ${hollerCmd}`);
                  terminalManager.writeToTerminal(sessionId, `${hollerCmd}\n`);
                }, 500);
              }, 100);
            }
          }
        }, 100);

      } catch (error) {
        console.error(`❌ Failed to create terminal: ${error}`);
        socket.emit('terminal:error', sessionId, error.message);
      }
    });

    socket.on('terminal:input', async (sessionId, data) => {

      // Check if this is a session that needs Claude session linking
      // Note: sessionId here is actually the terminalId, need to find by terminalId
      const hollerSession = sessionManager.getAllSessions()
        .find(session => session.terminalId === sessionId);


      // EXACT node-pty example pattern: input to PTY
      const success = terminalManager.writeToTerminal(sessionId, data);
      if (!success) {
        console.warn(`⚠️ Failed to write to terminal ${sessionId}`);
        return;
      }

      // 🎯 EXECUTION MONITORING: Terminal activity no longer triggers monitoring
      // Network monitoring is now triggered by first assistant response (see assistantFirstResponse event)

    });

    socket.on('terminal:resize', (sessionId, cols, rows) => {
      terminalManager.resizeTerminal(sessionId, cols, rows);
    });

    socket.on('terminal:kill', (sessionId) => {
      terminalManager.killTerminal(sessionId);
      socket.emit('terminal:killed', sessionId);
    });

    socket.on('terminal:list', () => {
      const existingTerminals = terminalManager.listTerminals();
      socket.emit('terminal:list', existingTerminals);
    });

    // New event for executing commands in terminal (for Jarvis execution)
    socket.on('terminal:execute', (terminalId, command) => {
      console.log(`🚀 JARVIS: Executing command in terminal ${terminalId}: ${command.substring(0, 50)}...`);

      // Write the command
      const success = terminalManager.writeToTerminal(terminalId, command + '\n');

      if (success) {
        // Send enter through PTY after a delay (like existing Jarvis mode)
        setTimeout(() => {
          console.log(`⚡ JARVIS: Sending execution signal to ${terminalId}`);
          const terminal = terminalManager.getTerminal(terminalId);
          if (terminal && terminal.ptyProcess) {
            terminal.ptyProcess.write('\r'); // Send enter through PTY
          }
        }, 1000);
      }

      socket.emit('terminal:execute:response', { success, terminalId, command: command.substring(0, 100) });
    });

    // New endpoint for scheduled execution (solves script blocking issue)
    socket.on('schedule:execution', (data) => {
      const { terminalId, delaySeconds, command } = data;

      console.log(`📅 JARVIS: Scheduling execution for terminal ${terminalId}`);
      console.log(`⏰ Command: "${command.substring(0, 50)}..." in ${delaySeconds} seconds`);

      // Schedule the command execution
      setTimeout(() => {
        console.log(`🚀 JARVIS: Executing scheduled command for terminal ${terminalId}`);

        // Write the command
        const success = terminalManager.writeToTerminal(terminalId, command + '\n');

        if (success) {
          // Send enter through PTY after a delay (like existing Jarvis mode)
          setTimeout(() => {
            console.log(`⚡ JARVIS: Sending execution signal to ${terminalId}`);
            const terminal = terminalManager.getTerminal(terminalId);
            if (terminal && terminal.ptyProcess) {
              terminal.ptyProcess.write('\r'); // Send enter through PTY
            }
          }, 1000);
        }

        console.log(`✅ JARVIS: Scheduled command executed - ${success ? 'Success' : 'Failed'}`);
      }, delaySeconds * 1000);

      // Immediately respond that scheduling was successful
      socket.emit('schedule:execution:response', {
        success: true,
        terminalId,
        delaySeconds,
        command: command.substring(0, 100),
        message: `Command scheduled for execution in ${delaySeconds} seconds`
      });
    });

    // 🗑️ REMOVED: Old execution monitoring socket handler - replaced by Stop hook

    // SESSION MANAGEMENT ENDPOINTS
    socket.on('session:list', () => {
      const sessionsData = sessionManager.getSessionsForFrontend();
      socket.emit('session:list', sessionsData);
    });

    socket.on('session:create', async (sessionData) => {
      try {
        console.log('🎯🎯🎯 session:create received type:', typeof sessionData);
        console.log('🎯🎯🎯 session:create data keys:', sessionData && typeof sessionData === 'object' ? Object.keys(sessionData) : 'N/A');
        console.log('🎯🎯🎯 session:create has id:', sessionData && sessionData.id ? sessionData.id : 'NO');
        console.log('🎯🎯🎯 session:create data:', JSON.stringify(sessionData));

        let session;

        // Handle both legacy string format and new object format
        console.log('🔍 Checking session data format...');
        console.log('🔍 Is string?', typeof sessionData === 'string');
        console.log('🔍 Is object?', typeof sessionData === 'object' && sessionData);
        console.log('🔍 Has id?', sessionData && sessionData.id);
        console.log('🔍 Has name?', sessionData && sessionData.name);
        console.log('🔍 sessionData.name value:', sessionData && sessionData.name);
        console.log('🔍 sessionData.name type:', typeof (sessionData && sessionData.name));

        if (typeof sessionData === 'string') {
          // Legacy mode: create new session from name
          console.log('📝 Creating session from string:', sessionData);
          session = await sessionManager.createSession({ name: sessionData });

          // Create terminal for this session
          const terminal = terminalManager.createTerminal(session.terminalId, session.claudeSessionId);
          terminal.sessionData = session;

          socket.emit('session:created', session);

          // Auto-run holler command for new sessions
          setTimeout(() => {
            console.log(`🚀 Auto-running holler command for new session: ${session.id}`);
            terminalManager.writeToTerminal(session.terminalId, 'holler\n');

            // Session correlation will happen automatically when Claude CLI hooks fire
            // No need to force discovery of old sessions
          }, 1000);

        } else if (typeof sessionData === 'object' && sessionData && sessionData.id) {
          // New mode: use pre-built session object (for cloning)
          console.log('🔄 ATTEMPT TO RESTORE SESSION:', sessionData.id);
          console.log('🔄 Session name:', sessionData.name);
          console.log('🔄 Session Claude ID:', sessionData.claudeSessionId);

          // PREVENT RESTORATION OF DELETED SESSIONS
          console.log('🚫 BLOCKED: Preventing restoration of potentially deleted session');
          console.log('🚫 If this was intentional, use session:create without ID instead');
          return; // Don't restore deleted sessions

          // session = sessionData;
          // sessionManager.sessions.set(session.id, session);
          // sessionManager.saveSessions();
          // console.log('✅ Registered pre-built session');

        } else if (typeof sessionData === 'object' && sessionData && sessionData.name && !sessionData.id) {
          // New mode: create session from object with name and projectPath
          console.log('📝 Creating session from object:', sessionData.name, 'at', sessionData.projectPath);
          session = await sessionManager.createSession({
            name: sessionData.name,
            projectPath: sessionData.projectPath
          });

          // Create terminal for this session
          const terminal = terminalManager.createTerminal(session.terminalId, session.claudeSessionId);
          terminal.sessionData = session;
          console.log('✅ Terminal created for session:', session.terminalId);

          socket.emit('session:created', session);

          // Auto-run holler command for new sessions
          setTimeout(() => {
            console.log(`🚀 Auto-running holler command for new session: ${session.id}`);
            terminalManager.writeToTerminal(session.terminalId, 'holler\n');

            // Session correlation will happen automatically when Claude CLI hooks fire
            // No need to force discovery of old sessions
          }, 1000);

          // Session correlation will happen automatically when hooks fire
          // No old tracking or linking logic needed

        } else {
          console.error('❌ Invalid session data format. Type:', typeof sessionData, 'HasId:', !!(sessionData && sessionData.id));
          return;
        }

      } catch (error) {
        console.error('❌ Session creation failed:', error);
        socket.emit('session:error', { message: 'Failed to create session: ' + error.message });
      }
    });

    socket.on('session:link-claude', async () => {
      console.log('🔍 Manual Claude session linking requested');
      await sessionManager.linkLatestClaudeSession();

      // Send updated sessions back to client
      const sessionsData = sessionManager.getSessionsForFrontend();
      socket.emit('session:list', sessionsData);
    });

    socket.on('session:send-message', async (data) => {
      const { sessionId, message } = data;
      if (!sessionId || !message) {
        console.error('❌ AI Auto-Response: Missing sessionId or message');
        return;
      }

      // Find the Holler session
      const hollerSession = sessionManager.getSession(sessionId);
      if (!hollerSession) {
        console.error('❌ AI Auto-Response: Session not found:', sessionId);
        return;
      }

      try {
        // Method 1: Try different newline sequences for message submission
        console.log(`🧪 Testing message submission sequences for terminal: ${hollerSession.terminalId}`);

        // Test 1: Standard newline
        let success = terminalManager.writeToTerminal(hollerSession.terminalId, message + '\n');
        console.log(`📝 Test 1 (\\n): ${success ? 'Success' : 'Failed'}`);

        // Test 2: Carriage return + newline
        setTimeout(() => {
          success = terminalManager.writeToTerminal(hollerSession.terminalId, '\r\n');
          console.log(`📝 Test 2 (\\r\\n): ${success ? 'Success' : 'Failed'}`);
        }, 100);

        // Test 3: Just carriage return
        setTimeout(() => {
          success = terminalManager.writeToTerminal(hollerSession.terminalId, '\r');
          console.log(`📝 Test 3 (\\r): ${success ? 'Success' : 'Failed'}`);
        }, 200);

        if (success) {
          console.log(`✅ AI Auto-Response: Message sequences sent to Claude session ${hollerSession.claudeSessionId}`);
        } else {
          console.error('❌ AI Auto-Response: Failed to write to terminal');
        }

      } catch (error) {
        console.error('❌ AI Auto-Response: Error sending message:', error);
      }
    });

    // Handle Jarvis mode toggle
    socket.on('session:toggle-jarvis', async (data) => {
      const { sessionId, jarvisMode } = data;
      if (!sessionId || jarvisMode === undefined) {
        console.error('❌ Jarvis Toggle: Missing sessionId or jarvisMode flag');
        return;
      }

      console.log(`🔄 Jarvis mode toggle request: ${sessionId} → ${jarvisMode ? 'ON' : 'OFF'}`);

      try {
        // Update the session with Jarvis mode flag
        const success = sessionManager.updateSessionJarvisMode(sessionId, jarvisMode);

        if (success) {
          console.log(`✅ Jarvis mode ${jarvisMode ? 'ENABLED' : 'DISABLED'} for session: ${sessionId}`);

          // Broadcast the update to all connected clients
          io.emit('session:jarvis-updated', {
            sessionId: sessionId,
            jarvisMode: jarvisMode
          });

          // 🤖 JARVIS MODE: If enabled, send planning prompt to existing session
          if (jarvisMode) {
            await sendPlanningPromptToSession(sessionId, sessionManager, io);
          }
        } else {
          console.error(`❌ Failed to update Jarvis mode for session: ${sessionId}`);
        }

      } catch (error) {
        console.error('❌ Error toggling Jarvis mode:', error);
      }
    });

    socket.on('disconnect', () => {
      console.log('🔌 Client disconnected:', socket.id);

      if (currentTerminal) {
        currentTerminal.clients.delete(socket.id);
        console.log(`🔄 Terminal ${currentTerminal.sessionId} has ${currentTerminal.clients.size} remaining clients`);

        // TEMPORARY: Disable auto-cleanup to test persistence
        if (currentTerminal.clients.size === 0) {
          console.log(`⏰ Terminal ${currentTerminal.sessionId} has no clients - KEEPING ALIVE for testing`);
          // DON'T kill terminals - let them persist for testing
        }
      }
    });
  });

  // Add server error handling for disconnect debugging
  process.on('uncaughtException', (error) => {
    console.log(`💥 SERVER CRASH: ${error.message}`);
    console.error(error.stack);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.log(`💥 UNHANDLED REJECTION: ${reason}`);
  });

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`🎯 WORKING Terminal Server ready on http://${hostname}:${port}`);
    console.log(`📋 Using proven node-pty example pattern`);

    // Start Claude session discovery service (like Claudia's approach)
    // claudeDiscoveryService.startDiscovery(); // DISABLED - was creating duplicate sessions
    console.log(`🔍 Claude Session Discovery Service started`);
  });
});