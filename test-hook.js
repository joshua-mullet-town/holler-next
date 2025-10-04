#!/usr/bin/env node

/**
 * Test script to inject a simple prompt via PTY and see if hooks fire
 */

const io = require('socket.io-client');

const HOLLER_SERVER_URL = 'http://localhost:3002';

async function testHookWithPTY() {
    console.log('🧪 Testing if Claude Code hooks work with PTY...');
    
    // Connect to Holler server
    const socket = io(HOLLER_SERVER_URL);
    
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            socket.disconnect();
            reject(new Error('Connection timeout'));
        }, 10000);
        
        socket.on('connect', () => {
            console.log('✅ Connected to Holler server');
            clearTimeout(timeout);
            
            // Use the first available terminal from execution mappings
            const terminalId = 'terminal-1759495678009';
            
            console.log(`📝 Injecting test prompt into terminal: ${terminalId}`);
            
            // Inject a simple test prompt
            const testPrompt = 'What is 2+2? (This is a hook test)';
            
            socket.emit('terminal:inject-message', {
                terminalId: terminalId,
                message: testPrompt
            });
            
            // Wait a moment for the prompt to be processed
            setTimeout(() => {
                console.log('⏳ Waiting for hook to fire...');
                socket.disconnect();
                resolve();
            }, 3000);
        });
        
        socket.on('connect_error', (error) => {
            clearTimeout(timeout);
            socket.disconnect();
            reject(new Error(`Connection failed: ${error.message}`));
        });
    });
}

// Run the test
testHookWithPTY().then(() => {
    console.log('🔍 Checking if hook fired...');
    
    // Check if the test file was created
    const fs = require('fs');
    
    if (fs.existsSync('/tmp/claude-hook-test.txt')) {
        console.log('🎉 SUCCESS! Hook fired with PTY setup!');
        const content = fs.readFileSync('/tmp/claude-hook-test.txt', 'utf8');
        console.log('📄 Hook output:');
        console.log(content);
    } else {
        console.log('❌ FAILED: Hook did not fire with PTY setup');
        console.log('💡 This means hooks don\'t work with our current terminal injection method');
    }
}).catch(error => {
    console.error('❌ Test error:', error.message);
});