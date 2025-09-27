'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

interface TruncatableThoughtsProps {
  content: string;
  maxLinesPerThought?: number;
  renderMarkdown?: boolean;
}

interface ThoughtSegment {
  id: string;
  content: string;
  shouldTruncate: boolean;
  truncatedContent: string;
  totalLines: number;
}

export default function TruncatableThoughts({ 
  content, 
  maxLinesPerThought = 6,
  renderMarkdown = false
}: TruncatableThoughtsProps) {
  const [expandedSegments, setExpandedSegments] = useState<Set<string>>(new Set());

  const thoughtSegments = useMemo(() => {
    // Split content by patterns like "Using **ToolName**", "System:", etc. to identify individual thoughts
    const thoughtPattern = /^(Using \*\*|System:|.*\*\*.*completed)[^\n\r]*/gm;
    const segments: ThoughtSegment[] = [];
    
    let lastIndex = 0;
    let match;
    
    while ((match = thoughtPattern.exec(content)) !== null) {
      // Add any text before this match
      if (match.index > lastIndex) {
        const beforeText = content.slice(lastIndex, match.index).trim();
        if (beforeText) {
          const id = `text-${segments.length}`;
          const lines = beforeText.split('\n');
          const shouldTruncate = lines.length > maxLinesPerThought;
          segments.push({
            id,
            content: beforeText,
            shouldTruncate,
            truncatedContent: shouldTruncate 
              ? lines.slice(0, maxLinesPerThought).join('\n') 
              : beforeText,
            totalLines: lines.length
          });
        }
      }
      
      // Find the end of this thought (next emoji or end of content)
      const nextMatch = thoughtPattern.exec(content);
      thoughtPattern.lastIndex = match.index + match[0].length; // Reset for next iteration
      
      const thoughtEnd = nextMatch ? nextMatch.index : content.length;
      const thoughtText = content.slice(match.index, thoughtEnd).trim();
      
      if (thoughtText) {
        const id = `thought-${segments.length}`;
        const lines = thoughtText.split('\n');
        const shouldTruncate = lines.length > maxLinesPerThought;
        segments.push({
          id,
          content: thoughtText,
          shouldTruncate,
          truncatedContent: shouldTruncate 
            ? lines.slice(0, maxLinesPerThought).join('\n') + '\n...'
            : thoughtText,
          totalLines: lines.length
        });
      }
      
      lastIndex = thoughtEnd;
      
      // Reset regex for next iteration
      if (!nextMatch) break;
      thoughtPattern.lastIndex = nextMatch.index;
    }
    
    // Handle any remaining content
    if (lastIndex < content.length) {
      const remainingText = content.slice(lastIndex).trim();
      if (remainingText) {
        const id = `final-${segments.length}`;
        const lines = remainingText.split('\n');
        const shouldTruncate = lines.length > maxLinesPerThought;
        segments.push({
          id,
          content: remainingText,
          shouldTruncate,
          truncatedContent: shouldTruncate 
            ? lines.slice(0, maxLinesPerThought).join('\n') 
            : remainingText,
          totalLines: lines.length
        });
      }
    }
    
    return segments;
  }, [content, maxLinesPerThought]);

  const toggleExpanded = (segmentId: string) => {
    const newExpanded = new Set(expandedSegments);
    if (newExpanded.has(segmentId)) {
      newExpanded.delete(segmentId);
    } else {
      newExpanded.add(segmentId);
    }
    setExpandedSegments(newExpanded);
  };

  return (
    <div className="font-mono text-sm space-y-2">
      {thoughtSegments.map((segment) => {
        const isExpanded = expandedSegments.has(segment.id);
        const displayContent = isExpanded ? segment.content : segment.truncatedContent;
        
        return (
          <div key={segment.id}>
            {renderMarkdown ? (
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
                  )
                }}
              >
                {displayContent}
              </ReactMarkdown>
            ) : (
              <div className="whitespace-pre-wrap">{displayContent}</div>
            )}
            {segment.shouldTruncate && (
              <div className="mt-1">
                <button
                  onClick={() => toggleExpanded(segment.id)}
                  className="inline-flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800 transition-colors"
                >
                  {isExpanded ? (
                    <>
                      <ChevronDown size={12} />
                      <span>Show less</span>
                    </>
                  ) : (
                    <>
                      <ChevronRight size={12} />
                      <span>Show {segment.totalLines - maxLinesPerThought} more lines</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}