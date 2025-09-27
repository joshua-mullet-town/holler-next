'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { ChevronDown, Brain, Code, CheckCircle, AlertTriangle, Cog, Zap } from 'lucide-react';

interface ThinkingBlock {
  id: string;
  content: string;
  timestamp: string;
  type: 'text' | 'tool_use' | 'tool_result' | 'tool_combined' | 'todo' | 'system';
}

interface CompactThinkingWindowProps {
  blocks: ThinkingBlock[];
  isStreaming: boolean;
  streamingThoughts?: string;
  isConnectedToMessage?: boolean;
}

const getBlockTypeConfig = (type: string) => {
  const configs = {
    'text': { 
      icon: Brain, 
      color: 'from-orange-100 to-orange-50', 
      border: 'border-orange-200',
      badge: 'bg-orange-100 text-orange-700',
      accent: 'bg-orange-400'
    },
    'tool_use': { 
      icon: Code, 
      color: 'from-blue-100 to-blue-50', 
      border: 'border-blue-200',
      badge: 'bg-blue-100 text-blue-700',
      accent: 'bg-blue-400'
    },
    'tool_result': { 
      icon: CheckCircle, 
      color: 'from-green-100 to-green-50', 
      border: 'border-green-200',
      badge: 'bg-green-100 text-green-700',
      accent: 'bg-green-400'
    },
    'tool_combined': { 
      icon: Zap, 
      color: 'from-purple-100 to-purple-50', 
      border: 'border-purple-200',
      badge: 'bg-purple-100 text-purple-700',
      accent: 'bg-purple-400'
    },
    'todo': { 
      icon: AlertTriangle, 
      color: 'from-yellow-100 to-yellow-50', 
      border: 'border-yellow-200',
      badge: 'bg-yellow-100 text-yellow-700',
      accent: 'bg-yellow-400'
    },
    'system': { 
      icon: Cog, 
      color: 'from-red-100 to-red-50', 
      border: 'border-red-200',
      badge: 'bg-red-100 text-red-700',
      accent: 'bg-red-400'
    },
  };
  return configs[type as keyof typeof configs] || configs['text'];
};

export default function CompactThinkingWindow({ 
  blocks, 
  isStreaming,
  streamingThoughts,
  isConnectedToMessage = false
}: CompactThinkingWindowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);

  // Smart auto-scroll behavior
  useEffect(() => {
    if (scrollRef.current && !userScrolledUp && isStreaming && isExpanded) {
      const element = scrollRef.current;
      element.scrollTop = element.scrollHeight;
    }
  }, [blocks, streamingThoughts, userScrolledUp, isStreaming, isExpanded]);

  // Handle scroll tracking
  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
      const nearBottom = distanceFromBottom < 50;
      
      setIsNearBottom(nearBottom);
      setUserScrolledUp(!nearBottom && isStreaming);
    }
  };

  // Auto-expand when streaming starts
  useEffect(() => {
    if (isStreaming && blocks.length > 0) {
      setIsExpanded(true);
    }
  }, [isStreaming, blocks.length]);

  if (blocks.length === 0 && !streamingThoughts) {
    return null;
  }

  return (
    <div className={isConnectedToMessage ? "w-full" : "w-full mb-8"}>
      {/* Glass-morphic Header */}
      <motion.div 
        onClick={() => setIsExpanded(!isExpanded)}
        className={`relative p-4 cursor-pointer group overflow-hidden ${
          isConnectedToMessage 
            ? "bg-white/20 backdrop-blur-sm" 
            : "bg-white/20 backdrop-blur-sm border border-orange-200/50 rounded-t-xl"
        }`}
        whileHover={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.25)',
          borderColor: 'rgba(255, 165, 0, 0.3)'
        }}
        transition={{ duration: 0.2 }}
      >
        {/* Orange accent line */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-orange-400 to-orange-600"></div>
        
        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center space-x-3">
            <Brain className="w-5 h-5 text-orange-600" />
            <div className="text-gray-800 font-medium">
              Claude's reasoning ({blocks.length} step{blocks.length !== 1 ? 's' : ''})
            </div>
            {isStreaming && (
              <div className="flex items-center space-x-2">
                <motion.div 
                  className="flex space-x-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 bg-orange-500 rounded-full"
                      animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [0.6, 1, 0.6]
                      }}
                      transition={{ 
                        duration: 1.2, 
                        repeat: Infinity,
                        delay: i * 0.2
                      }}
                    />
                  ))}
                </motion.div>
                <span className="text-xs text-orange-700 font-medium">thinking...</span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {!isNearBottom && isStreaming && isExpanded && (
              <motion.button
                onClick={(e) => {
                  e.stopPropagation();
                  if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                    setUserScrolledUp(false);
                  }
                }}
                className="text-xs text-orange-600 hover:text-orange-800 px-2 py-1 rounded-full bg-orange-100/50 hover:bg-orange-100 transition-colors border border-orange-200/50"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                ↓ Jump to latest
              </motion.button>
            )}
            <motion.div
              animate={{ rotate: isExpanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              className="text-orange-600 group-hover:text-orange-700"
            >
              <ChevronDown className="w-5 h-5" />
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Thinking Timeline */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className={`relative bg-white/15 backdrop-blur-sm overflow-hidden ${
              isConnectedToMessage 
                ? "" 
                : "border-l border-r border-b border-orange-200/50 rounded-b-xl shadow-lg"
            }`}
          >
            <div 
              ref={scrollRef}
              onScroll={handleScroll}
              className="max-h-96 overflow-y-auto p-6"
              style={{ 
                scrollBehavior: 'smooth',
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(255, 165, 0, 0.3) transparent'
              }}
            >
              {/* Timeline container */}
              <div className="relative">
                {/* Timeline line */}
                {blocks.length > 1 && (
                  <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-gradient-to-b from-orange-300 via-orange-200 to-transparent opacity-60"></div>
                )}
                
                <div className="space-y-6">
                  {blocks.map((block, index) => {
                    const config = getBlockTypeConfig(block.type);
                    const IconComponent = config.icon;
                    
                    return (
                      <motion.div
                        key={block.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="relative pl-16"
                      >
                        {/* Timeline node */}
                        <motion.div 
                          className={`absolute left-4 top-3 w-4 h-4 rounded-full ${config.accent} shadow-sm border-2 border-white flex items-center justify-center`}
                          whileHover={{ scale: 1.1 }}
                          transition={{ duration: 0.2 }}
                        >
                          <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                        </motion.div>

                        {/* Content card */}
                        <motion.div 
                          className={`bg-gradient-to-br ${config.color} ${config.border} border rounded-xl p-4 shadow-sm hover:shadow-md transition-all backdrop-blur-sm`}
                          whileHover={{ 
                            scale: 1.01,
                            y: -2,
                            boxShadow: '0 8px 25px -5px rgba(0, 0, 0, 0.1), 0 4px 10px -3px rgba(0, 0, 0, 0.1)'
                          }}
                          transition={{ duration: 0.2 }}
                        >
                          {/* Block header */}
                          <div className="flex items-center space-x-2 mb-3">
                            <IconComponent className="w-4 h-4 text-gray-600" />
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.badge} border border-black/5`}>
                              {block.type.replace('_', ' ')}
                            </span>
                          </div>

                          {/* Block content */}
                          <div className="prose prose-sm max-w-none text-gray-700">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm, remarkBreaks]}
                              components={{
                                p: ({ children }) => (
                                  <div className="mb-3 leading-relaxed whitespace-pre-wrap last:mb-0">{children}</div>
                                ),
                                pre: ({ children }) => (
                                  <div className="bg-gray-900 text-gray-100 border border-gray-700 rounded-lg p-4 overflow-x-auto text-xs font-mono my-3 shadow-inner">
                                    {children}
                                  </div>
                                ),
                                code: ({ children }) => (
                                  <span className="bg-gray-200 text-gray-800 px-2 py-0.5 rounded-md text-xs font-mono border border-gray-300">
                                    {children}
                                  </span>
                                ),
                                ul: ({ children }) => (
                                  <ul className="mb-3 pl-4 space-y-1">{children}</ul>
                                ),
                                ol: ({ children }) => (
                                  <ol className="mb-3 pl-4 space-y-1">{children}</ol>
                                ),
                                li: ({ children }) => (
                                  <li className="text-sm">{children}</li>
                                ),
                                strong: ({ children }) => (
                                  <strong className="font-semibold text-gray-800">{children}</strong>
                                )
                              }}
                            >
                              {block.content}
                            </ReactMarkdown>
                          </div>
                        </motion.div>
                      </motion.div>
                    );
                  })}
                  
                  {/* Streaming thoughts */}
                  {streamingThoughts && (
                    <motion.div
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="relative pl-16"
                    >
                      {/* Animated streaming node */}
                      <motion.div 
                        className="absolute left-4 top-3 w-4 h-4 rounded-full bg-orange-400 shadow-sm border-2 border-white"
                        animate={{ 
                          scale: [1, 1.1, 1],
                          boxShadow: [
                            '0 0 0 0 rgba(255, 165, 0, 0.7)',
                            '0 0 0 8px rgba(255, 165, 0, 0)',
                            '0 0 0 0 rgba(255, 165, 0, 0)'
                          ]
                        }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <div className="w-1.5 h-1.5 bg-white rounded-full absolute inset-0 m-auto"></div>
                      </motion.div>

                      <motion.div 
                        className="bg-gradient-to-br from-orange-100 to-orange-50 border-orange-200 border rounded-xl p-4 shadow-sm backdrop-blur-sm"
                        animate={{ opacity: [0.7, 1, 0.7] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <div className="flex items-center space-x-2 mb-3">
                          <Brain className="w-4 h-4 text-gray-600" />
                          <span className="px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                            streaming...
                          </span>
                        </div>
                        <div className="prose prose-sm max-w-none text-gray-700 italic">
                          {streamingThoughts}
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>

            {/* Gradient fade at bottom */}
            <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white/15 to-transparent pointer-events-none"></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}