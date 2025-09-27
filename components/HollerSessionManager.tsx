'use client';

/*---------------------------------------------------------------------------------------------
 * HOLLER SESSION MANAGER - Clean session management with sidebar
 *--------------------------------------------------------------------------------------------*/

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, MessageCircle, Edit3, Trash2, Check, Copy } from 'lucide-react';
import { io } from 'socket.io-client';
import '@xterm/xterm/css/xterm.css';
import SessionManagementModal from './SessionManagementModal';
import FloatingWorkbench from './FloatingWorkbench';

interface HollerSession {
  id: string;
  name: string;
  created: string;
  terminalId: string;
  claudeSessionId?: string | null;
  status?: 'loading' | 'connected' | 'ready' | 'disconnected';
  projectPath?: string;
  jarvisMode?: boolean;
}

interface TerminalInstance {
  id: string;
  xterm: any;
  fitAddon: any;
  containerRef: React.RefObject<HTMLDivElement>;
}

const HollerSessionManager: React.FC = () => {
  const [sessions, setSessions] = useState<HollerSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [terminals, setTerminals] = useState<Map<string, TerminalInstance>>(new Map());
  const [socket, setSocket] = useState<any>(null);
  const [showBrowsePromoteModal, setShowBrowsePromoteModal] = useState(false);
  const [showCreateNewInput, setShowCreateNewInput] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');
  const [newSessionProjectPath, setNewSessionProjectPath] = useState('/Users/joshuamullet/code/holler');
  const [availableDirectories, setAvailableDirectories] = useState<string[]>([]);

  // Right panel state
  const [activeRightTab, setActiveRightTab] = useState<'planning' | 'files' | 'tools'>('planning');
  const [sessionMdContent, setSessionMdContent] = useState<string>('');
  const [todoMdContent, setTodoMdContent] = useState<string>('');
  const [planningDocsLoading, setPlanningDocsLoading] = useState(false);
  const [sessionMdSaving, setSessionMdSaving] = useState(false);
  const [todoMdSaving, setTodoMdSaving] = useState(false);

  // Session management UI state
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingSessionName, setEditingSessionName] = useState('');
  const [deletingSessionIds, setDeletingSessionIds] = useState<Set<string>>(new Set());
  const [deletionError, setDeletionError] = useState<string | null>(null);

  // Recently deleted sessions for true undo
  const [recentlyDeleted, setRecentlyDeleted] = useState<{ session: HollerSession, timestamp: number } | null>(null);

  // Hotkey handling for session switching and actions
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger hotkeys when typing in inputs
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Check for Option+1 through Option+9 for session switching
      if (event.altKey && event.key >= '1' && event.key <= '9') {
        event.preventDefault();
        event.stopPropagation();

        const sessionIndex = parseInt(event.key) - 1; // Convert to 0-based index

        if (sessions.length > sessionIndex) {
          const targetSession = sessions[sessionIndex];
          console.log(`🔥 Hotkey: Switching to session ${event.key}: ${targetSession.name}`);
          switchToSession(targetSession.id);
        } else {
          console.log(`⚠️ Hotkey: No session at index ${event.key}`);
        }
        return;
      }

      // Option+B for Browse & Promote
      if (event.altKey && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        event.stopPropagation();
        console.log(`🔥 Hotkey: Opening Browse & Promote`);
        setShowBrowsePromoteModal(true);
        return;
      }

      // Option+N for Create New
      if (event.altKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        event.stopPropagation();
        console.log(`🔥 Hotkey: Opening Create New`);
        setShowCreateNewInput(true);
        setNewSessionName('');
        return;
      }

      // Escape to close modals/inputs
      if (event.key === 'Escape') {
        setShowBrowsePromoteModal(false);
        setShowCreateNewInput(false);
        setNewSessionName('');
        return;
      }
    };

    // Add global keydown listener
    window.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [sessions]); // Re-run when sessions change

  // Load planning docs when active session changes
  useEffect(() => {
    if (activeSessionId && sessions.length > 0) {
      const activeSession = sessions.find(s => s.id === activeSessionId);
      if (activeSession) {
        const projectPath = activeSession.projectPath || '/Users/joshuamullet/code/holler';
        loadPlanningDocs(projectPath);
      }
    }
  }, [activeSessionId, sessions]);

  // Initialize socket connection
  const loadAvailableDirectories = async () => {
    try {
      const response = await fetch('/api/directories');
      const data = await response.json();
      if (data.success) {
        setAvailableDirectories(data.directories);
      }
    } catch (error) {
      console.error('Failed to load directories:', error);
    }
  };

  useEffect(() => {
    let isActive = true;
    let socketConnection: any = null;

    const initConnection = async () => {
      try {
        loadAvailableDirectories();
        socketConnection = io('http://localhost:3002');
        setSocket(socketConnection);

        socketConnection.on('connect', () => {
          // Request list of existing sessions
          socketConnection.emit('session:list');
        });

        socketConnection.on('disconnect', () => {
          // Connection lost
        });

        socketConnection.on('connect_error', (error: any) => {
          console.error('Connection error:', error);
        });

        // Handle session list response
        socketConnection.on('session:list', async (sessionsData: { sessions: HollerSession[], activeSessionId: string }) => {
          console.log('📋 SESSION LOAD: Sessions loaded from backend:', sessionsData);
          console.log(`🔍 SESSION LOAD DEBUG: ${sessionsData.sessions.length} sessions received`);
          console.log(`🔍 SESSION LOAD DEBUG: Active session ID: ${sessionsData.activeSessionId}`);

          // Log each session for debugging
          sessionsData.sessions.forEach((session, index) => {
            console.log(`📄 SESSION ${index + 1}:`, {
              id: session.id,
              name: session.name,
              terminalId: session.terminalId,
              claudeSessionId: session.claudeSessionId
            });
          });

          // Set initial status for sessions based on Claude session linkage
          const sessionsWithStatus = sessionsData.sessions.map(session => ({
            ...session,
            status: session.claudeSessionId ? 'ready' : undefined // Green if linked, gray if not
          }));
          
          setSessions(sessionsWithStatus);

          if (sessionsWithStatus.length > 0) {
            const activeId = sessionsData.activeSessionId || sessionsWithStatus[0].id;
            console.log(`✅ SESSION LOAD: Setting active session to: ${activeId}`);
            setActiveSessionId(activeId);
            await restoreSessionTerminals(sessionsWithStatus, socketConnection);
          } else {
            console.log(`🚫 SESSION LOAD: No sessions to restore`);
          }
        });

        // Handle new session creation
        socketConnection.on('session:created', async (session: HollerSession) => {
          console.log('🚀 New session created:', session);

          // Add to end and prevent duplicates (matches reload order)
          setSessions(prev => {
            const exists = prev.find(s => s.id === session.id);
            if (exists) {
              console.log('⚠️ Session already exists, skipping duplicate:', session.id);
              return prev;
            }
            return [...prev, session];
          });
          setActiveSessionId(session.id);

          // Create terminal for this session
          await createTerminalForSession(session, socketConnection);
        });

        // Handle terminal output for any session
        socketConnection.on('terminal:output', (terminalId: string, data: string) => {
          setTerminals(prev => {
            const terminal = prev.get(terminalId);
            if (terminal?.xterm) {
              // console.log(`📤 [${terminalId}] Received output:`, data.length, 'chars');
              terminal.xterm.write(data);
            }
            return prev;
          });
        });

        // Handle terminal ready events
        socketConnection.on('terminal:ready', (terminalId: string) => {
          console.log(`✅ [${terminalId}] Terminal ready`);
          setTerminals(prev => {
            const terminal = prev.get(terminalId);
            if (terminal?.xterm) {
              terminal.xterm.write('🎯 HOLLER SESSION READY\\r\\n');
              terminal.xterm.focus();
            }
            return prev;
          });
        });

        // 🔄 REAL-TIME SESSION SYNC: Update session data immediately when backend updates linkage
        socketConnection.on('session:updated', (sessionUpdate: {
          sessionId: string,
          claudeSessionId: string,
          timestamp: string
        }) => {
          console.log(`🔄 Real-time Sync: Session ${sessionUpdate.sessionId} → Claude ${sessionUpdate.claudeSessionId}`);
          
          // Update session with new Claude session ID
          setSessions(prev => prev.map(session =>
            session.id === sessionUpdate.sessionId
              ? { ...session, claudeSessionId: sessionUpdate.claudeSessionId }
              : session
          ));
        });

        // Handle session status updates from file monitor events (replaces broken hooks)
        socketConnection.on('session:status-update', (statusUpdate: {
          claudeSessionId: string,
          status: 'loading' | 'ready'
        }) => {
          console.log(`🔄 File Monitor Status: Claude session ${statusUpdate.claudeSessionId} → ${statusUpdate.status}`);

          // Find Holler session with this Claude session ID and update its status
          setSessions(prev => prev.map(session =>
            session.claudeSessionId === statusUpdate.claudeSessionId
              ? { ...session, status: statusUpdate.status }
              : session
          ));
        });

        // Listen for Jarvis mode updates
        socketConnection.on('session:jarvis-updated', (update: {
          sessionId: string,
          jarvisMode: boolean
        }) => {
          console.log(`🔄 Jarvis mode update: ${update.sessionId} → ${update.jarvisMode ? 'ON' : 'OFF'}`);

          setSessions(prev => prev.map(session =>
            session.id === update.sessionId
              ? { ...session, jarvisMode: update.jarvisMode }
              : session
          ));
        });

      } catch (error) {
        console.error('Connection error:', error);
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

  // Auto-hide undo after 10 seconds
  useEffect(() => {
    if (recentlyDeleted) {
      const timer = setTimeout(() => {
        setRecentlyDeleted(null);
      }, 10000); // 10 seconds to undo
      
      return () => clearTimeout(timer);
    }
  }, [recentlyDeleted]);

  const restoreSessionTerminals = async (sessionList: HollerSession[], socketConnection: any) => {
    if (!socketConnection) return;

    try {
      console.log('🔄 Restoring session terminals:', sessionList);

      for (const session of sessionList) {
        await createTerminalForSession(session, socketConnection, true);
      }


    } catch (error) {
      console.error('❌ Error restoring session terminals:', error);
    }
  };

  const createTerminalForSession = async (session: HollerSession, socketConnection: any, isRestored = false) => {
    try {
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
        console.log(`📝 [${session.terminalId}] Sending input:`, data.charCodeAt(0));
        socketConnection.emit('terminal:input', session.terminalId, data);
      });

      // Create terminal instance
      const terminalInstance: TerminalInstance = {
        id: session.terminalId,
        xterm,
        fitAddon,
        containerRef
      };

      setTerminals(prev => {
        const newMap = new Map(prev);
        newMap.set(session.terminalId, terminalInstance);
        return newMap;
      });

      // Let React render the container first
      setTimeout(() => {
        if (containerRef.current) {
          xterm.open(containerRef.current);
          fitAddon.fit();

          // Request terminal creation from server
          console.log(`🔌 ${isRestored ? 'Reconnecting' : 'Creating'} server terminal: ${session.terminalId}`);
          socketConnection.emit('terminal:create', session.terminalId);
        }
      }, 100);

    } catch (error) {
      console.error('❌ Error creating terminal for session:', error);
    }
  };

  const handleSessionCreated = (session: HollerSession) => {
    console.log('🎉 Session created/promoted:', session);

    if (!socket) {
      console.error('❌ No socket connection for session creation');
      return;
    }

    // Set as active session (UI update will come from server response)
    setActiveSessionId(session.id);

    // Emit to server to create terminal and start resume process
    console.log('📡 Emitting promoted session to server for terminal creation');
    socket.emit('session:create', session);
  };

  const handleCreateNewSession = () => {
    if (!newSessionName.trim() || !socket) return;

    console.log('🚀 Creating new session:', newSessionName.trim(), 'at path:', newSessionProjectPath);

    // Create new session with name and project path
    socket.emit('session:create', {
      name: newSessionName.trim(),
      projectPath: newSessionProjectPath
    });

    // Close the input
    setShowCreateNewInput(false);
    setNewSessionName('');
    setNewSessionProjectPath('/Users/joshuamullet/code/holler');
  };

  // Load planning documents for the current project
  const loadPlanningDocs = async (projectPath: string) => {
    setPlanningDocsLoading(true);
    try {
      console.log(`📋 Loading planning docs from: ${projectPath}`);

      // Try to read session.md
      try {
        const sessionResponse = await fetch('/api/files/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: `${projectPath}/session.md` })
        });
        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.text();
          setSessionMdContent(sessionData);
        } else {
          setSessionMdContent('# Session Notes\n\nNo session.md found in this project.');
        }
      } catch (err) {
        setSessionMdContent('# Session Notes\n\nError loading session.md');
      }

      // Try to read todo.md
      try {
        const todoResponse = await fetch('/api/files/read', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: `${projectPath}/todo.md` })
        });
        if (todoResponse.ok) {
          const todoData = await todoResponse.text();
          setTodoMdContent(todoData);
        } else {
          setTodoMdContent('# Todo\n\nNo todo.md found in this project.');
        }
      } catch (err) {
        setTodoMdContent('# Todo\n\nError loading todo.md');
      }

    } catch (error) {
      console.error('❌ Error loading planning docs:', error);
      setSessionMdContent('# Session Notes\n\nError loading documents');
      setTodoMdContent('# Todo\n\nError loading documents');
    } finally {
      setPlanningDocsLoading(false);
    }
  };

  // Auto-save functions with debouncing
  const saveFileContent = async (filePath: string, content: string, setSaving: (saving: boolean) => void) => {
    setSaving(true);
    try {
      const response = await fetch('/api/files/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, content })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('❌ Failed to save file:', errorData.error);
      }
    } catch (error) {
      console.error('❌ Error saving file:', error);
    } finally {
      setSaving(false);
    }
  };

  const debouncedSaveSessionMd = useCallback(
    debounce((content: string, projectPath: string) => {
      if (projectPath) {
        saveFileContent(`${projectPath}/session.md`, content, setSessionMdSaving);
      }
    }, 1000),
    []
  );

  const debouncedSaveTodoMd = useCallback(
    debounce((content: string, projectPath: string) => {
      if (projectPath) {
        saveFileContent(`${projectPath}/todo.md`, content, setTodoMdSaving);
      }
    }, 1000),
    []
  );

  // Debounce utility function
  function debounce(func: Function, wait: number) {
    let timeout: NodeJS.Timeout;
    return function executedFunction(...args: any[]) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  const switchToSession = (sessionId: string) => {
    setActiveSessionId(sessionId);

    // Hide all terminals
    terminals.forEach(terminal => {
      if (terminal.containerRef.current) {
        terminal.containerRef.current.style.display = 'none';
      }
    });

    // Show active session's terminal
    const activeSession = sessions.find(s => s.id === sessionId);
    if (activeSession) {
      const terminal = terminals.get(activeSession.terminalId);
      if (terminal?.containerRef.current) {
        terminal.containerRef.current.style.display = 'block';
        terminal.fitAddon.fit();
        terminal.xterm.focus();
      }
    }
  };

  const handleSendMessage = useCallback((message: string, sessionId: string) => {
    if (!socket || !message.trim()) return;

    console.log(`🎤 Audio: Sending message to session ${sessionId}: "${message}"`);
    
    socket.emit('session:send-message', {
      sessionId: sessionId,
      message: message
    });
  }, [socket]);

  const getSessionStatus = (session: HollerSession) => {
    if (session.claudeSessionId) {
      return '🔗 Claude Connected';
    }
    return '⏳ Waiting for Claude...';
  };

  // Session management actions
  const handleStartEdit = (sessionId: string, currentName: string) => {
    setEditingSessionId(sessionId);
    setEditingSessionName(currentName);
  };

  const handleSaveEdit = async (sessionId: string) => {
    if (!editingSessionName.trim()) return;

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingSessionName.trim() })
      });

      if (response.ok) {
        setSessions(prev => prev.map(s =>
          s.id === sessionId ? { ...s, name: editingSessionName.trim() } : s
        ));
      }
    } catch (error) {
      console.error('Failed to rename session:', error);
    }

    setEditingSessionId(null);
    setEditingSessionName('');
  };

  const handleCancelEdit = () => {
    setEditingSessionId(null);
    setEditingSessionName('');
  };

  const handleCloneSession = async (sessionId: string) => {
    if (!socket) return;

    const originalSession = sessions.find(s => s.id === sessionId);
    if (!originalSession?.claudeSessionId) {
      console.error('❌ Cannot clone session without Claude session ID');
      // TODO: Add user-friendly error message UI
      return;
    }

    try {
      console.log('🔄 Starting true conversation fork for session:', typeof originalSession.name === 'string' ? originalSession.name : originalSession.name?.name || 'Unknown Session');

      // Generate new IDs for the cloned session
      const timestamp = Date.now();
      const newHollerSessionId = `session-${timestamp}`;
      const newClaudeSessionId = generateUUID();
      const newTerminalId = `terminal-${timestamp}`;

      // Clone the conversation history first
      const cloneResult = await fetch('/api/sessions/clone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          originalClaudeSessionId: originalSession.claudeSessionId,
          newClaudeSessionId: newClaudeSessionId
        })
      });

      if (!cloneResult.ok) {
        const errorData = await cloneResult.json();
        throw new Error(errorData.error || 'Failed to clone conversation');
      }

      const cloneData = await cloneResult.json();
      console.log(`✅ Conversation cloned successfully: ${cloneData.messageCount} messages`);

      // Create new Holler session pointing to the cloned conversation
      const cloneSession = {
        id: newHollerSessionId,
        name: `${typeof originalSession.name === 'string' ? originalSession.name : originalSession.name?.name || 'Session'} (Clone)`,
        terminalId: newTerminalId,
        claudeSessionId: newClaudeSessionId,  // Points to independent cloned conversation
        created: new Date().toISOString()
      };

      // Debug the session object before sending
      console.log('🔍 About to emit session object:', JSON.stringify(cloneSession, null, 2));

      // Emit session creation to server
      socket.emit('session:create', cloneSession);
      console.log('✅ Session cloned successfully with independent conversation');

    } catch (error) {
      console.error('❌ Session cloning failed:', error);
      // TODO: Add user-friendly error message UI
    }
  };

  // Helper function to generate UUIDs (same as backend)
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const handleCopyResumeCommand = async (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (!session?.claudeSessionId) {
      console.error('❌ Cannot copy resume command without Claude session ID');
      return;
    }

    try {
      const resumeCommand = `holler --resume ${session.claudeSessionId}`;
      await navigator.clipboard.writeText(resumeCommand);
      console.log(`📋 Copied resume command: ${resumeCommand}`);

      // TODO: Show brief success feedback to user

    } catch (error) {
      console.error('❌ Failed to copy resume command:', error);
      // Fallback: log the command so user can copy manually
      console.log(`📋 Resume command (copy manually): holler --resume ${session.claudeSessionId}`);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    const sessionToDelete = sessions.find(s => s.id === sessionId);
    if (!sessionToDelete) {
      console.warn(`⚠️ DELETION DEBUG: Session ${sessionId} not found in sessions array`);
      return;
    }

    console.log(`🗑️ DELETION LIFECYCLE: Starting immediate UI deletion for session: ${sessionId}`);
    console.log(`🔍 DELETION DEBUG: Session to delete:`, JSON.stringify(sessionToDelete, null, 2));
    console.log(`🔍 DELETION DEBUG: Current sessions count: ${sessions.length}`);

    // Store for undo (true undo system)
    setRecentlyDeleted({
      session: sessionToDelete,
      timestamp: Date.now()
    });

    // Immediately remove from UI
    console.log(`🔄 DELETION DEBUG: Removing session from UI state`);
    setSessions(prev => {
      const newSessions = prev.filter(s => s.id !== sessionId);
      console.log(`📊 DELETION DEBUG: Sessions after removal: ${newSessions.length} (was ${prev.length})`);
      return newSessions;
    });

    // If deleted session was active, switch to first remaining session
    if (activeSessionId === sessionId) {
      const remainingSessions = sessions.filter(s => s.id !== sessionId);
      console.log(`🔄 DELETION DEBUG: Deleted session was active, switching to first remaining session`);
      console.log(`📊 DELETION DEBUG: Remaining sessions count: ${remainingSessions.length}`);

      if (remainingSessions.length > 0) {
        console.log(`➡️ DELETION DEBUG: Switching to session: ${remainingSessions[0].id}`);
        setActiveSessionId(remainingSessions[0].id);
        switchToSession(remainingSessions[0].id);
      } else {
        console.log(`🚫 DELETION DEBUG: No remaining sessions, clearing active session`);
        setActiveSessionId('');
      }
    }

    // Clean up terminal
    console.log(`🧹 DELETION DEBUG: Cleaning up terminal: ${sessionToDelete.terminalId}`);
    setTerminals(prev => {
      const newMap = new Map(prev);
      const hadTerminal = newMap.has(sessionToDelete.terminalId);
      newMap.delete(sessionToDelete.terminalId);
      console.log(`🔍 DELETION DEBUG: Terminal cleanup - had terminal: ${hadTerminal}, terminals after: ${newMap.size}`);
      return newMap;
    });

    // Immediately delete from backend (no delay)
    try {
      console.log(`🚀 IMMEDIATE DELETION: Starting backend deletion for session: ${sessionId}`);

      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE'
      });

      const result = await response.json();
      console.log(`📋 DELETION DEBUG: Backend response:`, JSON.stringify(result, null, 2));

      if (result.success) {
        console.log(`✅ IMMEDIATE DELETION: Backend confirmed deletion: ${sessionId}`);
      } else {
        console.error(`❌ DELETION FAILED: Backend failed to delete session: ${sessionId}`, result.error);
        setDeletionError(result.error || 'Failed to delete session');
        setTimeout(() => setDeletionError(null), 3000);
      }
    } catch (error) {
      console.error(`💥 DELETION ERROR: Failed to delete session: ${sessionId}`, error);
      setDeletionError('Network error deleting session');
      setTimeout(() => setDeletionError(null), 3000);
    }

    console.log(`✅ IMMEDIATE DELETION: Completed for session: ${sessionId}`);
  };

  const handleUndoDelete = async () => {
    if (!recentlyDeleted) {
      console.warn(`⚠️ UNDO DEBUG: No recently deleted session to restore`);
      return;
    }

    const sessionToRestore = recentlyDeleted.session;
    console.log(`↩️ TRUE UNDO: Restoring session: ${sessionToRestore.id}`);

    // Restore session to UI immediately
    setSessions(prev => [...prev, sessionToRestore]);

    // Restore to backend - recreate the session
    try {
      if (socket) {
        console.log(`📡 TRUE UNDO: Sending recreate signal to backend`);
        socket.emit('session:create', sessionToRestore);
        
        // Also restore terminal connection
        setTimeout(() => {
          createTerminalForSession(sessionToRestore, socket, true);
        }, 500);
      }
    } catch (error) {
      console.error(`❌ UNDO ERROR: Failed to restore session:`, error);
      // Remove from UI since restore failed
      setSessions(prev => prev.filter(s => s.id !== sessionToRestore.id));
    }

    // Clear recently deleted
    setRecentlyDeleted(null);
    console.log(`✅ TRUE UNDO: Completed for session: ${sessionToRestore.id}`);
  };

  const isSessionDeleting = (sessionId: string) => {
    return deletingSessionIds.has(sessionId);
  };

  return (
    <div className="holler-session-manager h-full flex" style={{ overflow: 'visible' }}>
      {/* Sidebar */}
      <div className="w-80 bg-black/20 backdrop-blur-md border-r border-white/30 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/30 space-y-3">
          {/* Browse & Promote Button */}
          <motion.button
            onClick={() => setShowBrowsePromoteModal(true)}
            className="w-full flex items-center justify-center space-x-2 bg-blue-500/20 hover:bg-blue-500/30 text-white p-3 rounded-xl transition-all"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={!socket}
          >
            <MessageCircle size={20} />
            <span>Browse & Promote</span>
            <span className="text-xs opacity-75">⌥B</span>
          </motion.button>

          {/* AI Test Button */}
          <motion.button
            onClick={async () => {
              if (!socket || !activeSessionId) return;
              
              console.log('🤖 AI Test: Sending programmatic message to Claude CLI');
              
              try {
                const testMessage = "🤖 This message was sent programmatically via button click - testing AI auto-response integration!";
                
                socket.emit('session:send-message', {
                  sessionId: activeSessionId,
                  message: testMessage
                });
                
                console.log('✅ AI Test: Message injected into Claude CLI session');
              } catch (error) {
                console.error('❌ AI Test: Failed to send message:', error);
              }
            }}
            className="w-full flex items-center justify-center space-x-2 bg-green-500/20 hover:bg-green-500/30 text-white p-3 rounded-xl transition-all"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            disabled={!socket || !activeSessionId}
          >
            <span>🤖</span>
            <span>AI Test Message</span>
            <span className="text-xs opacity-75">TEST</span>
          </motion.button>


          {/* Create New Button or Input */}
          {showCreateNewInput ? (
            <div className="bg-white/10 rounded-xl p-3 space-y-3">
              <input
                type="text"
                value={newSessionName}
                onChange={(e) => setNewSessionName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateNewSession();
                  } else if (e.key === 'Escape') {
                    setShowCreateNewInput(false);
                    setNewSessionName('');
                    setNewSessionProjectPath('/Users/joshuamullet/code/holler');
                  }
                }}
                placeholder="Session name..."
                className="w-full bg-white/20 text-white placeholder-white/50 border border-white/30 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                autoFocus
              />
              
              <div className="space-y-2">
                <input
                  type="text"
                  value={newSessionProjectPath}
                  onChange={(e) => setNewSessionProjectPath(e.target.value)}
                  placeholder="Project directory path..."
                  className="w-full bg-white/20 text-white placeholder-white/50 border border-white/30 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
                <div className="flex flex-wrap gap-1">
                  {availableDirectories.slice(0, 6).map((dir) => (
                    <button
                      key={dir}
                      onClick={() => setNewSessionProjectPath(dir)}
                      className={`px-2 py-1 text-xs rounded transition-colors ${
                        newSessionProjectPath === dir 
                          ? 'bg-orange-500/30 text-orange-200' 
                          : 'bg-white/20 text-white/70 hover:bg-white/30'
                      }`}
                    >
                      {dir.split('/').pop()}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="text-xs text-white/60">Press Enter to create, Esc to cancel</div>
            </div>
          ) : (
            <motion.button
              onClick={() => {
                setShowCreateNewInput(true);
                setNewSessionName('');
                setNewSessionProjectPath('/Users/joshuamullet/code/holler');
              }}
              className="w-full flex items-center justify-center space-x-2 bg-green-500/20 hover:bg-green-500/30 text-white p-3 rounded-xl transition-all"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={!socket}
            >
              <Plus size={20} />
              <span>Create New</span>
              <span className="text-xs opacity-75">⌥N</span>
            </motion.button>
          )}
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-2">
          <AnimatePresence>
            {sessions.map((session, index) => (
              <motion.div
                key={session.id}
                layout
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="mb-2"
              >
                <div className="relative group">
                  <motion.div
                    onClick={() => switchToSession(session.id)}
                    className={`w-full text-left p-3 rounded-xl transition-all cursor-pointer relative ${session.id === activeSessionId
                        ? 'bg-white/30 text-white'
                        : 'bg-white/10 text-white/80 hover:bg-white/20'
                      }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {/* Delete Button - Upper Right Corner (Hover Only) */}
                    {editingSessionId !== session.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSession(session.id);
                        }}
                        className="absolute top-2 right-2 p-1.5 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-100 hover:bg-red-500/30"
                        title="Delete session"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}

                    <div className="flex items-start justify-between pr-8">
                      <div className="flex-1 min-w-0 flex items-center space-x-2">
                        {/* Hotkey number indicator */}
                        {index < 9 && (
                          <div className="flex-shrink-0 w-5 h-5 bg-orange-500/30 text-orange-200 text-xs font-mono rounded flex items-center justify-center border border-orange-400/50">
                            {index + 1}
                          </div>
                        )}
                        <div className="flex-1">
                          {editingSessionId === session.id ? (
                            <div className="flex items-center space-x-2">
                              <input
                                type="text"
                                value={editingSessionName}
                                onChange={(e) => setEditingSessionName(e.target.value)}
                                className="flex-1 bg-white/20 text-white placeholder-white/50 border border-white/30 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    handleSaveEdit(session.id);
                                  } else if (e.key === 'Escape') {
                                    handleCancelEdit();
                                  }
                                }}
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveEdit(session.id);
                                }}
                                className="text-green-400 hover:text-green-300 p-1"
                              >
                                <Check size={14} />
                              </button>
                            </div>
                          ) : (
                            <div className="relative group/name">
                              <div className="flex items-center space-x-2">
                                {/* Status indicator with MessageCircle icon */}
                                <div className="relative">
                                  <MessageCircle size={16} />
                                  {/* Status dot overlay */}
                                  <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border border-slate-800 ${
                                    !session.claudeSessionId ? 'bg-gray-400' :        // No Claude session linked
                                    session.status === 'loading' ? 'bg-yellow-400 animate-pulse' :  // Claude thinking
                                    'bg-green-400'  // Claude ready for user input
                                  }`} />
                                </div>
                                <div className="flex-1">
                                  <span className="font-medium text-sm truncate group-hover/name:border-b border-white/40 transition-all duration-200 block">
                                    {typeof session.name === 'string' ? session.name : session.name?.name || 'Unnamed Session'}
                                  </span>
                                  <div className="text-xs text-white/50 truncate mt-0.5">
                                    {session.projectPath ?
                                      session.projectPath.split('/').pop() || session.projectPath :
                                      'holler'
                                    }
                                  </div>
                                </div>
                                {/* Edit Button - Right Behind Name (Hover Only) */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStartEdit(session.id, typeof session.name === 'string' ? session.name : session.name?.name || 'Unnamed Session');
                                  }}
                                  className="text-yellow-300 hover:text-yellow-100 p-1 rounded transition-all duration-200 opacity-0 group-hover:opacity-100"
                                  title="Rename session"
                                >
                                  <Edit3 size={12} />
                                </button>
                              </div>

                              {/* Copy Resume Command Button - Under Name (Hover Only) */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyResumeCommand(session.id);
                                }}
                                className="text-blue-300 hover:text-blue-100 text-xs opacity-0 group-hover:opacity-100 transition-all duration-200 mt-1 flex items-center space-x-1 hover:bg-blue-500/20 px-1 py-0.5 rounded"
                                title="Copy resume command to clipboard - Ctrl+C terminal then paste command"
                              >
                                <Copy size={10} />
                                <span>Copy Resume</span>
                              </button>

                              {/* Jarvis Mode Toggle - Per Session */}
                              <div className="mt-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-all duration-200">
                                <span className="text-xs text-white/80 flex items-center space-x-1">
                                  <span>🤖</span>
                                  <span>Jarvis Mode</span>
                                </span>
                                <motion.button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (!socket) return;
                                    
                                    const newJarvisMode = !session.jarvisMode;
                                    
                                    console.log(`🔄 Toggling Jarvis mode: ${newJarvisMode ? 'ON' : 'OFF'} for session ${session.id}`);
                                    
                                    try {
                                      socket.emit('session:toggle-jarvis', {
                                        sessionId: session.id,
                                        jarvisMode: newJarvisMode
                                      });
                                      
                                      console.log(`✅ Jarvis mode ${newJarvisMode ? 'ENABLED' : 'DISABLED'} for session: ${session.id}`);
                                    } catch (error) {
                                      console.error('❌ Failed to toggle Jarvis mode:', error);
                                    }
                                  }}
                                  className={`relative w-8 h-4 rounded-full transition-all ml-2 ${
                                    session.jarvisMode 
                                      ? 'bg-blue-500 shadow-blue-500/50 shadow-lg' 
                                      : 'bg-gray-600'
                                  }`}
                                  whileTap={{ scale: 0.95 }}
                                >
                                  <motion.div
                                    className="w-3 h-3 bg-white rounded-full absolute top-0.5"
                                    animate={{
                                      x: session.jarvisMode ? 18 : 2
                                    }}
                                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                  />
                                </motion.button>
                              </div>

                              {/* Clone Button - BROKEN - Commented out */}
                              {/* 
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCloneSession(session.id);
                              }}
                              className="text-blue-300 hover:text-blue-100 text-xs opacity-0 group-hover:opacity-100 transition-all duration-200 mt-1 flex items-center space-x-1 hover:bg-blue-500/20 px-1 py-0.5 rounded"
                              title="Clone session - BROKEN: Creates random sessions instead of preserving conversation history"
                            >
                              <Copy size={10} />
                              <span>Clone</span>
                            </button>
                            */}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>

                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Empty state */}
          {sessions.length === 0 && (
            <div className="text-center text-white/60 py-8">
              <MessageCircle size={48} className="mx-auto mb-4 opacity-50" />
              <p className="text-sm">No sessions yet</p>
              <p className="text-xs mt-2">Create your first session to get started</p>
            </div>
          )}
        </div>

        {/* True Undo Delete Toast */}
        {recentlyDeleted && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-4 left-4 bg-orange-600/90 backdrop-blur-sm text-white p-3 rounded-lg shadow-xl border border-orange-500/50 max-w-sm z-50"
          >
            <div className="flex items-center justify-between space-x-3">
              <div className="flex items-center space-x-2">
                <div className="flex-shrink-0">
                  <Trash2 size={16} />
                </div>
                <div>
                  <p className="text-sm font-medium">Session deleted</p>
                  <p className="text-xs opacity-90">{typeof recentlyDeleted.session.name === 'string' ? recentlyDeleted.session.name : recentlyDeleted.session.name?.name || 'Unnamed Session'}</p>
                </div>
              </div>
              <button
                onClick={handleUndoDelete}
                className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-sm font-medium transition-colors"
              >
                Undo
              </button>
            </div>
          </motion.div>
        )}

        {/* Deletion Error Toast */}
        {deletionError && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-4 right-4 bg-red-500/90 backdrop-blur-sm text-white p-3 rounded-lg shadow-xl border border-red-400/50 max-w-sm z-50"
          >
            <div className="flex items-center space-x-2">
              <div className="flex-shrink-0">
                <Trash2 size={16} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Deletion Failed</p>
                <p className="text-xs opacity-90">{deletionError}</p>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Terminal Area */}
      <div className="flex-1 relative max-w-4xl">
        {sessions.length === 0 && (
          <div className="flex items-center justify-center h-full text-white/60">
            <div className="text-center">
              <div className="text-4xl mb-4">🎯</div>
              <p className="mb-2">No Holler sessions created yet</p>
              <p className="text-sm">Create your first session to start working with Claude Code</p>
            </div>
          </div>
        )}

        {Array.from(terminals.entries()).map(([terminalId, terminal]) => (
          <div
            key={terminalId}
            ref={terminal.containerRef}
            className="absolute inset-0"
            style={{
              width: '100%',
              height: '100%',
              display: sessions.find(s => s.terminalId === terminalId && s.id === activeSessionId) ? 'block' : 'none'
            }}
          />
        ))}
      </div>

      {/* Right Panel - Tabbed Interface */}
      <div className="w-96 bg-black/10 backdrop-blur-md border-l border-white/30 flex flex-col">
        {/* Tab Navigation */}
        <div className="flex border-b border-white/30">
          <button
            onClick={() => setActiveRightTab('planning')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeRightTab === 'planning'
                ? 'bg-orange-500/20 text-white border-b-2 border-orange-500'
                : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
          >
            📋 Planning
          </button>
          <button
            onClick={() => setActiveRightTab('files')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeRightTab === 'files'
                ? 'bg-orange-500/20 text-white border-b-2 border-orange-500'
                : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
          >
            📁 Files
          </button>
          <button
            onClick={() => setActiveRightTab('tools')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeRightTab === 'tools'
                ? 'bg-orange-500/20 text-white border-b-2 border-orange-500'
                : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
          >
            🔧 Tools
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          {activeRightTab === 'planning' && (
            <div className="h-full flex flex-col">
              {planningDocsLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-white/60">Loading planning docs...</div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col space-y-4 p-4">
                  {/* Session.md */}
                  <div className="flex-1 min-h-0">
                    <h4 className="text-sm font-semibold text-white/80 mb-2 flex items-center gap-2">
                      session.md
                      {sessionMdSaving && (
                        <span className="text-xs text-orange-400 opacity-75">saving...</span>
                      )}
                    </h4>
                    <textarea
                      value={sessionMdContent}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setSessionMdContent(newValue);
                        const activeSession = sessions.find(s => s.id === activeSessionId);
                        if (activeSession) {
                          const projectPath = activeSession.projectPath || '/Users/joshuamullet/code/holler';
                          debouncedSaveSessionMd(newValue, projectPath);
                        }
                      }}
                      className="w-full h-full bg-black/20 text-white text-xs font-mono border border-white/30 rounded px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="Session notes and current work..."
                    />
                  </div>

                  {/* Todo.md */}
                  <div className="flex-1 min-h-0">
                    <h4 className="text-sm font-semibold text-white/80 mb-2 flex items-center gap-2">
                      todo.md
                      {todoMdSaving && (
                        <span className="text-xs text-orange-400 opacity-75">saving...</span>
                      )}
                    </h4>
                    <textarea
                      value={todoMdContent}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setTodoMdContent(newValue);
                        const activeSession = sessions.find(s => s.id === activeSessionId);
                        if (activeSession) {
                          const projectPath = activeSession.projectPath || '/Users/joshuamullet/code/holler';
                          debouncedSaveTodoMd(newValue, projectPath);
                        }
                      }}
                      className="w-full h-full bg-black/20 text-white text-xs font-mono border border-white/30 rounded px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="Todo items and task tracking..."
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {activeRightTab === 'files' && (
            <div className="p-4 h-full">
              <div className="text-white/60 text-sm">
                File browser will appear here
              </div>
            </div>
          )}

          {activeRightTab === 'tools' && (
            <div className="p-4 h-full">
              <div className="text-white/60 text-sm">
                Project-specific tools will appear here
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Browse & Promote Modal */}
      <SessionManagementModal
        isOpen={showBrowsePromoteModal}
        onClose={() => setShowBrowsePromoteModal(false)}
        onSessionCreated={handleSessionCreated}
        browseOnly={true}
      />

      {/* Floating Audio Button - Positioned absolutely to escape flex container */}
      <FloatingWorkbench 
        activeSessionId={activeSessionId}
        onSendMessage={handleSendMessage}
      />
    </div>
  );
};

export default HollerSessionManager;