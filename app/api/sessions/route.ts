import { NextRequest, NextResponse } from 'next/server';
import SimpleSessionManager from '../../../lib/simple-session-manager';

const sessionManager = new SimpleSessionManager();
let initialized = false;

async function ensureInitialized() {
  if (!initialized) {
    await sessionManager.initialize();
    initialized = true;
  }
}

export async function GET() {
  await ensureInitialized();
  
  try {
    const sessions = sessionManager.getAllSessions();
    const sessionMap = {};
    sessions.forEach(session => {
      sessionMap[session.id] = session;
    });

    return NextResponse.json({
      success: true,
      sessions: sessionMap
    });
  } catch (error) {
    console.error('❌ Error getting sessions:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  await ensureInitialized();
  
  try {
    const body = await request.json();
    console.log('🔍 API: Creating session with body:', JSON.stringify(body, null, 2));
    const session = await sessionManager.createSession({
      name: body.name,
      projectPath: body.projectPath,
      claudeSessionId: body.claudeSessionId
    });
    
    return NextResponse.json({
      success: true,
      session
    }, { status: 201 });
  } catch (error) {
    console.error('❌ Error creating session:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  await ensureInitialized();
  
  try {
    const body = await request.json();
    const { sessionId, ...updates } = body;
    
    const updatedSession = await sessionManager.updateSession(sessionId, updates);
    
    return NextResponse.json({
      success: true,
      session: updatedSession
    });
  } catch (error) {
    console.error('❌ Error updating session:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}