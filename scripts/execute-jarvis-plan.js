#!/usr/bin/env node

/**
 * Execute Jarvis Plan Script
 * 
 * This script handles the complete "go to pound town claude code" workflow:
 * 1. Update session mode from planning to execution
 * 2. Notify Holler server to inject /clear command
 * 3. Notify Holler server to inject execution prompt as user message
 */

const fs = require('fs');
const path = require('path');
const io = require('socket.io-client');
const SessionManager = require('../lib/SessionManager');

const HOLLER_SERVER_URL = 'http://localhost:3002';

async function executeJarvisPlan() {
    try {
        console.log('🚀 JARVIS: Starting plan execution workflow...');
        
        // 1. Get active session from SQLite
        const sessionManager = new SessionManager();
        const activeSessionId = sessionManager.getActiveSessionId();
        
        if (!activeSessionId) {
            console.log('❌ No active session found');
            return;
        }
        
        // Get the active session
        const activeSession = sessionManager.getSession(activeSessionId);
        if (!activeSession) {
            console.log('❌ Active session not found in database');
            console.log('🔍 DEBUG: activeSessionId:', activeSessionId);
            return;
        }
        
        // Verify it's a Jarvis session
        if (!activeSession.jarvisMode) {
            console.log('❌ Active session is not in Jarvis mode');
            return;
        }
        
        const plan = activeSession.plan;
        if (!plan) {
            console.log('❌ No plan found for active session');
            console.log('🔍 DEBUG: activeSession:', JSON.stringify(activeSession, null, 2));
            return;
        }
        
        console.log(`🎯 Found active Jarvis session: ${activeSession.name}`);
        console.log(`📋 Plan length: ${plan.length} characters`);
        
        // 2. Update mode to execution and clear session correlation for fresh start
        const updated = sessionManager.db.updateSession(activeSessionId, {
            mode: 'execution',
            claudeSessionId: null,
            lastUuid: null
        });
        if (!updated) {
            console.log('❌ Failed to update session mode to execution');
            return;
        }
        console.log('✅ Updated session mode to execution');
        console.log('✅ Cleared claudeSessionId and lastUuid for fresh session correlation');
        
        // 3. Build execution prompt
        const executionPrompt = `/clear

🚀 **EXECUTION MODE: One-Shot Plan Implementation**

Execute this plan completely and thoroughly:

\`\`\`
${plan}
\`\`\`

**ULTRA-THINK APPROACH**: Think deeply about each step before acting. This is your only chance - make it count.

**Critical Instructions:**
- Complete the entire plan, not just part of it
- Verify each change you make
- Test your work as you go

**Session ID**: ${activeSession.id}
**Mode**: EXECUTION (one-shot)

**BEGIN EXECUTION NOW**`;

        // 4. Store execution session mapping for completion detection
        console.log('💾 Storing execution session mapping...');
        const executionMapping = {
            hollerSessionId: activeSession.id,
            terminalId: activeSession.terminalId,
            startTime: new Date().toISOString()
        };
        
        // Store mapping for completion detection (simple file-based approach)
        const mappingFile = '/Users/joshuamullet/code/holler/holler-next/execution-mappings.json';
        let mappings = {};
        try {
            mappings = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
        } catch (e) {
            // File doesn't exist yet, start fresh
        }
        
        // We'll update this with the actual execution session ID after it starts
        mappings.pendingExecution = executionMapping;
        fs.writeFileSync(mappingFile, JSON.stringify(mappings, null, 2));
        console.log('✅ Execution mapping stored for completion detection');

        // 5. Connect to Holler server and inject messages
        console.log('🔌 Connecting to Holler server...');
        const socket = io(HOLLER_SERVER_URL);
        
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                socket.disconnect();
                reject(new Error('Connection timeout'));
            }, 10000); // Shorter timeout since we're not blocking anymore
            
            socket.on('connect', () => {
                console.log('✅ Connected to Holler server');
                clearTimeout(timeout);
                
                // Schedule clear command for 10 seconds from now
                console.log('📅 Scheduling /clear command for 10 seconds...');
                socket.emit('schedule:execution', {
                    terminalId: activeSession.terminalId,
                    delaySeconds: 10,
                    command: '/clear'
                });
                
                // Schedule execution prompt for 15 seconds from now (10 + 5)
                console.log('📅 Scheduling execution prompt for 15 seconds...');
                socket.emit('schedule:execution', {
                    terminalId: activeSession.terminalId, 
                    delaySeconds: 15,
                    command: executionPrompt
                });
                
                // Wait briefly for scheduling confirmations, then disconnect
                setTimeout(() => {
                    console.log('✅ Both commands scheduled - disconnecting immediately');
                    socket.disconnect();
                    resolve({
                        success: true,
                        sessionId: activeSession.id,
                        sessionName: activeSession.name,
                        terminalId: activeSession.terminalId,
                        clearScheduled: true,
                        executionScheduled: true,
                        message: "Non-blocking job queue approach - commands scheduled for execution"
                    });
                }, 1000); // Just wait 1 second for confirmations
            });
            
            socket.on('connect_error', (error) => {
                clearTimeout(timeout);
                socket.disconnect();
                reject(new Error(`Connection failed: ${error.message}`));
            });
        });
        
    } catch (error) {
        console.log('❌ Error executing Jarvis plan:', error.message);
        return { success: false, error: error.message };
    }
}

// Run if called directly
if (require.main === module) {
    executeJarvisPlan().then(result => {
        if (result.success) {
            console.log('🎯 JARVIS SCHEDULING COMPLETE!');
            console.log(`✅ Session ${result.sessionName} switched to execution mode`);
            console.log(`📅 Commands scheduled for terminal ${result.terminalId}`);
            console.log('⏰ Clear command will execute in 10 seconds');
            console.log('⏰ Execution prompt will run in 15 seconds');
            console.log('🚀 Script finished - backend will handle execution!');
        } else {
            console.log('❌ Failed:', result.error);
            process.exit(1);
        }
    }).catch(error => {
        console.log('❌ Script error:', error.message);
        process.exit(1);
    });
}

module.exports = { executeJarvisPlan };