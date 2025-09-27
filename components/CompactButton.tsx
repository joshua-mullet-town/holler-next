'use client';

import React from 'react';

interface CompactButtonProps {
  cacheTokens?: number;
  onCompact: () => void;
  disabled?: boolean;
}

/**
 * 🪙 Progressive Urgency Compact Button 
 * Shows cache token percentage and urgency level with color coding
 */
export default function CompactButton({ cacheTokens = 0, onCompact, disabled = false }: CompactButtonProps) {
  // Calculate percentage based on research: ~150K tokens = auto-compact
  const percentage = Math.round((cacheTokens / 150000) * 100);
  
  // Calculate urgency level and styling
  const getUrgencyStyle = () => {
    if (cacheTokens < 100000) {
      return {
        level: 'normal',
        color: 'text-gray-600',
        bg: 'bg-gray-100 hover:bg-gray-200',
        icon: ''
      };
    } else if (cacheTokens < 130000) {
      return {
        level: 'warning', 
        color: 'text-yellow-700',
        bg: 'bg-yellow-100 hover:bg-yellow-200',
        icon: '🟡'
      };
    } else if (cacheTokens < 150000) {
      return {
        level: 'urgent',
        color: 'text-orange-700',
        bg: 'bg-orange-100 hover:bg-orange-200',
        icon: '🟠'
      };
    } else {
      return {
        level: 'critical',
        color: 'text-red-700',
        bg: 'bg-red-100 hover:bg-red-200',
        icon: '🔴'
      };
    }
  };

  const urgency = getUrgencyStyle();
  
  // Format cache tokens for display
  const formatTokens = (tokens: number) => {
    if (tokens < 1000) return tokens.toString();
    if (tokens < 1000000) return `${Math.round(tokens / 1000)}K`;
    return `${Math.round(tokens / 1000000)}M`;
  };

  // Always show percentage for debugging (as requested)
  const buttonText = `${urgency.icon} Compact ${percentage}% (${formatTokens(cacheTokens)})`.trim();

  return (
    <button
      onClick={onCompact}
      disabled={disabled}
      className={`
        p-3 rounded-xl text-sm font-medium
        transition-colors duration-200
        disabled:opacity-50 disabled:cursor-not-allowed
        ${urgency.color} ${urgency.bg}
        border-2 border-gray-300
        flex-shrink-0
      `}
      title={`Cache tokens: ${cacheTokens.toLocaleString()} (~${percentage}% until auto-compact)`}
    >
      {buttonText}
    </button>
  );
}