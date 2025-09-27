/**
 * 🎯 WebSocket Server - Terminal I/O Bridge
 */

import { Server } from 'socket.io';
import type { NextRequest } from 'next/server';
import TerminalManager from '../../../lib/terminal-manager';

const terminalManager = new TerminalManager();

export async function GET(req: NextRequest) {
  // This will be handled by the Socket.IO server
  // The actual WebSocket logic needs to be in a different setup
  return new Response('WebSocket endpoint - use Socket.IO client', { status: 200 });
}

// We need to set up Socket.IO differently in Next.js 13+ app router
// This will need to be handled in the middleware or a custom server