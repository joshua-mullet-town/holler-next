'use client';

import { useState, useEffect } from 'react';
import path from 'path';

interface DiscoveredSession {
  sessionId: string;
  projectPath: string;
  version: string;
  createdAt: number;
  modifiedAt: number;
  lastMessage: string;
  fileSize: number;
  filePath: string;
  messageCount: number;
}

interface GroupedSessions {
  today: DiscoveredSession[];
  yesterday: DiscoveredSession[];
  thisWeek: DiscoveredSession[];
  older: DiscoveredSession[];
}

interface SessionManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSessionCreated: (session: any) => void;
  browseOnly?: boolean;
}

export default function SessionManagementModal({
  isOpen,
  onClose,
  onSessionCreated,
  browseOnly = false
}: SessionManagementModalProps) {
  const [groupedSessions, setGroupedSessions] = useState<GroupedSessions | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Promotion state
  const [promotingSessionId, setPromotingSessionId] = useState<string | null>(null);
  const [promotionName, setPromotionName] = useState('');
  const [promotionProjectPath, setPromotionProjectPath] = useState('/Users/joshuamullet/code/holler');
  const [showPromotionInput, setShowPromotionInput] = useState<string | null>(null);
  const [availableDirectories, setAvailableDirectories] = useState<string[]>([]);


  // Load discovered sessions and directories when modal opens
  useEffect(() => {
    if (isOpen) {
      loadDiscoveredSessions();
      loadAvailableDirectories();
    }
  }, [isOpen]);

  const loadAvailableDirectories = async () => {
    try {
      const response = await fetch('/api/directories');
      const data = await response.json();
      if (data.success) {
        setAvailableDirectories(data.directories);
      }
    } catch (error) {
      // Failed to load directories
    }
  };

  const loadDiscoveredSessions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/sessions/discover?limit=10&groupByDate=true');
      const data = await response.json();
      
      if (data.success) {
        setGroupedSessions(data.sessions);
      } else {
        setError(data.error || 'Failed to load sessions');
      }
    } catch (err) {
      setError('Network error loading sessions');
      // Failed to load discovered sessions
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now();
    const timeDiff = now - timestamp;
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return days === 1 ? '1 day ago' : `${days} days ago`;
    } else if (hours > 0) {
      return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
    } else {
      return 'Just now';
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const handlePromoteSession = async (sessionId: string, name: string, projectPath?: string) => {
    if (!name.trim()) {
      alert('Please enter a session name');
      return;
    }

    setPromotingSessionId(sessionId);
    
    try {
      const response = await fetch('/api/sessions/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claudeSessionId: sessionId,
          name: name.trim(),
          projectPath: projectPath || promotionProjectPath
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        onSessionCreated(data.session);
        onClose();
        // Reset state
        setPromotionName('');
        setPromotionProjectPath('/Users/joshuamullet/code/holler');
        setShowPromotionInput(null);
      } else {
        alert(data.error || 'Failed to promote session');
      }
    } catch (err) {
      // Failed to promote session
      alert('Network error promoting session');
    } finally {
      setPromotingSessionId(null);
    }
  };


  const renderSessionGroup = (title: string, sessions: DiscoveredSession[]) => {
    if (sessions.length === 0) return null;

    return (
      <div key={title} className="mb-6">
        <h3 className="text-sm font-semibold text-white/70 mb-3 uppercase tracking-wide">
          {title}
        </h3>
        <div className="space-y-2">
          {sessions.map((session) => (
            <div
              key={session.sessionId}
              className="bg-slate-800/50 rounded-lg p-4 border border-slate-700/50 hover:border-slate-600 transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="flex items-center gap-1 text-xs text-green-400">
                      <span className="font-medium">{session.messageCount}</span>
                      <span className="text-green-300">messages</span>
                    </div>
                    <div className="text-xs text-white/60">
                      <span className="text-white/40">Created:</span> {formatDate(session.createdAt)}
                    </div>
                    <div className="text-xs text-white/60">
                      <span className="text-white/40">Updated:</span> {formatDate(session.modifiedAt)}
                    </div>
                  </div>
                  
                  {session.lastMessage && (
                    <p className="text-sm text-white/70 leading-relaxed line-clamp-2 mb-2">
                      {session.lastMessage}
                    </p>
                  )}
                </div>
              </div>

              {showPromotionInput === session.sessionId ? (
                <div className="mt-3 space-y-3">
                  <input
                    type="text"
                    value={promotionName}
                    onChange={(e) => setPromotionName(e.target.value)}
                    placeholder="Enter session name..."
                    className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
                    autoFocus
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handlePromoteSession(session.sessionId, promotionName);
                      }
                    }}
                  />
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={promotionProjectPath}
                      onChange={(e) => handleManualPathInput(e.target.value, setPromotionProjectPath)}
                      placeholder="Enter project directory path..."
                      className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-white text-sm focus:border-blue-500 focus:outline-none"
                    />
                    <div className="space-y-1">
                      <span className="text-xs text-white/50">Quick select:</span>
                      <div className="flex flex-wrap gap-1">
                        {availableDirectories.slice(0, 6).map((dir) => (
                          <button
                            key={dir}
                            onClick={() => setPromotionProjectPath(dir)}
                            className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded transition-colors"
                          >
                            {path.basename(dir)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePromoteSession(session.sessionId, promotionName)}
                      disabled={promotingSessionId === session.sessionId}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white text-sm rounded font-medium transition-colors"
                    >
                      {promotingSessionId === session.sessionId ? 'Adding...' : 'Add'}
                    </button>
                    <button
                      onClick={() => {
                        setShowPromotionInput(null);
                        setPromotionName('');
                        setPromotionProjectPath('/Users/joshuamullet/code/holler');
                      }}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    setShowPromotionInput(session.sessionId);
                    setPromotionName('');
                  }}
                  className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded font-medium transition-colors"
                >
                  + Promote to Active
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Session Management</h2>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white p-1 rounded transition-colors"
            >
              ✕
            </button>
          </div>

        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div>
            {loading ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                <p className="text-white/60 mt-2">Loading sessions...</p>
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-red-400 mb-4">{error}</p>
                <button
                  onClick={loadDiscoveredSessions}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : groupedSessions ? (
              <div>
                {renderSessionGroup('Today', groupedSessions.today)}
                {renderSessionGroup('Yesterday', groupedSessions.yesterday)}
                {renderSessionGroup('This Week', groupedSessions.thisWeek)}
                {renderSessionGroup('Older', groupedSessions.older)}
                
                {Object.values(groupedSessions).flat().length === 0 && (
                  <div className="text-center py-8 text-white/60">
                    No Claude sessions found
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}