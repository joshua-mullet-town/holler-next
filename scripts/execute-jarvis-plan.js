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

const SESSIONS_FILE = '/Users/joshuamullet/code/holler/holler-sessions.json';
const HOLLER_SERVER_URL = 'http://localhost:3002';

async function executeJarvisPlan() {
    try {
        console.log('🚀 JARVIS: Starting plan execution workflow...');
        
        // 1. Read and update holler-sessions.json
        const sessionsData = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
        const activeSessionId = sessionsData.activeSessionId;
        
        // Find active Jarvis session
        const activeSession = sessionsData.sessions.find(s => 
            s.id === activeSessionId && s.jarvisMode === true
        );
        
        if (!activeSession) {
            console.log('❌ No active Jarvis session found');
            return;
        }
        
        const plan = activeSession.plan;
        if (!plan) {
            console.log('❌ No plan found in active session');
            return;
        }
        
        console.log(`🎯 Found active Jarvis session: ${activeSession.name}`);
        console.log(`📋 Plan length: ${plan.length} characters`);
        
        // 2. Update mode to execution
        activeSession.mode = 'execution';
        activeSession.lastUpdated = new Date().toISOString();
        
        // Save updated sessions
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessionsData, null, 2));
        console.log('✅ Updated session mode to execution');
        
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

        // 4. Connect to Holler server and inject messages
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