import { NextRequest, NextResponse } from 'next/server';

/**
 * Clone a Claude conversation to create true conversation forking
 * POST /api/sessions/clone
 */
export async function POST(request: NextRequest) {
  try {
    const { originalClaudeSessionId, newClaudeSessionId } = await request.json();
    
    console.log(`🔄 API: Cloning conversation ${originalClaudeSessionId} -> ${newClaudeSessionId}`);
    
    if (!originalClaudeSessionId || !newClaudeSessionId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing originalClaudeSessionId or newClaudeSessionId' 
      }, { status: 400 });
    }
    
    const SessionManager = require('/Users/joshuamullet/code/holler/holler-next/lib/SessionManager');
    const sessionManager = new SessionManager();
    
    const result = await sessionManager.cloneConversation(
      originalClaudeSessionId, 
      newClaudeSessionId
    );
    
    if (result.success) {
      console.log(`✅ API: Successfully cloned conversation to ${result.newSessionId}`);
      return NextResponse.json({ 
        success: true, 
        newSessionId: result.newSessionId,
        messageCount: result.messageCount
      });
    } else {
      console.error(`❌ API: Conversation cloning failed: ${result.error}`);
      return NextResponse.json({ 
        success: false, 
        error: result.error 
      }, { status: 500 });
    }
    
  } catch (error) {
    console.error('❌ API: Clone endpoint error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}