'use client';

import React, { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

// Dynamically import xterm modules to prevent SSR issues
const loadXTermModules = async () => {
  if (typeof window === 'undefined') return null;

  const [
    { Terminal: XTerm },
    { FitAddon },
    { WebLinksAddon },
    { SearchAddon }
  ] = await Promise.all([
    import('@xterm/xterm'),
    import('@xterm/addon-fit'),
    import('@xterm/addon-web-links'),
    import('@xterm/addon-search')
  ]);

  // Import CSS
  await import('@xterm/xterm/css/xterm.css');

  return { XTerm, FitAddon, WebLinksAddon, SearchAddon };
};

interface TerminalProps {
  sessionId: string;
  isActive: boolean;
  globalSocket: Socket | null;
  allSessions: string[];
}

const Terminal: React.FC<TerminalProps> = ({ sessionId, isActive, globalSocket, allSessions }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<any>(null);
  const fitAddonRef = useRef<any>(null);
  const terminalReadyRef = useRef<boolean>(false);
  const [terminalReady, setTerminalReady] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Combined terminal filtering - both massive empty terminals AND consecutive empty rows
  const killMassiveEmptyTerminals = () => {
    if (!terminalRef.current) return;

    // PART 1: Original logic - Find all terminal-related divs and hide massive empty ones
    const terminalDivs = terminalRef.current.querySelectorAll('div[class*="terminal"], div[class*="xterm"]');
    let killedTerminalCount = 0;
    let preservedTerminalCount = 0;

    terminalDivs.forEach((div, index) => {
      if (div instanceof HTMLElement) {
        // Remove all style blocks first
        const clone = div.cloneNode(true) as HTMLElement;
        const styleBlocks = clone.querySelectorAll('style');
        styleBlocks.forEach(style => style.remove());
        
        // Get the actual content after removing styles
        const actualContent = clone.textContent || '';
        
        // Count non-whitespace characters
        const meaningfulChars = actualContent.replace(/\s/g, '').length;
        
        // Breakpoint target for Owner-2 debugging
        if (div.className.includes('owner-2')) {
          console.log('Found owner-2 terminal div', { meaningfulChars, actualContent: actualContent.substring(0, 100) });
        }
        
        // Simple rule: if it has more than just a cursor/empty space, keep it
        if (meaningfulChars > 1) {
          div.style.display = 'block';
          preservedTerminalCount++;
        } else {
          div.style.display = 'none';
          killedTerminalCount++;
        }
      }
    });

    // PART 2: New logic - Find all divs within .xterm-rows and apply 3-consecutive-empty rule
    const xtermRowsContainer = terminalRef.current.querySelector('.xterm-rows');
    let killedRowCount = 0;
    let preservedRowCount = 0;
    
    if (xtermRowsContainer) {
      const rowDivs = Array.from(xtermRowsContainer.children) as HTMLElement[];
      let consecutiveEmptyCount = 0;

      rowDivs.forEach((div, index) => {
        // Check if this div is empty (no meaningful content)
        const content = div.textContent || '';
        const meaningfulChars = content.replace(/\s/g, '').length;
        const isEmpty = meaningfulChars <= 1; // 0-1 chars = empty (allows for cursor)

        if (isEmpty) {
          consecutiveEmptyCount++;
          
          // If we've had 3+ consecutive empty divs, start hiding the rest
          if (consecutiveEmptyCount > 3) {
            div.style.display = 'none';
            killedRowCount++;
          } else {
            // Keep the first 3 empty divs (breathing room)
            div.style.display = '';
            preservedRowCount++;
          }
        } else {
          // Reset counter when we hit content
          consecutiveEmptyCount = 0;
          div.style.display = '';
          preservedRowCount++;
        }
      });
    }

    console.log(`🎯 Combined filtering: Hid ${killedTerminalCount} empty terminal divs, ${killedRowCount} excessive empty rows. Kept ${preservedTerminalCount} terminal divs, ${preservedRowCount} rows.`);
  };

  useEffect(() => {
    if (!terminalRef.current || !sessionId || typeof window === 'undefined' || !globalSocket) return;

    // Prevent duplicate initialization - this is the key fix
    if (isInitialized) {
      console.log('⚠️ Terminal UI already initialized for session:', sessionId, '- KEEPING EXISTING TERMINAL');
      return;
    }

    const initializeTerminalUI = async () => {
      // 🐛 DEBUG: Track first session vs others
      const isFirstSession = allSessions.indexOf(sessionId) === 0;
      console.log(`🐛 INIT DEBUG - Session: ${sessionId}, isActive: ${isActive}, isFirstSession: ${isFirstSession}, allSessions: [${allSessions.join(', ')}]`);
      
      // Stagger initialization - active session loads immediately, others wait
      if (!isActive) {
        const sessionIndex = allSessions.indexOf(sessionId);
        const delay = (sessionIndex + 1) * 1000; // 1 second per session
        console.log(`⏳ Delaying initialization for session ${sessionId} by ${delay}ms (index: ${sessionIndex})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
      
      console.log(`🖥️ Initializing terminal UI for session: ${sessionId} ${isFirstSession ? '(FIRST SESSION)' : '(SUBSEQUENT)'}`);
      
      // 🐛 DEBUG: Log socket and global state
      console.log(`🐛 SOCKET STATE - Connected: ${globalSocket?.connected}, Socket ID: ${globalSocket?.id}`);
      console.log(`🐛 TIMING - Starting terminal initialization at:`, new Date().toISOString());

      try {
        // Load xterm modules dynamically
        const modules = await loadXTermModules();
        if (!modules) return;

        const { XTerm, FitAddon, WebLinksAddon, SearchAddon } = modules;

        // Create xterm instance with proper scrolling configuration
        const xterm = new XTerm({
          cursorBlink: true,
          fontSize: 14,
          fontFamily: 'Monaco, Menlo, "Ubuntu Mono", "DejaVu Sans Mono", "Courier New", monospace',
          theme: {
            background: '#000000',
            foreground: '#ffffff',
            cursor: '#ffffff',
            selection: '#ffffff30',
          },
          scrollback: 10000, // Large scrollback buffer for conversation history
          allowProposedApi: true,
          convertEol: true,
          disableStdin: false,
          scrollSensitivity: 3, // Enable smooth scrolling
          fastScrollSensitivity: 10,
          mouseWheelScrollSensitivity: 1, // Enable mouse wheel scrolling
          // Let FitAddon determine dimensions dynamically
        });

        // Add addons
        const fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();
        const searchAddon = new SearchAddon();

        xterm.loadAddon(fitAddon);
        xterm.loadAddon(webLinksAddon);
        xterm.loadAddon(searchAddon);

        fitAddonRef.current = fitAddon;

        // Open terminal in DOM
        xterm.open(terminalRef.current);

        // Initial fit when terminal is opened - multiple attempts for stability
        const initialFitDelays = [50, 150, 300];
        initialFitDelays.forEach((delay) => {
          setTimeout(() => {
            if (isActive && fitAddon && terminalRef.current) {
              const containerRect = terminalRef.current.getBoundingClientRect();
              console.log(`🎯 Initial fit attempt at ${delay}ms for session:`, sessionId);
              console.log(`📐 Container dimensions: ${containerRect.width}x${containerRect.height}`);
              
              // Force refresh before fitting
              xterm.refresh(0, xterm.rows - 1);
              fitAddon.fit();
              
              const dims = fitAddon.proposeDimensions();
              if (dims) {
                console.log(`📏 Proposed dimensions: ${dims.cols}x${dims.rows}`);
              }
              
              // Scroll to bottom to show current prompt
              xterm.scrollToBottom();
              
              // Kill massive empty terminals after fitting
              killMassiveEmptyTerminals();
            }
          }, delay);
        });

        // Focus terminal after a short delay
        setTimeout(() => {
          if (isActive) {
            xterm.focus();
            xterm.scrollToBottom(); // Ensure we're at the bottom
          }
        }, 200);


        xtermRef.current = xterm;

        // Define event handlers for this specific session
        const handleTerminalReady = (readySessionId: string) => {
          if (readySessionId === sessionId) {
            const isFirstSession = allSessions.indexOf(sessionId) === 0;
            console.log(`✅ Terminal ready for session: ${sessionId} ${isFirstSession ? '(FIRST SESSION)' : '(SUBSEQUENT)'} at:`, new Date().toISOString());
            terminalReadyRef.current = true;
            setTerminalReady(true);
            xterm.writeln('🎯 Holler Terminal Ready - Claude CLI loaded');
            xterm.writeln('');

            // Immediately request terminal buffer to show any existing content
            setTimeout(() => {
              if (globalSocket?.connected) {
                console.log('🎯 Terminal ready - requesting immediate buffer display for:', sessionId);
                globalSocket.emit('terminal:get-buffer', sessionId);
              }
              if (isActive) xterm.focus();
            }, 200);
          }
        };

        const handleTerminalOutput = (outputSessionId: string, data: string) => {
          if (outputSessionId === sessionId && xtermRef.current) {
            // console.log('📺 Received terminal output for session:', sessionId, 'Data length:', data.length, 'Preview:', data.substring(0, 50));

            // // 🐛 COMPREHENSIVE DEBUG LOGGING - Let's see exactly what's being sent!
            // console.log('🔍 RAW DATA ANALYSIS:');
            // console.log('   • Full data (JSON):', JSON.stringify(data));
            // console.log('   • Character codes:', Array.from(data.substring(0, 100)).map(c => `${c}(${c.charCodeAt(0)})`).join(''));
            // console.log('   • Line count:', data.split('\n').length);
            // console.log('   • Empty line count:', data.split('\n').filter(line => line.trim() === '').length);

            // Split into lines and analyze each one
            const lines = data.split('\n');
            lines.slice(0, 10).forEach((line, i) => {
              // console.log(`   • Line ${i}: "${line}" (${line.length} chars)`);
            });

            if (lines.length > 10) {
              // console.log(`   • ... and ${lines.length - 10} more lines`);
            }

            xtermRef.current.write(data);
          }
        };

        const handleTerminalError = (errorSessionId: string, error: string) => {
          if (errorSessionId === sessionId) {
            console.error('❌ Terminal error:', error);
            xterm.writeln(`\\r\\n❌ Terminal Error: ${error}\\r\\n`);
          }
        };

        const handleTerminalExit = (exitSessionId: string, exitCode: number) => {
          if (exitSessionId === sessionId) {
            console.log(`💀 Terminal exited with code: ${exitCode}`);
            xterm.writeln(`\\r\\n💀 Terminal exited with code: ${exitCode}\\r\\n`);
            terminalReadyRef.current = false;
            setTerminalReady(false);
          }
        };

        const handleTerminalInput = (data: string) => {
          console.log('🎹 Terminal input for session:', sessionId, 'Data:', data.substring(0, 20));
          if (terminalReadyRef.current && globalSocket.connected) {
            globalSocket.emit('terminal:input', sessionId, data);
          }
        };

        // Add event listeners to global socket
        globalSocket.on('terminal:ready', handleTerminalReady);
        globalSocket.on('terminal:output', handleTerminalOutput);
        globalSocket.on('terminal:error', handleTerminalError);
        globalSocket.on('terminal:exit', handleTerminalExit);

        // Connect to existing terminal immediately (they should already be running)
        globalSocket.emit('terminal:create', sessionId);

        // Request any existing terminal buffer/history with delay to ensure connection
        setTimeout(() => {
          globalSocket.emit('terminal:get-buffer', sessionId);
        }, 200);

        // Handle terminal input
        xterm.onData(handleTerminalInput);

        // Ensure mouse wheel scrolling works by adding DOM event listener
        const handleMouseWheel = (event: WheelEvent) => {
          event.preventDefault();
          
          // Scroll the terminal buffer directly
          const delta = event.deltaY > 0 ? 3 : -3; // Scroll 3 lines at a time
          if (delta > 0) {
            xterm.scrollLines(delta);
          } else {
            xterm.scrollLines(delta);
          }
        };

        // Add wheel event listener to terminal container
        if (terminalRef.current) {
          terminalRef.current.addEventListener('wheel', handleMouseWheel, { passive: false });
        }

        // Handle terminal resize
        const handleResize = () => {
          if (fitAddonRef.current) {
            fitAddonRef.current.fit();

            if (globalSocket.connected && terminalReady) {
              const dims = fitAddonRef.current.proposeDimensions();
              if (dims) {
                globalSocket.emit('terminal:resize', sessionId, dims.cols, dims.rows);
              }
            }
          }
        };

        // Add resize listener
        window.addEventListener('resize', handleResize);

        // Resize when component becomes active
        if (isActive) {
          setTimeout(handleResize, 100);
        }

        setIsInitialized(true);

        // Return cleanup function - NEVER dispose xterm or reset state for session persistence
        return () => {
          console.log('🔄 Session switching - PRESERVING terminal state for session:', sessionId);

          window.removeEventListener('resize', handleResize);
          
          // Remove wheel event listener
          if (terminalRef.current) {
            terminalRef.current.removeEventListener('wheel', handleMouseWheel);
          }

          // Remove event listeners from global socket but keep everything else intact
          if (globalSocket) {
            globalSocket.off('terminal:ready', handleTerminalReady);
            globalSocket.off('terminal:output', handleTerminalOutput);
            globalSocket.off('terminal:error', handleTerminalError);
            globalSocket.off('terminal:exit', handleTerminalExit);
          }

          // DO NOT dispose xterm - this was the bug!
          // DO NOT reset refs or state - this preserves history and scroll buffer
          // console.log('✅ Terminal state preserved for session:', sessionId);
        };

      } catch (error) {
        console.error('❌ Failed to initialize terminal UI:', error);
      }
    };

    // Call the async initialization ONLY ONCE per session
    const cleanupPromise = initializeTerminalUI();

    // Return cleanup function that preserves state
    return () => {
      if (cleanupPromise) {
        cleanupPromise.then(cleanup => {
          if (cleanup) cleanup();
        });
      }
    };
  }, [sessionId, globalSocket]); // Removed isActive to prevent re-initialization on session switch

  // Fit terminal when becoming active and request buffer refresh
  useEffect(() => {
    if (isActive && fitAddonRef.current && xtermRef.current) {
      // Request buffer refresh immediately when becoming active
      if (globalSocket?.connected) {
        console.log('📜 Requesting buffer refresh for newly active session:', sessionId);
        globalSocket.emit('terminal:get-buffer', sessionId);
        
        // Force terminal to redraw any existing content immediately
        setTimeout(() => {
          if (xtermRef.current) {
            xtermRef.current.refresh(0, xtermRef.current.rows - 1);
            console.log('🔄 Forced terminal content refresh for session:', sessionId);
          }
        }, 50);

        // Add a one-time listener to capture the buffer response
        const handleBufferResponse = (bufferSessionId: string, bufferData: string) => {
          if (bufferSessionId === sessionId) {
            console.log('🐛 BUFFER DATA RECEIVED:');
            console.log('   • Buffer length:', bufferData.length);
            console.log('   • Buffer preview:', bufferData.substring(0, 200));
            console.log('   • Buffer line count:', bufferData.split('\n').length);
            console.log('   • Buffer empty lines:', bufferData.split('\n').filter(line => line.trim() === '').length);
            // Remove this one-time listener
            globalSocket.off('terminal:output', handleBufferResponse);
          }
        };
        globalSocket.on('terminal:output', handleBufferResponse);
      }

      // Multiple resize attempts to handle xterm.js dimension calculation issues
      const resizeAttempts = [50, 150, 300]; // Different delays for robust fitting

      resizeAttempts.forEach((delay) => {
        setTimeout(() => {
          if (fitAddonRef.current && xtermRef.current && isActive && terminalRef.current) {
            const containerRect = terminalRef.current.getBoundingClientRect();
            console.log(`🎯 Fitting terminal for active session (attempt ${delay}ms):`, sessionId);
            console.log(`📐 Session switch container dimensions: ${containerRect.width}x${containerRect.height}`);

            // Force refresh terminal display 
            xtermRef.current.refresh(0, xtermRef.current.rows - 1);

            // Fit to container size
            fitAddonRef.current.fit();

            // Scroll to bottom to show current prompt
            xtermRef.current.scrollToBottom();

            // Kill massive empty terminals when becoming active
            killMassiveEmptyTerminals();

            // Focus terminal
            xtermRef.current.focus();

            // Send resize to backend
            if (globalSocket?.connected) {
              const dims = fitAddonRef.current.proposeDimensions();
              if (dims && dims.cols && dims.rows) {
                console.log(`📏 Session switch proposed dimensions: ${dims.cols}x${dims.rows}`);
                console.log(`📏 Sending resize ${dims.cols}x${dims.rows} to backend`);
                globalSocket.emit('terminal:resize', sessionId, dims.cols, dims.rows);
              }
            }
          }
        }, delay);
      });
    }
  }, [isActive, globalSocket, sessionId]);

  return (
    <div className="flex-1 flex flex-col bg-black">
      {/* Terminal Status Bar */}
      <div className="bg-gray-800 px-4 py-2 text-sm flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <span className="text-white font-mono">Terminal: {sessionId.substring(0, 8)}</span>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${globalSocket?.connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className={`text-xs ${globalSocket?.connected ? 'text-green-400' : 'text-red-400'}`}>
              {globalSocket?.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${terminalReady ? 'bg-blue-500' : 'bg-gray-500'}`} />
            <span className={`text-xs ${terminalReady ? 'text-blue-400' : 'text-gray-400'}`}>
              {terminalReady ? 'Ready' : 'Starting...'}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-400 font-mono">
            Claude CLI via Holler Terminal (Background Process)
          </div>
          {/* Test button to send programmatic message */}
          <button
            onClick={() => {
              if (xtermRef.current && terminalReady && globalSocket?.connected) {
                const testMessage = "Hello from programmatic input! This is a test message.";
                console.log('🧪 Sending test message programmatically:', testMessage);

                // Try method 1: Send input directly through xterm
                xtermRef.current.write('\r\n'); // New line
                xtermRef.current.write(testMessage);
                xtermRef.current.write('\r'); // Enter key

                // Try method 2: Send through socket as terminal input
                globalSocket.emit('terminal:input', sessionId, testMessage + '\r');
              } else {
                console.log('⚠️ Cannot send test message - terminal not ready or socket disconnected');
              }
            }}
            className="px-2 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded"
            disabled={!terminalReady || !globalSocket?.connected}
          >
            🧪 Test Send
          </button>
        </div>
      </div>

      {/* Terminal Container */}
      <div
        ref={terminalRef}
        className="flex-1 p-2 focus:outline-none terminal-container"
        tabIndex={0}
        style={{
          height: isActive ? 'calc(100vh - 120px)' : '600px', // Fixed height for inactive sessions
          minHeight: '600px', // Ensure minimum height always
          width: '100%',
          overflow: 'hidden', // Let xterm handle scrolling internally
          display: isActive ? 'block' : 'none',
          position: 'relative'
        }}
        onClick={() => {
          console.log('🖱️ Terminal container clicked, focusing xterm');
          xtermRef.current?.focus();
        }}
      />

    </div>
  );
};

export default Terminal;