import { NextRequest, NextResponse } from 'next/server';
const SessionManager = require('../../../../lib/SessionManager');

const sessionManager = new SessionManager();


export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const session = sessionManager.getSession(sessionId);
    
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      session
    });
  } catch (error) {
    console.error(`❌ Error getting session:`, error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const updates = await request.json();
    
    console.log(`🔄 PATCH request for session ${sessionId}:`, updates);
    
    // Update the session using the main SessionManager
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }
    
    // Update the session
    const updatedSession = { ...session, ...updates };
    sessionManager.sessions.set(sessionId, updatedSession);
    sessionManager.saveSessions();
    
    console.log(`✅ Updated session ${sessionId} name to: ${updates.name}`);
    
    return NextResponse.json({ 
      success: true, 
      session: updatedSession 
    });
  } catch (error) {
    console.error(`❌ Error updating session:`, error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  console.log(`🗑️ BACKEND DELETE: API DELETE request for session: ${sessionId}`);
  
  let jsonDeleted = false;
  let terminalKilled = false;
  let errors = [];
  
  // Try to delete from JSON (don't fail if not found)
  try {
    console.log(`📋 BACKEND DELETE: Attempting JSON deletion for session: ${sessionId}`);
    const SessionManager = require('../../../../lib/SessionManager');
    const sessionManager = new SessionManager();
    
    // Check if session exists before deletion
    const existingSession = sessionManager.getSession(sessionId);
    console.log(`🔍 BACKEND DELETE: Session exists in JSON: ${!!existingSession}`);
    if (existingSession) {
      console.log(`🔍 BACKEND DELETE: Session data:`, JSON.stringify(existingSession, null, 2));
    }
    
    const deletionResult = sessionManager.deleteSession(sessionId);
    console.log(`📋 BACKEND DELETE: Deletion result:`, deletionResult);
    
    if (deletionResult.success) {
      console.log(`✅ BACKEND DELETE: Successfully deleted session from JSON: ${sessionId}`);
      jsonDeleted = true;
    } else {
      console.log(`⚠️ BACKEND DELETE: Session not found in JSON: ${sessionId} (might already be deleted)`);
      errors.push(`Session not found in JSON: ${deletionResult.error || 'Unknown error'}`);
    }
  } catch (error) {
    console.error(`❌ BACKEND DELETE: Error deleting from JSON: ${sessionId}`, error);
    errors.push(`JSON deletion error: ${error.message}`);
  }
  
  // Always try to kill the terminal regardless of JSON result
  try {
    const terminalId = `terminal-${sessionId.replace('session-', '')}`;
    console.log(`🔌 BACKEND DELETE: Attempting terminal kill for session: ${sessionId}, terminal: ${terminalId}`);
    
    const terminalResponse = await fetch('http://localhost:3002/api/sessions/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, terminalId })
    });
    
    console.log(`🔌 BACKEND DELETE: Terminal kill response status: ${terminalResponse.status}`);
    
    if (terminalResponse.ok) {
      const terminalResult = await terminalResponse.json();
      console.log(`🔌 BACKEND DELETE: Terminal kill result:`, terminalResult);
      console.log(`✅ BACKEND DELETE: Successfully attempted terminal kill for session: ${sessionId}`);
      terminalKilled = true;
    } else {
      console.error(`❌ BACKEND DELETE: Terminal kill failed with status: ${terminalResponse.status}`);
      errors.push(`Terminal kill failed: HTTP ${terminalResponse.status}`);
    }
  } catch (error) {
    console.error(`❌ BACKEND DELETE: Error killing terminal for ${sessionId}:`, error);
    errors.push(`Terminal kill error: ${error.message}`);
  }
  
  // Always return success - frontend should always update UI
  const summary = {
    sessionId,
    jsonDeleted,
    terminalKilled,
    errors: errors.length > 0 ? errors : null,
    timestamp: new Date().toISOString()
  };
  
  console.log(`🧹 BACKEND DELETE: Deletion cleanup completed for ${sessionId}:`, summary);
  
  return NextResponse.json({ 
    success: true, 
    details: summary
  });
}