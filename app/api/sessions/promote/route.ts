/**
 * Session Promotion API
 * POST /api/sessions/promote
 * 
 * Promotes a discovered Claude session to an active Holler session
 */

import { NextRequest, NextResponse } from 'next/server';

const SessionManager = require('../../../../lib/SessionManager');
const SessionDiscoveryService = require('../../../../lib/SessionDiscoveryService');

export async function POST(request: NextRequest) {
  try {
    const { claudeSessionId, name, projectPath } = await request.json();
    
    if (!claudeSessionId || !name) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: claudeSessionId and name'
      }, { status: 400 });
    }
    
    console.log(`🔍 API: Session promotion requested - Claude ID: ${claudeSessionId}, Name: ${name}`);
    
    // Validate that the Claude session exists
    const claudeSession = await SessionDiscoveryService.getSession(claudeSessionId);
    if (!claudeSession) {
      return NextResponse.json({
        success: false,
        error: `Claude session ${claudeSessionId} not found`
      }, { status: 404 });
    }
    
    // Check if already promoted
    const sessionManager = new SessionManager();
    const existingSession = sessionManager.findHollerSessionByClaudeId(claudeSessionId);
    if (existingSession) {
      return NextResponse.json({
        success: false,
        error: `Claude session already promoted as "${existingSession.name}"`
      }, { status: 409 });
    }
    
    // Generate new Holler session ID
    const hollerSessionId = `session-${Date.now()}`;
    const terminalId = `terminal-${Date.now()}`;
    
    // Create the promoted session
    const promotedSession = {
      id: hollerSessionId,
      name: name.trim(),
      created: new Date().toISOString(),
      terminalId: terminalId,
      claudeSessionId: claudeSessionId,
      promoted: true,
      promotedAt: new Date().toISOString(),
      projectPath: projectPath || claudeSession.projectPath || '/Users/joshuamullet/code/holler',
      fileSize: claudeSession.fileSize,
      lastMessage: claudeSession.lastMessage
    };
    
    // Add to session manager
    sessionManager.addSession(promotedSession);
    sessionManager.saveSessions();
    
    console.log(`✅ API: Session promoted successfully - Holler ID: ${hollerSessionId}`);
    
    return NextResponse.json({
      success: true,
      session: promotedSession,
      claudeSession: claudeSession
    });
    
  } catch (error) {
    console.error('❌ Session promotion API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Session promotion failed'
    }, { status: 500 });
  }
}