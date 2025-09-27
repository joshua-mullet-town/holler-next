/**
 * Integration snippet for server-working.js
 * 
 * Replace the existing hook-based auto-correlation with file monitoring
 * Add this code to your server-working.js file
 */

// At the top of server-working.js, add these imports:
const HookAlternativeIntegration = require('./lib/HookAlternativeIntegration');

// After creating sessionManager and io, add this initialization:
let hookAlternative;

// Initialize the hook alternative system
async function initializeHookAlternative() {
  try {
    hookAlternative = new HookAlternativeIntegration(sessionManager, io);
    await hookAlternative.start();
    console.log('✅ Hook alternative system initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize hook alternative system:', error);
  }
}

// Add this after your server starts
initializeHookAlternative();

// REMOVE/REPLACE this existing hook-based auto-correlation code:
/*
// OLD CODE TO REMOVE (around line 351-398 in server-working.js):
app.post('/api/claude-session-event', (req, res) => {
  // ... existing hook handler code ...
  // This entire handler can be removed since file monitoring replaces it
});
*/

// ADD this new endpoint to check monitoring status:
app.get('/api/monitoring-status', (req, res) => {
  if (hookAlternative) {
    res.json({
      success: true,
      status: hookAlternative.getStatus()
    });
  } else {
    res.json({
      success: false,
      error: 'Hook alternative system not initialized'
    });
  }
});

// Add graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Graceful shutdown initiated...');
  if (hookAlternative) {
    await hookAlternative.stop();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('🛑 Graceful shutdown initiated...');
  if (hookAlternative) {
    await hookAlternative.stop();
  }
  process.exit(0);
});

// You can also add a manual correlation endpoint for testing:
app.post('/api/manual-correlation', async (req, res) => {
  const { hollerSessionId, claudeSessionId } = req.body;
  
  if (!hollerSessionId || !claudeSessionId) {
    return res.status(400).json({
      success: false,
      error: 'hollerSessionId and claudeSessionId are required'
    });
  }

  try {
    const linkSuccess = sessionManager.updateSessionWithClaude(hollerSessionId, claudeSessionId);
    
    if (linkSuccess) {
      // Broadcast the update
      io.emit('session:linked', {
        sessionId: hollerSessionId,
        claudeSessionId: claudeSessionId,
        timestamp: new Date().toISOString()
      });

      const sessionsData = sessionManager.getSessionsForFrontend();
      io.emit('session:list', sessionsData);

      res.json({
        success: true,
        message: `Successfully linked ${hollerSessionId} ↔ ${claudeSessionId}`
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Failed to link sessions'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/*
 * SUMMARY OF CHANGES:
 * 
 * 1. REMOVED: Hook-based auto-correlation endpoint `/api/claude-session-event`
 * 2. ADDED: File monitoring system that detects Claude activity in real-time
 * 3. ADDED: Auto-correlation triggered by actual session file creation
 * 4. ADDED: Status updates triggered by user messages and Claude responses
 * 5. ADDED: Observer AI trigger points for future autonomous mode
 * 6. ADDED: Browser notifications instead of system beeps
 * 
 * BENEFITS:
 * - No more timing race conditions
 * - Works with PTY/browser terminal interface
 * - Real-time detection of Claude activity
 * - Foundation for Observer AI system
 * - Reliable session correlation
 */