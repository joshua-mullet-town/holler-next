/**
 * Session Discovery API
 * GET /api/sessions/discover
 * 
 * Discovers Claude sessions using Claudia's filesystem-based approach
 * Returns array of real Claude sessions with metadata
 */

import { NextRequest, NextResponse } from 'next/server';

const SessionDiscoveryService = require('../../../../lib/SessionDiscoveryService');

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const groupByDate = searchParams.get('groupByDate') === 'true';
    
    console.log(`🔍 API: Session discovery requested (limit: ${limit}, groupByDate: ${groupByDate})`);
    
    let result;
    if (groupByDate) {
      result = await SessionDiscoveryService.getSessionsGroupedByDate(limit);
    } else {
      result = await SessionDiscoveryService.getSessionsSortedByModified(limit);
    }
    
    console.log(`🔍 API: Returning ${groupByDate ? 'grouped' : 'sorted'} sessions`);
    
    return NextResponse.json({
      success: true,
      sessions: result,
      timestamp: Date.now(),
      grouped: groupByDate
    });
    
  } catch (error) {
    console.error('❌ Session discovery API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Session discovery failed',
      sessions: []
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, sessionId } = await request.json();
    
    if (action === 'validate') {
      // Validate if a specific session exists
      const exists = await SessionDiscoveryService.sessionExists(sessionId);
      const session = exists ? await SessionDiscoveryService.getSession(sessionId) : null;
      
      return NextResponse.json({
        success: true,
        exists,
        session,
        sessionId
      });
      
    } else if (action === 'stats') {
      // Get discovery statistics
      const stats = await SessionDiscoveryService.getStats();
      
      return NextResponse.json({
        success: true,
        stats
      });
      
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid action. Use "validate" or "stats"'
      }, { status: 400 });
    }
    
  } catch (error) {
    console.error('❌ Session discovery POST API error:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Discovery action failed'
    }, { status: 500 });
  }
}