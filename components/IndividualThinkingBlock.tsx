'use client';

import { useState } from 'react';
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

interface IndividualThinkingBlockProps {
  block: ThinkingBlock;
  maxLines?: number;
}

export default function IndividualThinkingBlock({ 
  block,
  maxLines = 6
}: IndividualThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const lines = block.content.split('\n');
  // Never truncate todo blocks - always show full content
  const shouldTruncate = block.type !== 'todo' && lines.length > maxLines;
  const displayContent = (isExpanded || block.type === 'todo') ? block.content : lines.slice(0, maxLines).join('\n');

  // Native Claude CLI styling - different opacity/color for different types
  const getBlockStyling = (blockType: string) => {
    switch (blockType) {
      case 'todo':
        return 'text-green-700 opacity-85'; // Todo blocks - green and slightly more visible
      case 'tool_use':
        return 'text-blue-700 opacity-75'; // Tool usage - blue and slightly faded
      case 'tool_result':
        return 'text-gray-600 opacity-70'; // Tool results - gray and more faded
      case 'tool_combined':
        return 'text-blue-600 opacity-75'; // Combined tool usage + result - blue and slightly faded
      case 'system':
        return 'text-yellow-700 opacity-75'; // System messages - yellow and faded
      default:
        return 'text-gray-800 opacity-80'; // Thinking text - slightly faded but readable
    }
  };

  const blockStyling = getBlockStyling(block.type);

  return (
    <div className={`mb-3 ${blockStyling} ${block.type === 'text' ? 'italic' : ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 pl-4">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 pl-4">{children}</ol>,
          li: ({ children }) => <li className="mb-1">{children}</li>,
          h1: ({ children }) => <h1 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-2 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-bold mb-1 mt-2 first:mt-0">{children}</h3>,
          pre: ({ children }) => (
            <pre className="bg-gray-100 rounded p-2 overflow-x-auto text-sm mb-2">
              {children}
            </pre>
          ),
          code: ({ children, className }) => (
            className ? (
              <code className={`${className} bg-gray-100 rounded px-1 text-sm`}>
                {children}
              </code>
            ) : (
              <code className="bg-gray-100 rounded px-1 text-sm">{children}</code>
            )
          ),
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>
        }}
      >
        {displayContent}
      </ReactMarkdown>
      
      {shouldTruncate && (
        <div className="mt-1">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 transition-colors opacity-70"
          >
            {isExpanded ? (
              <>
                <ChevronDown size={12} />
                <span>Show less</span>
              </>
            ) : (
              <>
                <ChevronRight size={12} />
                <span>Show {lines.length - maxLines} more lines</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}