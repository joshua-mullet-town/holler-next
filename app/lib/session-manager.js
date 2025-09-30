/**
 * 🎯 Session Manager - Multi-Claude Session Management
 * Handles session storage, Claude CLI management, and persistence
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const { v4: uuidv4 } = require('uuid');

class SessionManager {
    constructor() {
        this.sessionsFile = path.join(__dirname, 'sessions.json');
        this.sessions = new Map(); // In-memory session data
        this.claudeProcesses = new Map(); // Active Claude CLI processes
        this.initialize();
    }

    async initialize() {
        await this.loadSessions();
        console.log('🎯 Session Manager initialized');
    }

    /**
     * Load sessions from JSON file
     */
    async loadSessions() {
        try {
            const data = await fs.readFile(this.sessionsFile, 'utf8');
            const sessionData = JSON.parse(data);
            
            // Load sessions into memory
            Object.values(sessionData.sessions || {}).forEach(session => {
                this.sessions.set(session.id, session);
            });
            
            console.log(`📁 Loaded ${this.sessions.size} sessions from storage`);
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.log('📁 No existing sessions file, starting fresh');
                await this.saveSessions();
            } else {
                console.error('❌ Error loading sessions:', error);
            }
        }
    }

    /**
     * Save sessions to JSON file
     */
    async saveSessions() {
        try {
            const sessionData = {
                sessions: {},
                lastUpdated: new Date().toISOString()
            };

            // Convert Map to object for JSON storage
            this.sessions.forEach(session => {
                sessionData.sessions[session.id] = session;
            });

            await fs.writeFile(this.sessionsFile, JSON.stringify(sessionData, null, 2));
            console.log('💾 Sessions saved to storage');
        } catch (error) {
            console.error('❌ Error saving sessions:', error);
        }
    }

    /**
     * Get list of existing Claude Code sessions via `claude --resume`
     */
    async getExistingClaudeSessions() {
        return new Promise((resolve, reject) => {
            console.log('🔍 Fetching existing Claude sessions...');
            
            // Set a timeout to prevent hanging
            const timeout = setTimeout(() => {
                console.log('⏰ Claude session fetch timed out, returning empty list');
                if (claude && !claude.killed) {
                    claude.kill('SIGTERM');
                }
                resolve([]);
            }, 8000);
            
            // Use the shell script to handle the interactive command
            const claude = spawn('sh', ['-c', './get-claude-sessions.sh'], {
                cwd: __dirname,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            claude.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            claude.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            claude.on('close', (code) => {
                clearTimeout(timeout);
                
                console.log(`🔚 Claude sessions script closed with code: ${code}`);
                
                if (stdout.length > 0) {
                    // Parse Claude --resume output to extract session list
                    const sessions = this.parseClaudeResumeOutput(stdout);
                    console.log(`✅ Found ${sessions.length} existing Claude sessions`);
                    resolve(sessions);
                } else {
                    console.log('⚠️ No existing Claude sessions found in output');
                    resolve([]); // Return empty array instead of rejecting
                }
            });

            claude.on('error', (err) => {
                clearTimeout(timeout);
                console.error('🚨 Error fetching Claude sessions:', err);
                resolve([]); // Return empty array on error
            });
        });
    }

    /**
     * Parse output from `claude --resume` to extract session information
     */
    parseClaudeResumeOutput(output) {
        console.log('🔍 Parsing Claude --resume output...');
        console.log('📝 Raw output preview:', output.substring(0, 300));
        
        // Remove ANSI escape codes more aggressively
        const cleanOutput = output.replace(/\x1b\[[0-9;]*[mGKH]/g, '').replace(/spawn claude --resume\s*/g, '');
        
        const sessions = [];
        const lines = cleanOutput.split('\n');
        
        for (const line of lines) {
            // Debug each line
            if (line.includes('ago') && /\d+\./.test(line)) {
                console.log('🔍 Analyzing line:', JSON.stringify(line));
            }
            
            // Look for lines with numbered sessions - fix the regex pattern
            // Actual format: "❯ 1. 1s ago      20m ago            207 -              This session is being"
            // Clean the line first
            const cleanLine = line.replace(/\r/g, '').trim();
            
            // Updated regex pattern to match: "❯ 1. 1s ago      20m ago            207 -              This session is being"
            const match = cleanLine.match(/^\s*[❯]?\s*(\d+)\.\s+(.+?ago)\s+(.+?ago)\s+(\d+)\s+([^\s]+)\s+(.+)$/);
            
            if (match) {
                const [, sessionNum, modified, created, messageCount, branch, summary] = match;
                console.log('✅ Matched session:', sessionNum, modified, messageCount);
                sessions.push({
                    claudeSessionId: sessionNum.trim(),
                    description: `${summary.trim()} (${messageCount} messages, ${modified.trim()})`,
                    index: parseInt(sessionNum) - 1,
                    modified: modified.trim(),
                    created: created.trim(),
                    messageCount: parseInt(messageCount),
                    branch: branch.trim(),
                    summary: summary.trim()
                });
            }
        }
        
        console.log(`🎯 Parsed ${sessions.length} Claude sessions from output`);
        if (sessions.length > 0) {
            console.log('📋 Sample session:', sessions[0]);
        }
        return sessions;
    }

    /**
     * Create a new session
     */
    async createSession(options = {}) {
        const sessionId = uuidv4();
        const now = new Date().toISOString();

        const session = {
            id: sessionId,
            name: options.name || `Session ${this.sessions.size + 1}`,
            created: now,
            lastActivity: now,
            status: 'ready',
            theme: options.theme || 'default',
            claudeSessionId: options.claudeSessionId || null,
            cwd: options.cwd || process.cwd(),
            gitBranch: options.gitBranch || '-',
            conversationHistory: [],
            isResumed: !!options.claudeSessionId,
            metadata: {
                messageCount: 0,
                totalTokens: 0
            }
        };

        this.sessions.set(sessionId, session);
        await this.saveSessions();

        console.log(`➕ Created session: ${session.name} (${sessionId})`);
        return session;
    }

    /**
     * Get a session by ID
     */
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }

    /**
     * Get all sessions
     */
    getAllSessions() {
        return Array.from(this.sessions.values());
    }

    /**
     * Update session data
     */
    async updateSession(sessionId, updates) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }

        const updatedSession = {
            ...session,
            ...updates,
            lastActivity: new Date().toISOString()
        };

        this.sessions.set(sessionId, updatedSession);
        await this.saveSessions();

        return updatedSession;
    }

    /**
     * Update session autonomous mode flag
     */
    async updateSessionAutonomousMode(sessionId, autonomousMode) {
        try {
            const updatedSession = await this.updateSession(sessionId, { 
                autonomousMode: autonomousMode 
            });
            console.log(`🔄 Session ${sessionId} autonomous mode updated: ${autonomousMode}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to update autonomous mode for session ${sessionId}:`, error);
            return false;
        }
    }

    /**
     * Delete a session
     */
    async deleteSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return false;
        }

        // Stop Claude process if running
        await this.stopClaudeProcess(sessionId);

        this.sessions.delete(sessionId);
        await this.saveSessions();

        // 🔗 CLEANUP: Also remove correlation data
        try {
            const CorrelationManager = require('../../lib/CorrelationManager');
            const correlationManager = new CorrelationManager();
            correlationManager.removeCorrelation(sessionId);
            console.log(`🔗 Cleaned up correlation for session ${sessionId}`);
        } catch (error) {
            console.warn('⚠️ Failed to cleanup correlation (non-fatal):', error.message);
        }

        console.log(`🗑️ Deleted session: ${session.name} (${sessionId})`);
        return true;
    }

    /**
     * Start Claude CLI process for a session
     */
    async startClaudeProcess(sessionId) {
        const session = this.getSession(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }

        // If process already running, return it
        if (this.claudeProcesses.has(sessionId)) {
            return this.claudeProcesses.get(sessionId);
        }

        console.log(`🚀 Starting Claude process for session: ${session.name}`);

        // Determine Claude command based on whether it's a resumed session
        let claudeArgs = [];
        if (session.isResumed && session.claudeSessionId) {
            claudeArgs = ['--resume', session.claudeSessionId];
        }

        const processInfo = {
            sessionId,
            process: null,
            status: 'starting'
        };

        this.claudeProcesses.set(sessionId, processInfo);
        
        // Update session status
        await this.updateSession(sessionId, { status: 'ready' });

        return processInfo;
    }

    /**
     * Stop Claude CLI process for a session
     */
    async stopClaudeProcess(sessionId) {
        const processInfo = this.claudeProcesses.get(sessionId);
        if (!processInfo || !processInfo.process) {
            return;
        }

        console.log(`🛑 Stopping Claude process for session: ${sessionId}`);

        processInfo.process.kill();
        this.claudeProcesses.delete(sessionId);

        // Update session status
        const session = this.getSession(sessionId);
        if (session) {
            await this.updateSession(sessionId, { status: 'stopped' });
        }
    }

    /**
     * Load conversation history for a resumed session
     * Simplified: Just return empty array, let Claude handle the context internally
     */
    async loadSessionHistory(sessionId) {
        const session = this.getSession(sessionId);
        if (!session || !session.isResumed || !session.claudeSessionId) {
            return [];
        }

        console.log(`🔗 Connected to existing Claude session: ${session.claudeSessionId}`);
        
        // Return empty array - no need to show system messages
        // Claude will have the full context when you send the first message
        return [];
    }

    /**
     * Parse conversation history from Claude --print output
     */
    parseConversationHistory(output) {
        const messages = [];
        const lines = output.split('\n');
        let currentMessage = null;
        let currentContent = '';

        for (const line of lines) {
            // Look for message headers like "User:" or "Assistant:"
            if (line.startsWith('User:') || line.startsWith('Human:')) {
                if (currentMessage) {
                    messages.push({
                        type: currentMessage,
                        content: currentContent.trim(),
                        timestamp: new Date()
                    });
                }
                currentMessage = 'user';
                currentContent = line.replace(/^(User:|Human:)\s*/, '');
            } else if (line.startsWith('Assistant:') || line.startsWith('Claude:')) {
                if (currentMessage) {
                    messages.push({
                        type: currentMessage,
                        content: currentContent.trim(),
                        timestamp: new Date()
                    });
                }
                currentMessage = 'claude';
                currentContent = line.replace(/^(Assistant:|Claude:)\s*/, '');
            } else if (currentMessage) {
                currentContent += '\n' + line;
            }
        }

        // Add the last message
        if (currentMessage && currentContent.trim()) {
            messages.push({
                type: currentMessage,
                content: currentContent.trim(),
                timestamp: new Date()
            });
        }

        console.log(`📋 Parsed ${messages.length} messages from conversation history`);
        return messages;
    }

    /**
     * Execute Claude command for a specific session
     */
    async executeClaudeCommand(sessionId, input, messageHistory = null) {
        const session = this.getSession(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }

        // Update session status to running and sync message history if provided
        const updates = { status: 'running' };
        if (messageHistory) {
            updates.conversationHistory = messageHistory;
        }
        await this.updateSession(sessionId, updates);

        return new Promise((resolve, reject) => {
            console.log(`🎯 Executing Claude command for session ${session.name}: "${input.substring(0, 50)}..."`);
            
            // Build Claude command with MCP permissions
            let baseCommand = 'claude';
            
            // MCP Tools that the Holler interface should have access to
            const allowedMcpTools = [
                'mcp__playwright__*',      // All Playwright tools for UI debugging
                'mcp__filesystem__*',      // File system operations
                'mcp__github__*',          // GitHub operations
                'Edit',                    // File editing
                'Bash(*)',                 // All bash commands
                'Read',                    // File reading
                'Write'                    // File writing
            ];
            
            // For development, use skip-permissions. In production, use allowedTools
            const isDevelopment = process.env.NODE_ENV !== 'production';
            const mcpFlags = isDevelopment 
                ? '--dangerously-skip-permissions' 
                : `--allowedTools "${allowedMcpTools.join(',')}"`;
            
            console.log(`🔧 Claude MCP Flags: ${mcpFlags}`);
            
            let claudeCommand;
            if (session.isResumed && session.claudeSessionId) {
                // For resumed sessions with UUID, use the proper claude command
                claudeCommand = `echo "${input.replace(/"/g, '\\"')}" | ${baseCommand} --resume ${session.claudeSessionId} ${mcpFlags}`;
            } else {
                // For new sessions
                claudeCommand = `echo "${input.replace(/"/g, '\\"')}" | ${baseCommand} ${mcpFlags}`;
            }

            const claude = spawn('sh', ['-c', claudeCommand], {
                cwd: __dirname,
                stdio: ['pipe', 'pipe', 'pipe']
            });

            let stdout = '';
            let stderr = '';

            claude.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            claude.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            claude.on('close', async (code) => {
                if (code === 0) {
                    // Save both user input and Claude response to conversation history
                    const updatedSession = this.getSession(sessionId);
                    const updatedHistory = [...(updatedSession.conversationHistory || [])];
                    
                    // Add user message
                    updatedHistory.push({
                        type: 'user',
                        content: input,
                        timestamp: new Date().toISOString()
                    });
                    
                    // Add Claude response
                    updatedHistory.push({
                        type: 'claude',
                        content: stdout,
                        timestamp: new Date().toISOString()
                    });
                    
                    // Update session with new conversation history
                    await this.updateSession(sessionId, { 
                        status: 'ready',
                        conversationHistory: updatedHistory,
                        metadata: {
                            ...session.metadata,
                            messageCount: session.metadata.messageCount + 2
                        }
                    });

                    console.log(`✅ Claude command completed for session: ${session.name}`);
                    resolve({ success: true, output: stdout, error: null });
                } else {
                    // Still save user input even if Claude command failed
                    const updatedSession = this.getSession(sessionId);
                    const updatedHistory = [...(updatedSession.conversationHistory || [])];
                    
                    updatedHistory.push({
                        type: 'user',
                        content: input,
                        timestamp: new Date().toISOString()
                    });
                    
                    await this.updateSession(sessionId, { 
                        status: 'ready',
                        conversationHistory: updatedHistory,
                        metadata: {
                            ...session.metadata,
                            messageCount: session.metadata.messageCount + 1
                        }
                    });

                    console.log(`❌ Claude command failed for session: ${session.name}`);
                    resolve({ success: false, output: stdout, error: stderr });
                }
            });

            claude.on('error', async (err) => {
                await this.updateSession(sessionId, { status: 'error' });
                console.error(`🚨 Failed to start Claude process for session: ${session.name}`, err);
                reject({ success: false, output: '', error: err.message });
            });
        });
    }

    /**
     * Cleanup all Claude processes (called on server shutdown)
     */
    async cleanup() {
        console.log('🧹 Cleaning up Claude processes...');
        
        const stopPromises = Array.from(this.claudeProcesses.keys()).map(sessionId => 
            this.stopClaudeProcess(sessionId)
        );
        
        await Promise.all(stopPromises);
        console.log('✅ All Claude processes stopped');
    }
}

module.exports = SessionManager;