import { NextRequest, NextResponse } from 'next/server';
import SessionManager from '../../../../../lib/session-manager';

const sessionManager = new SessionManager();

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    await sessionManager.initialize();
    const { sessionId } = params;

    console.log(`🔄 [API] Manual compact requested for session: ${sessionId}`);

    // Create ReadableStream for real-time updates
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        try {
          const compactGenerator = sessionManager.compactSession(sessionId);
          
          for await (const result of compactGenerator) {
            const data = `data: ${JSON.stringify(result)}\n\n`;
            controller.enqueue(encoder.encode(data));
          }
          
          // Send completion signal
          const completionData = `data: ${JSON.stringify({ type: 'done' })}\n\n`;
          controller.enqueue(encoder.encode(completionData));
          
        } catch (error) {
          console.error(`❌ [API] Compact error for session ${sessionId}:`, error);
          const errorData = `data: ${JSON.stringify({ 
            type: 'error', 
            error: error.message 
          })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
        } finally {
          controller.close();
        }
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('❌ [API] Failed to initialize compact:', error);
    return NextResponse.json(
      { error: 'Failed to compact session', details: error.message },
      { status: 500 }
    );
  }
}