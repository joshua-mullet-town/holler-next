#!/usr/bin/env node

/**
 * 🌐 Web-based SQLite Database Viewer
 * 
 * Starts a simple web server to view SQLite data without locking the database.
 * Uses read-only connections that don't block writes.
 */

const http = require('http');
const Database = require('better-sqlite3');
const fs = require('fs');

const PORT = 3003;
const DB_PATH = '/Users/joshuamullet/code/holler/holler.db';

function createWebViewer() {
  const server = http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Content-Type', 'text/html');

    if (req.url === '/') {
      res.end(`
<!DOCTYPE html>
<html>
<head>
    <title>Holler SQLite Viewer</title>
    <style>
        body { font-family: monospace; margin: 20px; background: #1a1a1a; color: #fff; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #555; padding: 8px; text-align: left; }
        th { background: #333; }
        .section { margin: 30px 0; }
        .stats { background: #2a2a2a; padding: 15px; border-radius: 5px; }
        .refresh { background: #0066cc; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; }
    </style>
    <script>
        setInterval(() => location.reload(), 5000); // Auto-refresh every 5 seconds
    </script>
</head>
<body>
    <h1>🗄️ Holler SQLite Database Viewer</h1>
    <button class="refresh" onclick="location.reload()">🔄 Refresh</button>
    <div id="content">Loading...</div>
    
    <script>
        fetch('/data')
            .then(r => r.json())
            .then(data => {
                document.getElementById('content').innerHTML = data.html;
            })
            .catch(e => {
                document.getElementById('content').innerHTML = '<p>Error: ' + e.message + '</p>';
            });
    </script>
</body>
</html>
      `);
    } else if (req.url === '/data') {
      try {
        // Open database in read-only mode
        const db = new Database(DB_PATH, { readonly: true });
        
        let html = '';
        
        // Stats
        const sessionCount = db.prepare('SELECT COUNT(*) as count FROM sessions').get().count;
        const correlationCount = db.prepare('SELECT COUNT(*) as count FROM sessions WHERE last_uuid IS NOT NULL').get().count;
        
        html += `
          <div class="stats">
            <h2>📊 Database Statistics</h2>
            <p><strong>Sessions:</strong> ${sessionCount}</p>
            <p><strong>Correlations:</strong> ${correlationCount}</p>
            <p><strong>Last Updated:</strong> ${new Date().toLocaleTimeString()}</p>
          </div>
        `;
        
        // Sessions table
        const sessions = db.prepare('SELECT * FROM sessions ORDER BY created DESC').all();
        html += `
          <div class="section">
            <h2>📋 Sessions</h2>
            <table>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Created</th>
                <th>Claude ID</th>
                <th>Jarvis Mode</th>
                <th>Mode</th>
                <th>Last UUID</th>
                <th>Plan</th>
              </tr>
        `;
        
        sessions.forEach(session => {
          html += `
            <tr>
              <td>${session.id}</td>
              <td>${session.name}</td>
              <td>${new Date(session.created).toLocaleString()}</td>
              <td>${session.claude_session_id || '(none)'}</td>
              <td>${session.jarvis_mode ? 'YES' : 'NO'}</td>
              <td>${session.mode || '(none)'}</td>
              <td>${session.last_uuid || '(none)'}</td>
              <td>${session.plan ? session.plan.substring(0, 50) + '...' : '(none)'}</td>
            </tr>
          `;
        });
        
        html += '</table></div>';
        
        // Correlations (now part of sessions table)
        const correlations = db.prepare('SELECT id, last_uuid, correlation_updated_at FROM sessions WHERE last_uuid IS NOT NULL ORDER BY correlation_updated_at DESC').all();
        html += `
          <div class="section">
            <h2>🔗 Correlations (Unified)</h2>
            <table>
              <tr>
                <th>Session ID</th>
                <th>Last UUID</th>
                <th>Updated At</th>
              </tr>
        `;
        
        correlations.forEach(corr => {
          html += `
            <tr>
              <td>${corr.id}</td>
              <td>${corr.last_uuid}</td>
              <td>${corr.correlation_updated_at ? new Date(corr.correlation_updated_at).toLocaleString() : '(unknown)'}</td>
            </tr>
          `;
        });
        
        html += '</table></div>';
        
        db.close();
        
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ html }));
        
      } catch (error) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ 
          html: `<p style="color: red;">Database Error: ${error.message}</p>` 
        }));
      }
    } else {
      res.statusCode = 404;
      res.end('Not found');
    }
  });

  server.listen(PORT, () => {
    console.log(`🌐 SQLite Web Viewer running at:`);
    console.log(`   http://localhost:${PORT}`);
    console.log(`🔄 Auto-refreshes every 5 seconds`);
    console.log(`📖 Read-only mode - won't block database writes`);
    console.log(`🛑 Press Ctrl+C to stop`);
  });
}

// Check if database exists
if (!fs.existsSync(DB_PATH)) {
  console.error(`❌ Database not found: ${DB_PATH}`);
  process.exit(1);
}

createWebViewer();