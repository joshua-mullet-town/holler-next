import { NextRequest, NextResponse } from 'next/server';
import SessionManager from '../../../../../lib/session-manager';

// Initialize SessionManager instance
const sessionManager = new SessionManager();

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const { sessionId } = params;
    const history = await sessionManager.loadSessionHistory(sessionId);
    return NextResponse.json({ success: true, history });
  } catch (error) {
    console.error('🚨 Error loading session history:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}