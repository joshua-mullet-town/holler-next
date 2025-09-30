#!/usr/bin/env node

/**
 * 🗄️ SQLite Database Viewer
 * 
 * Interactive viewer for the Holler SQLite database.
 * Shows live data and statistics.
 */

const HollerDatabase = require('../lib/Database');

class DatabaseViewer {
  constructor() {
    this.db = new HollerDatabase();
  }

  showAll() {
    console.log('🗄️ HOLLER SQLITE DATABASE VIEWER\n');
    console.log('=' .repeat(60));
    
    this.showStats();
    this.showSessions();
    this.showCorrelations();
    this.showMetadata();
    
    console.log('=' .repeat(60));
    console.log('💡 Database location:', this.db.dbPath);
    console.log('🗄️ Storage mode: SQLite-only');
  }

  showStats() {
    const stats = this.db.getStats();
    console.log('\n📊 DATABASE STATISTICS');
    console.log('-'.repeat(30));
    console.log(`Sessions: ${stats.sessions}`);
    console.log(`Correlations: ${stats.correlations}`);
    console.log(`Database: ${stats.databasePath}`);
  }

  showSessions() {
    console.log('\n📋 SESSIONS TABLE');
    console.log('-'.repeat(50));
    
    const sessions = this.db.getAllSessions();
    
    if (sessions.length === 0) {
      console.log('(No sessions found)');
      return;
    }

    sessions.forEach(session => {
      console.log(`\n🔹 ${session.id}`);
      console.log(`   Name: ${session.name}`);
      console.log(`   Created: ${session.created}`);
      console.log(`   Terminal: ${session.terminalId}`);
      console.log(`   Claude ID: ${session.claudeSessionId || '(none)'}`);
      console.log(`   Jarvis Mode: ${session.jarvisMode ? 'YES' : 'NO'}`);
      console.log(`   Mode: ${session.mode || '(none)'}`);
      console.log(`   Last UUID: ${session.lastUuid || '(none)'}`);
      if (session.plan) {
        console.log(`   Plan: ${session.plan.substring(0, 50)}...`);
      }
    });
  }

  showCorrelations() {
    console.log('\n🔗 CORRELATIONS TABLE');
    console.log('-'.repeat(50));
    
    const correlations = this.db.getAllCorrelations();
    
    if (correlations.size === 0) {
      console.log('(No correlations found)');
      return;
    }

    correlations.forEach((uuid, sessionId) => {
      console.log(`🔸 ${sessionId} → ${uuid}`);
    });
  }

  showMetadata() {
    console.log('\n📋 METADATA TABLE');
    console.log('-'.repeat(30));
    
    const activeSessionId = this.db.getMetadata('activeSessionId');
    console.log(`Active Session: ${activeSessionId || '(none)'}`);
  }

  watchChanges() {
    console.log('\n👀 WATCHING FOR CHANGES...');
    console.log('Press Ctrl+C to stop\n');
    
    let lastStats = this.db.getStats();
    
    setInterval(() => {
      const currentStats = this.db.getStats();
      
      if (JSON.stringify(currentStats) !== JSON.stringify(lastStats)) {
        console.log(`\n🔄 ${new Date().toLocaleTimeString()} - Database changed!`);
        console.log(`Sessions: ${lastStats.sessions} → ${currentStats.sessions}`);
        console.log(`Correlations: ${lastStats.correlations} → ${currentStats.correlations}`);
        lastStats = currentStats;
      }
    }, 1000);
  }
}

// Command line interface
const command = process.argv[2];
const viewer = new DatabaseViewer();

switch (command) {
  case 'watch':
    viewer.watchChanges();
    break;
  case 'sessions':
    viewer.showSessions();
    break;
  case 'correlations':
    viewer.showCorrelations();
    break;
  case 'stats':
    viewer.showStats();
    break;
  default:
    viewer.showAll();
    console.log('\n💡 Commands:');
    console.log('  node scripts/db-viewer.js           # Show everything');
    console.log('  node scripts/db-viewer.js watch     # Watch for changes');
    console.log('  node scripts/db-viewer.js sessions  # Sessions only');
    console.log('  node scripts/db-viewer.js stats     # Stats only');
}