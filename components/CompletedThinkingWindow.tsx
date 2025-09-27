'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

interface ThinkingBlock {
  id: string;
  content: string;
  timestamp: string;
  type: 'text' | 'tool_use' | 'tool_result' | 'tool_combined' | 'todo' | 'system';
}

interface Message {
  type: 'user' | 'claude' | 'system' | 'thinking' | 'thinking_block';
  content: string;
  timestamp: string;
  blockType?: string;
}

interface CompletedThinkingWindowProps {
  thinkingMessages: Message[];
}

export default function CompletedThinkingWindow({ thinkingMessages }: CompletedThinkingWindowProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  if (thinkingMessages.length === 0) return null;

  // Handle expansion with dual auto-scroll
  const handleToggleExpanded = () => {
    setIsExpanded(prev => {
      const newExpanded = !prev;
      
      if (newExpanded) {
        // When expanding, scroll main container to show this component fully + scroll thinking window to bottom
        setTimeout(() => {
          // Center this component in the main conversation view
          if (containerRef.current) {
            containerRef.current.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center',
              inline: 'nearest'
            });
          }
          
          // Then smooth scroll thinking window internal scroll to bottom  
          setTimeout(() => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTo({
                top: scrollContainerRef.current.scrollHeight,
                behavior: 'smooth'
              });
            }
          }, 400); // Wait for main scroll to finish
        }, 50);
      }
      
      return newExpanded;
    });
  };

  // Convert messages to blocks
  const blocks: ThinkingBlock[] = thinkingMessages.map((msg, index) => ({
    id: `completed-${msg.timestamp}-${index}`,
    content: msg.content,
    timestamp: msg.timestamp,
    type: (msg.blockType as any) || 'text'
  }));

  // Native Claude CLI styling function
  const getBlockStyling = (blockType: string) => {
    switch (blockType) {
      case 'todo':
        return 'text-green-700 opacity-85';
      case 'tool_use':
        return 'text-blue-700 opacity-75';
      case 'tool_result':
        return 'text-gray-600 opacity-70';
      case 'tool_combined':
        return 'text-blue-600 opacity-75';
      case 'system':
        return 'text-yellow-700 opacity-75';
      default:
        return 'text-gray-800 opacity-80';
    }
  };

  return (
    <div ref={containerRef} className="mb-6">
      {/* Clickable Header Button */}
      <button
        onClick={handleToggleExpanded}
        className={`w-full flex items-center justify-between p-4 rounded-lg transition-all duration-200 group ${
          isExpanded 
            ? 'bg-gray-100 border-2 border-gray-300 shadow-sm' 
            : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 hover:border-blue-300 hover:shadow-md hover:from-blue-100 hover:to-indigo-100'
        }`}
      >
        <div className="flex items-center space-x-3">
          {isExpanded ? (
            <ChevronDown size={16} className="text-gray-600 group-hover:text-gray-800" />
          ) : (
            <ChevronRight size={16} className="text-blue-600 group-hover:text-blue-700" />
          )}
          <span className={`font-semibold text-sm ${
            isExpanded ? 'text-gray-700' : 'text-blue-700 group-hover:text-blue-800'
          }`}>
            🧠 Thinking process ({blocks.length} thought{blocks.length !== 1 ? 's' : ''})
          </span>
        </div>
        <span className="text-xs text-gray-500 ml-4">
          {new Date(blocks[0].timestamp).toLocaleTimeString()}
        </span>
      </button>

      {/* Expandable Thinking Content */}
      {isExpanded && (
        <div 
          ref={scrollContainerRef}
          className="mt-2 max-h-[400px] overflow-y-auto border-2 border-gray-300 border-t-0 rounded-b-lg bg-gray-50 p-4 space-y-3"
        >
          {blocks.map((block, index) => {
            const blockStyling = getBlockStyling(block.type);
            
            return (
              <div 
                key={block.id}
                className={`${blockStyling} ${block.type === 'text' ? 'italic' : ''} text-sm`}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkBreaks]}
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="mb-2 pl-4">{children}</ul>,
                    ol: ({ children }) => <ol className="mb-2 pl-4">{children}</ol>,
                    li: ({ children }) => <li className="mb-1">{children}</li>,
                    h1: ({ children }) => <h1 className="text-base font-bold mb-2 mt-2 first:mt-0">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-sm font-bold mb-1 mt-2 first:mt-0">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-bold mb-1 mt-1 first:mt-0">{children}</h3>,
                    pre: ({ children }) => (
                      <pre className="bg-gray-200 rounded p-2 overflow-x-auto text-xs mb-2">
                        {children}
                      </pre>
                    ),
                    code: ({ children, className }) => (
                      className ? (
                        <code className={`${className} bg-gray-200 rounded px-1 text-xs`}>
                          {children}
                        </code>
                      ) : (
                        <code className="bg-gray-200 rounded px-1 text-xs">{children}</code>
                      )
                    ),
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>
                  }}
                >
                  {block.content}
                </ReactMarkdown>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}