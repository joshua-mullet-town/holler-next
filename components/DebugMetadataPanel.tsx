'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bug, ChevronUp, ChevronDown, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Session } from '../hooks/useSessionManager';

interface DebugMetadataPanelProps {
  activeSession: Session | null;
  isStreaming?: boolean;
  lastStreamingData?: any;
}

const DebugMetadataPanel: React.FC<DebugMetadataPanelProps> = ({
  activeSession,
  isStreaming = false,
  lastStreamingData
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!activeSession) return null;

  const metadata = activeSession.metadata || {};

  const getStatusIcon = (value: any) => {
    if (value === undefined || value === null) {
      return <XCircle className="text-red-400" size={12} />;
    }
    return <CheckCircle className="text-green-400" size={12} />;
  };

  const formatValue = (value: any) => {
    if (value === undefined || value === null) {
      return <span className="text-red-400 italic">missing</span>;
    }
    if (typeof value === 'boolean') {
      return <span className={value ? "text-green-400" : "text-gray-400"}>{value.toString()}</span>;
    }
    if (typeof value === 'number') {
      return <span className="text-blue-400">{value}</span>;
    }
    return <span className="text-white">{value.toString()}</span>;
  };

  const debugItems = [
    { label: 'Context Remaining', key: 'contextRemaining', value: metadata.contextRemaining, suffix: '%' },
    { label: 'Permission Bypass', key: 'permissionsBypass', value: metadata.permissionsBypass },
    { label: 'Last Context Update', key: 'lastContextUpdate', value: metadata.lastContextUpdate },
    { label: 'Last Permission Update', key: 'lastPermissionUpdate', value: metadata.lastPermissionUpdate },
    { label: 'Total Cost', key: 'totalCost', value: metadata.totalCost, prefix: '$' },
    { label: 'Last Cost', key: 'lastCost', value: metadata.lastCost, prefix: '$' },
    { label: 'Total Tokens', key: 'totalTokens', value: metadata.totalTokens },
    { label: 'Last Tokens', key: 'lastTokens', value: metadata.lastTokens },
    { label: 'Service Tier', key: 'serviceTier', value: metadata.serviceTier },
    { label: 'Last Duration', key: 'lastDuration', value: metadata.lastDuration, suffix: 'ms' },
    { label: 'Message Count', key: 'messageCount', value: metadata.messageCount },
  ];

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <motion.div
        className="bg-black/90 backdrop-blur-sm border border-yellow-500/50 rounded-lg shadow-xl"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        {/* Header */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full p-3 text-yellow-400 hover:text-yellow-300 transition-colors"
        >
          <div className="flex items-center space-x-2">
            <Bug size={16} />
            <span className="text-sm font-mono font-bold">Debug Metadata</span>
            {isStreaming && (
              <div className="animate-pulse w-2 h-2 bg-orange-400 rounded-full" />
            )}
          </div>
          {isExpanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>

        {/* Content */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 pt-0 space-y-2 max-h-96 overflow-y-auto">
                <div className="border-t border-yellow-500/30 pt-3">
                  <h4 className="text-xs font-bold text-yellow-400 mb-2">SESSION: {activeSession.name}</h4>
                  
                  {debugItems.map((item) => (
                    <div key={item.key} className="flex items-center justify-between py-1 text-xs font-mono">
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(item.value)}
                        <span className="text-gray-300">{item.label}:</span>
                      </div>
                      <span className="text-right">
                        {item.prefix && <span className="text-gray-400">{item.prefix}</span>}
                        {formatValue(item.value)}
                        {item.suffix && <span className="text-gray-400">{item.suffix}</span>}
                      </span>
                    </div>
                  ))}

                  {/* Critical Context Warning */}
                  {metadata.contextRemaining !== undefined && metadata.contextRemaining < 20 && (
                    <div className="mt-3 p-2 bg-red-500/20 border border-red-500/50 rounded text-xs">
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="text-red-400" size={12} />
                        <span className="text-red-300 font-bold">LOW CONTEXT WARNING</span>
                      </div>
                      <div className="text-red-200 mt-1">
                        Only {metadata.contextRemaining}% context remaining!
                      </div>
                    </div>
                  )}

                  {/* Streaming Data */}
                  {lastStreamingData && (
                    <div className="mt-3 border-t border-yellow-500/30 pt-2">
                      <div className="text-xs text-yellow-400 font-bold mb-1">Last Streaming Data:</div>
                      <pre className="text-xs text-gray-300 bg-gray-900/50 p-2 rounded max-h-32 overflow-y-auto">
                        {JSON.stringify(lastStreamingData, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Raw Metadata */}
                  <div className="mt-3 border-t border-yellow-500/30 pt-2">
                    <div className="text-xs text-yellow-400 font-bold mb-1">Raw Metadata:</div>
                    <pre className="text-xs text-gray-300 bg-gray-900/50 p-2 rounded max-h-32 overflow-y-auto">
                      {JSON.stringify(metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default DebugMetadataPanel;