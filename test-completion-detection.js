#!/usr/bin/env node

/**
 * Test Runner for Completion Detection
 * 
 * Run this script to start monitoring Claude sessions for completion events
 * and test the full message extraction workflow.
 */

const CompletionDetectionTest = require('./lib/CompletionDetectionTest');

async function main() {
  console.log('🧪 Starting Completion Detection Test Runner');
  console.log('📋 This will monitor Claude sessions and test message extraction');
  console.log('🎯 Go respond to something in your Jarvis Mode session to trigger detection\n');

  const detector = new CompletionDetectionTest();
  
  try {
    await detector.start();
    
    // Show status
    const status = detector.getStatus();
    console.log('📊 Detection Status:', status);
    console.log('\n✅ Test runner active - respond to a Claude session to test detection');
    console.log('🛑 Press Ctrl+C to stop\n');

    // Keep the process running
    process.on('SIGINT', async () => {
      console.log('\n🛑 Stopping completion detection test...');
      await detector.stop();
      process.exit(0);
    });

    // Prevent the script from exiting
    setInterval(() => {
      // Just keep alive
    }, 1000);

  } catch (error) {
    console.error('❌ Error starting completion detection test:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = main;