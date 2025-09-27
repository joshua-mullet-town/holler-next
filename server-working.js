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

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = process.env.PORT || 3002;

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// PROVEN PATTERN: Direct PTY management like node-pty example
class WorkingTerminalManager {
  constructor() {
    this.terminals = new Map();
  }

  createTerminal(sessionId, claudeSessionId = null) {
    if (this.terminals.has(sessionId)) {
      console.log(`🔄 Reusing existing terminal: ${sessionId}`);
      return this.terminals.get(sessionId);
    }

    console.log(`🚀 Creating new terminal: ${sessionId}${claudeSessionId ? ` with Claude session: ${claudeSessionId}` : ''}`);

    // Create environment with CLAUDE_SESSION_ID for CLAUDE.md routing
    const terminalEnv = { ...process.env };
    if (claudeSessionId) {
      terminalEnv.CLAUDE_SESSION_ID = claudeSessionId;
      console.log(`🎯 Setting CLAUDE_SESSION_ID=${claudeSessionId} for automatic project routing`);
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


    console.log(`✅ Terminal created with PID: ${ptyProcess.pid}`);
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
      console.log(`📏 Resized terminal ${sessionId} to ${cols}x${rows}`);
    }
  }

  killTerminal(sessionId) {
    const terminal = this.terminals.get(sessionId);
    if (terminal) {
      console.log(`🗑️ Killing terminal: ${sessionId}`);
      terminal.ptyProcess.kill();
      this.terminals.delete(sessionId);
    }
  }

  listTerminals() {
    const terminalIds = Array.from(this.terminals.keys());
    console.log(`📋 Listing terminals: ${terminalIds.length} found`, terminalIds);
    return terminalIds;
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
  console.log(`🔍 CONTENT SEARCH: Looking for message content to find active Claude session for ${hollerSessionId}`);

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
      console.log(`📝 No existing sessions found for message content (new conversation)`);
      return null;
    }

    if (matchingFiles.length === 0) {
      console.log(`📝 No session files found containing message content`);
      return null;
    }

    console.log(`🔍 Found message in ${matchingFiles.length} session files:`, matchingFiles);

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
    console.log(`🎯 ACTIVE SESSION DETECTED: ${activeSession.sessionId} (modified: ${activeSession.modifiedTime.toISOString()})`);

    // Log other candidates for debugging
    if (fileStats.length > 1) {
      console.log(`📊 Other session candidates:`);
      fileStats.slice(1).forEach((file, index) => {
        console.log(`   ${index + 2}. ${file.sessionId} (modified: ${file.modifiedTime.toISOString()})`);
      });
    }

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
    const logMessage = `${new Date().toISOString()} 🚀 FILE MONITOR: New session detected: ${event.sessionId}`;
    console.log(logMessage);
    fs.appendFileSync('/tmp/file-monitor-test.log', logMessage + '\n');

    // 🚨 DISABLED: Old creation-time-based correlation caused session cross-contamination
    // sessionStart correlation replaced by message-content-based correlation in userPromptSubmit
    console.log(`📝 SESSION START: New Claude session ${event.sessionId} detected, waiting for user message to determine correct Holler session linkage`);

    // CRITICAL: Still reload sessions to sync with any deletions that happened via API
    sessionManager.reloadSessions();
  });

  fileMonitor.on('userPromptSubmit', async (event) => {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('🔍 FULL EVENT OBJECT DEBUG - ALL AVAILABLE DATA:');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(JSON.stringify(event, null, 2));
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📋 EVENT PROPERTIES BREAKDOWN:');
    Object.keys(event).forEach(key => {
      console.log(`  ${key}: ${typeof event[key]} = ${JSON.stringify(event[key])}`);
    });
    console.log('═══════════════════════════════════════════════════════════════');
    
    const logMessage = `${new Date().toISOString()} 💬 FILE MONITOR: User message detected in session: ${event.sessionId}`;
    console.log(logMessage);
    fs.appendFileSync('/tmp/file-monitor-test.log', logMessage + '\n');

    // 🎯 STEP 1: RUN CORRELATION FIRST - Find which Holler session should be linked
    let linkedHollerSession = null;
    try {
      // Find the Claude session file across ALL project directories
      const claudeProjectsDir = path.join(os.homedir(), '.claude', 'projects');
      const { execSync } = require('child_process');
      const sessionFileResult = execSync(`find "${claudeProjectsDir}" -name "${event.sessionId}.jsonl" -type f`, { encoding: 'utf8' }).trim();

      if (sessionFileResult) {
        const claudeSessionFile = sessionFileResult;
        console.log(`📁 FOUND SESSION FILE: ${claudeSessionFile}`);

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
                console.log(`🔍 TRACKING USER MESSAGE: "${messageContent}" from session ${event.sessionId}`);

                // 🎯 NEW PARENT UUID-BASED CORRELATION: Deterministic session linking
                linkedHollerSession = await handleSessionCorrelation(event, sessionManager, io);
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
    } else {
      console.log(`⚠️ STATUS: No Holler session linked for Claude session ${event.sessionId}, skipping status update`);
    }
  });

  fileMonitor.on('stop', (event) => {
    const logMessage = `${new Date().toISOString()} 🤖 FILE MONITOR: Claude response detected in session: ${event.sessionId}`;
    console.log(logMessage);
    fs.appendFileSync('/tmp/file-monitor-test.log', logMessage + '\n');

    console.log(`🔍 AUTONOMOUS DEBUG: Stop event details:`, {
      sessionId: event.sessionId,
      isComplete: event.isComplete,
      timestamp: event.timestamp
    });

    // 🟢 STATUS UPDATE: Claude finished response, ready for user input  
    if (event.isComplete) {
      console.log(`🟢 STATUS: Claude session ${event.sessionId} → READY (green)`);
      io.emit('session:status-update', {
        claudeSessionId: event.sessionId,
        status: 'ready' // Green
      });

      console.log(`✅ AUTONOMOUS DEBUG: Response is complete, checking for autonomous mode...`);

      // CRITICAL: Reload sessions to get latest autonomousMode setting
      sessionManager.reloadSessions();

      // Find Holler session to check autonomous mode
      const hollerSession = sessionManager.getAllSessions()
        .find(session => session.claudeSessionId === event.sessionId);

      console.log(`🔍 AUTONOMOUS DEBUG: Found holler session:`, hollerSession ? {
        id: hollerSession.id,
        name: hollerSession.name,
        claudeSessionId: hollerSession.claudeSessionId,
        autonomousMode: hollerSession.autonomousMode
      } : 'NOT FOUND');

      if (hollerSession && hollerSession.autonomousMode) {
        console.log(`🤖 AUTONOMOUS MODE ACTIVE: Sending test response for session ${hollerSession.id}`);
        console.log(`🔍 AUTONOMOUS DEBUG: Terminal ID: ${hollerSession.terminalId}`);

        // Generate test message with counter
        const testMessage = `🤖 Autonomous test response ${Date.now()} - Observer AI responding automatically`;
        console.log(`🔍 AUTONOMOUS DEBUG: Generated message: "${testMessage}"`);

        try {
          console.log(`🚀 AUTONOMOUS DEBUG: Waiting 1 second for Claude CLI to settle...`);

          // Add delay to let Claude CLI fully settle before sending autonomous message
          setTimeout(() => {
            console.log(`🚀 AUTONOMOUS DEBUG: Now writing to terminal using button's exact sequence...`);

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
        console.log(`🔕 AUTONOMOUS DEBUG: No Holler session found for Claude session ${event.sessionId}`);
        console.log(`🔕 AUTONOMOUS DEBUG: Available sessions:`, sessionManager.getAllSessions().map(s => ({
          id: s.id,
          name: s.name,
          claudeSessionId: s.claudeSessionId,
          autonomousMode: s.autonomousMode
        })));
      } else if (!hollerSession.autonomousMode) {
        console.log(`🔕 AUTONOMOUS DEBUG: Session ${hollerSession.id} has autonomousMode: ${hollerSession.autonomousMode}`);
      }
    }
  });
}

/**
 * NEW SIMPLIFIED CORRELATION: Parent UUID-based deterministic session linking
 * No more guessing - know definitively what to do based on parentUuid
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
 * Handle session switches (parentUuid !== null)
 */
async function handleSessionSwitch(event, sessionManager, io) {
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

const sessionManager = new SessionManager();
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

    // 🚨 REMOVED: Old hook-based status updates (hooks don't work in PTY environment)
    // Replaced with file-monitor-based status system using session:status-update events

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

  io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);
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
                  console.log(`🚀 Sending resume command: ${hollerCmd}`);
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
      console.log(`📝 Input for ${sessionId}: ${data.length} chars`);

      // Check if this is a session that needs Claude session linking
      const hollerSession = sessionManager.getSession(sessionId);
      const isFirstMessage = hollerSession && !hollerSession.claudeSessionId;

      if (isFirstMessage) {
        console.log(`🔗 First message detected for unlinked session: ${sessionId}`);
        console.log(`🔗 Will auto-correlate after message is processed`);
      }

      // EXACT node-pty example pattern: input to PTY
      const success = terminalManager.writeToTerminal(sessionId, data);
      if (!success) {
        console.warn(`⚠️ Failed to write to terminal ${sessionId}`);
        return;
      }

      // 🎯 SIMPLE SESSION TRACKING: Will be triggered by file monitor instead

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
          console.log('✅ Session created successfully:', session.id);

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

    // Handle autonomous mode toggle
    socket.on('session:toggle-autonomous', async (data) => {
      const { sessionId, autonomousMode } = data;
      if (!sessionId || autonomousMode === undefined) {
        console.error('❌ Autonomous Toggle: Missing sessionId or autonomousMode flag');
        return;
      }

      console.log(`🔄 Autonomous mode toggle request: ${sessionId} → ${autonomousMode ? 'ON' : 'OFF'}`);

      try {
        // Update the session with autonomous mode flag
        const success = sessionManager.updateSessionAutonomousMode(sessionId, autonomousMode);

        if (success) {
          console.log(`✅ Autonomous mode ${autonomousMode ? 'ENABLED' : 'DISABLED'} for session: ${sessionId}`);

          // Broadcast the update to all connected clients
          io.emit('session:autonomous-updated', {
            sessionId: sessionId,
            autonomousMode: autonomousMode
          });
        } else {
          console.error(`❌ Failed to update autonomous mode for session: ${sessionId}`);
        }

      } catch (error) {
        console.error('❌ Error toggling autonomous mode:', error);
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

  server.listen(port, (err) => {
    if (err) throw err;
    console.log(`🎯 WORKING Terminal Server ready on http://${hostname}:${port}`);
    console.log(`📋 Using proven node-pty example pattern`);

    // Start Claude session discovery service (like Claudia's approach)
    // claudeDiscoveryService.startDiscovery(); // DISABLED - was creating duplicate sessions
    console.log(`🔍 Claude Session Discovery Service started`);
  });
});