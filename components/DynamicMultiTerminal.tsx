'use client';

/*---------------------------------------------------------------------------------------------
 * DYNAMIC MULTI TERMINAL - Create multiple terminals dynamically with persistence testing
 *--------------------------------------------------------------------------------------------*/

import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import '@xterm/xterm/css/xterm.css';

interface TerminalSession {
  id: string;
  name: string;
  containerRef: React.RefObject<HTMLDivElement>;
  xterm: any;
  fitAddon: any;
  isRestored: boolean; // Track if this session was restored or newly created
}

const DynamicMultiTerminal: React.FC = () => {
  const [terminals, setTerminals] = useState<TerminalSession[]>([]);
  const [activeTab, setActiveTab] = useState<string>('');
  const [status, setStatus] = useState('Initializing...');
  const [socket, setSocket] = useState<any>(null);
  const nextTerminalNumber = useRef(1);

  // Initialize socket connection
  useEffect(() => {
    let isActive = true;
    let socketConnection: any = null;

    const initConnection = async () => {
      try {
        setStatus('Connecting to server...');
        
        socketConnection = io('http://localhost:3002');
        setSocket(socketConnection);

        socketConnection.on('connect', () => {
          setStatus('✅ Connected - Discovering existing terminals...');
          
          // Request list of existing terminals
          socketConnection.emit('terminal:list');
        });

        socketConnection.on('disconnect', () => {
          setStatus('❌ Disconnected');
        });

        socketConnection.on('connect_error', (error: any) => {
          setStatus(`❌ Connection error: ${error}`);
        });

        // Handle terminal output for any session
        socketConnection.on('terminal:output', (sessionId: string, data: string) => {
          setTerminals(prev => {
            const updated = [...prev];
            const terminal = updated.find(t => t.id === sessionId);
            if (terminal?.xterm) {
              console.log(`📤 [${sessionId}] Received output:`, data.length, 'chars');
              terminal.xterm.write(data);
            }
            return updated;
          });
        });

        // Handle terminal list response
        socketConnection.on('terminal:list', async (existingTerminals: string[]) => {
          console.log('📋 Existing terminals found:', existingTerminals);
          
          if (existingTerminals.length > 0) {
            setStatus('🔄 Restoring existing terminals...');
            await restoreExistingTerminals(existingTerminals, socketConnection);
          } else {
            setStatus('✅ Connected - Ready to create terminals');
          }
        });

        // Handle terminal ready events
        socketConnection.on('terminal:ready', (sessionId: string) => {
          setTerminals(prev => {
            const updated = [...prev];
            const terminal = updated.find(t => t.id === sessionId);
            if (terminal?.xterm) {
              const isRestored = terminal.isRestored;
              const message = isRestored 
                ? '🔄 SESSION RESTORED SUCCESSFULLY\r\n'
                : '🆕 STARTED NEW TERMINAL SESSION\r\n';
              
              console.log(`✅ [${sessionId}] Terminal ready, restored: ${isRestored}`);
              terminal.xterm.write(message);
              terminal.xterm.focus();
            }
            return updated;
          });
        });

      } catch (error) {
        setStatus(`❌ Error: ${error}`);
      }
    };

    initConnection();

    return () => {
      isActive = false;
      if (socketConnection) {
        socketConnection.disconnect();
      }
    };
  }, []);

  const restoreExistingTerminals = async (terminalIds: string[], socketConnection: any) => {
    if (!socketConnection) return;

    try {
      console.log('🔄 Restoring terminals:', terminalIds);
      
      // Load XTerm
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import('@xterm/xterm'),
        import('@xterm/addon-fit')
      ]);

      const restoredTerminals: TerminalSession[] = [];

      for (let i = 0; i < terminalIds.length; i++) {
        const terminalId = terminalIds[i];
        const terminalName = `Term-${i + 1} (Restored)`;

        // Create container ref
        const containerRef = React.createRef<HTMLDivElement>();

        // Create XTerm instance
        const xterm = new Terminal({
          cols: 80,
          rows: 24,
          fontSize: 13,
          fontFamily: 'Consolas,Liberation Mono,Menlo,Courier,monospace',
          allowProposedApi: true,
          theme: {
            foreground: '#d2d2d2',
            background: '#2b2b2b',
            cursor: '#adadad'
          }
        });

        const fitAddon = new FitAddon();
        xterm.loadAddon(fitAddon);

        // Setup input handling
        xterm.onData((data: string) => {
          console.log(`📝 [${terminalId}] Sending input:`, data.charCodeAt(0));
          socketConnection.emit('terminal:input', terminalId, data);
        });

        // Create terminal session
        const restoredTerminal: TerminalSession = {
          id: terminalId,
          name: terminalName,
          containerRef,
          xterm,
          fitAddon,
          isRestored: true // This is a restored session
        };

        restoredTerminals.push(restoredTerminal);
      }

      setTerminals(restoredTerminals);
      
      // Set first terminal as active
      if (restoredTerminals.length > 0) {
        setActiveTab(restoredTerminals[0].id);
      }

      // Update the counter
      nextTerminalNumber.current = restoredTerminals.length + 1;

      // Now attach them to DOM and reconnect
      setTimeout(() => {
        restoredTerminals.forEach(terminal => {
          if (terminal.containerRef.current) {
            terminal.xterm.open(terminal.containerRef.current);
            terminal.fitAddon.fit();
            
            // Request reconnection from server
            console.log(`🔌 Reconnecting to server terminal: ${terminal.id}`);
            socketConnection.emit('terminal:create', terminal.id);
          }
        });
      }, 100);

      setStatus('✅ Connected - Ready to create terminals');

    } catch (error) {
      console.error('❌ Error restoring terminals:', error);
      setStatus(`❌ Error restoring terminals: ${error}`);
    }
  };

  const createNewTerminal = async () => {
    if (!socket) return;

    const terminalId = `terminal-${Date.now()}`;
    const terminalName = `Term-${nextTerminalNumber.current}`;
    nextTerminalNumber.current++;

    try {
      setStatus('Creating new terminal...');
      
      // Load XTerm
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import('@xterm/xterm'),
        import('@xterm/addon-fit')
      ]);

      // Create container ref
      const containerRef = React.createRef<HTMLDivElement>();

      // Create XTerm instance
      const xterm = new Terminal({
        cols: 80,
        rows: 24,
        fontSize: 13,
        fontFamily: 'Consolas,Liberation Mono,Menlo,Courier,monospace',
        allowProposedApi: true,
        theme: {
          foreground: '#d2d2d2',
          background: '#2b2b2b',
          cursor: '#adadad'
        }
      });

      const fitAddon = new FitAddon();
      xterm.loadAddon(fitAddon);

      // Setup input handling
      xterm.onData((data: string) => {
        console.log(`📝 [${terminalId}] Sending input:`, data.charCodeAt(0));
        socket.emit('terminal:input', terminalId, data);
      });

      // Create terminal session
      const newTerminal: TerminalSession = {
        id: terminalId,
        name: terminalName,
        containerRef,
        xterm,
        fitAddon,
        isRestored: false // This is a new session
      };

      setTerminals(prev => [...prev, newTerminal]);
      setActiveTab(terminalId);

      // Let React render the container first
      setTimeout(() => {
        if (containerRef.current) {
          xterm.open(containerRef.current);
          fitAddon.fit();
          
          // Request terminal creation from server
          console.log(`🚀 Creating server terminal: ${terminalId}`);
          socket.emit('terminal:create', terminalId);
        }
      }, 100);

      setStatus('✅ Connected - Ready to create terminals');

    } catch (error) {
      setStatus(`❌ Error creating terminal: ${error}`);
    }
  };

  const switchToTab = (terminalId: string) => {
    setActiveTab(terminalId);
    
    // Hide all terminals
    terminals.forEach(terminal => {
      if (terminal.containerRef.current) {
        terminal.containerRef.current.style.display = 'none';
      }
    });

    // Show active terminal
    const activeTerminal = terminals.find(t => t.id === terminalId);
    if (activeTerminal?.containerRef.current) {
      activeTerminal.containerRef.current.style.display = 'block';
      activeTerminal.fitAddon.fit();
      activeTerminal.xterm.focus();
    }
  };

  const closeTerminal = (terminalId: string) => {
    const terminal = terminals.find(t => t.id === terminalId);
    if (terminal) {
      terminal.xterm.dispose();
      socket?.emit('terminal:destroy', terminalId);
      
      setTerminals(prev => prev.filter(t => t.id !== terminalId));
      
      // Switch to another terminal if this was active
      if (activeTab === terminalId) {
        const remaining = terminals.filter(t => t.id !== terminalId);
        if (remaining.length > 0) {
          setActiveTab(remaining[0].id);
          switchToTab(remaining[0].id);
        } else {
          setActiveTab('');
        }
      }
    }
  };

  return (
    <div className="dynamic-multi-terminal h-full flex flex-col">
      {/* Header with controls */}
      <div className="bg-gray-800 px-4 py-2 text-white text-sm border-b border-gray-600">
        <div className="flex items-center justify-between mb-2">
          <span>Status: {status}</span>
          <div className="flex space-x-2">
            <button
              onClick={createNewTerminal}
              className="bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-xs font-medium"
              disabled={!socket}
            >
              + New Terminal
            </button>
            <span className="text-xs text-gray-400">
              Total: {terminals.length} terminals
            </span>
          </div>
        </div>
        
        {/* Terminal Tabs */}
        {terminals.length > 0 && (
          <div className="flex space-x-1 flex-wrap">
            {terminals.map(terminal => (
              <div
                key={terminal.id}
                className={`flex items-center px-3 py-1 rounded text-xs cursor-pointer ${
                  activeTab === terminal.id
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
                }`}
                onClick={() => switchToTab(terminal.id)}
              >
                <span>{terminal.name}</span>
                <span className="ml-1 text-xs opacity-75">
                  {terminal.isRestored ? '🔄' : '🆕'}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTerminal(terminal.id);
                  }}
                  className="ml-2 text-red-400 hover:text-red-300"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Terminal Area */}
      <div className="flex-1 relative">
        {terminals.length === 0 && (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-4">🖥️</div>
              <p className="mb-2">No terminals created yet</p>
              <p className="text-sm">Click "New Terminal" to create your first terminal session</p>
            </div>
          </div>
        )}
        
        {terminals.map(terminal => (
          <div
            key={terminal.id}
            ref={terminal.containerRef}
            className="absolute inset-0"
            style={{
              width: '100%',
              height: '100%',
              display: activeTab === terminal.id ? 'block' : 'none'
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default DynamicMultiTerminal;