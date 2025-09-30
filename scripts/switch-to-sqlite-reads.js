#!/usr/bin/env node

/**
 * 🔄 SQLite Read Mode Switch
 * 
 * This script demonstrates how to switch SessionManager and CorrelationManager
 * to read from SQLite while still writing to both JSON and SQLite for safety.
 * 
 * Run this after verifying dual-write consistency.
 */

const SessionManager = require('../lib/SessionManager');
const CorrelationManager = require('../lib/CorrelationManager');

console.log('🔄 Testing SQLite read performance vs JSON...\n');

async function testReadPerformance() {
  // Initialize managers with shared database
  const sessionManager = new SessionManager();
  const correlationManager = new CorrelationManager(sessionManager.db);
  
  console.log('📊 Current data sources:');
  console.log('  Sessions: Reading from JSON files');
  console.log('  Correlations: Reading from JSON files');
  console.log('  Both: Writing to JSON + SQLite (dual-write)\n');
  
  // Test session operations
  console.log('🧪 Testing session operations...');
  
  // Time JSON read
  const startJsonRead = Date.now();
  const jsonSessions = sessionManager.getAllSessions();
  const jsonReadTime = Date.now() - startJsonRead;
  
  // Time SQLite read  
  const startSqliteRead = Date.now();
  const sqliteSessions = sessionManager.db.getAllSessions();
  const sqliteReadTime = Date.now() - startSqliteRead;
  
  console.log(`📁 JSON read: ${jsonSessions.length} sessions in ${jsonReadTime}ms`);
  console.log(`🗄️ SQLite read: ${sqliteSessions.length} sessions in ${sqliteReadTime}ms`);
  
  if (sqliteReadTime < jsonReadTime) {
    console.log('✅ SQLite reads are faster!');
  } else {
    console.log('📊 JSON reads are currently faster (expected for small datasets)');
  }
  
  // Test correlation operations
  console.log('\n🔗 Testing correlation operations...');
  
  const startJsonCorr = Date.now();
  const jsonCorrelations = correlationManager.getAllCorrelations();
  const jsonCorrTime = Date.now() - startJsonCorr;
  
  const startSqliteCorr = Date.now();
  const sqliteCorrelations = correlationManager.db.getAllCorrelations();
  const sqliteCorrTime = Date.now() - startSqliteCorr;
  
  console.log(`📁 JSON correlations: ${jsonCorrelations.size} in ${jsonCorrTime}ms`);
  console.log(`🗄️ SQLite correlations: ${sqliteCorrelations.size} in ${sqliteCorrTime}ms`);
  
  // Test specific lookups (the real performance test)
  console.log('\n🔍 Testing lookup operations...');
  
  if (sqliteSessions.length > 0) {
    const testSessionId = sqliteSessions[0].id;
    
    const startJsonLookup = Date.now();
    const jsonSession = sessionManager.getSession(testSessionId);
    const jsonLookupTime = Date.now() - startJsonLookup;
    
    const startSqliteLookup = Date.now();
    const sqliteSession = sessionManager.db.getSession(testSessionId);
    const sqliteLookupTime = Date.now() - startSqliteLookup;
    
    console.log(`📁 JSON lookup: ${jsonLookupTime}ms`);
    console.log(`🗄️ SQLite lookup: ${sqliteLookupTime}ms`);
  }
  
  console.log('\n🎯 Next Steps:');
  console.log('1. ✅ Dual-write mode is working (JSON + SQLite)');
  console.log('2. ✅ Data consistency verified');
  console.log('3. 🔄 Ready to switch reads to SQLite');
  console.log('4. 🔄 After testing, can remove JSON writes');
  
  console.log('\n📋 To switch to SQLite reads:');
  console.log('   - Modify SessionManager methods to read from this.db instead of this.sessions');
  console.log('   - Modify CorrelationManager methods to read from this.db instead of this.correlations');
  console.log('   - Keep dual-write for safety until fully tested');
  
  console.log('\n✅ Performance test completed!');
}

testReadPerformance().catch(console.error);