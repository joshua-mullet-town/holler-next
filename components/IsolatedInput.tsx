'use client';

import React, { useState, useRef, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Send, Type, X } from 'lucide-react';

interface IsolatedInputProps {
  onSubmit: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  isRecordingVoice?: boolean;
  onTranscribeOnly?: () => void;
  onCancelRecording?: () => void;
  onAutoSend?: () => void;
}

interface IsolatedInputRef {
  appendText: (text: string) => void;
  getCurrentText: () => string;
  clearText: () => void;
}

// Completely isolated input component with React.memo to prevent parent re-renders
const IsolatedInput = React.memo(forwardRef<IsolatedInputRef, IsolatedInputProps>(({ onSubmit, disabled, placeholder, isRecordingVoice, onTranscribeOnly, onCancelRecording, onAutoSend }: IsolatedInputProps, ref) => {
  const [localInput, setLocalInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout>();

  // Ultra-optimized input handler with no external state dependencies
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setLocalInput(value);
    
    // Debounced auto-resize to prevent performance issues
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }
    
    resizeTimeoutRef.current = setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
      }
    }, 50); // Reduced debounce for better UX
  }, []);

  const handleSubmit = useCallback(() => {
    if (localInput.trim() && !disabled) {
      onSubmit(localInput.trim());
      setLocalInput('');
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [localInput, disabled, onSubmit]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        return; // Allow new line with Shift+Enter
      }
      e.preventDefault();
      
      // During voice recording, Enter should trigger auto-send, not regular submit
      if (isRecordingVoice) {
        onAutoSend?.();
      } else {
        handleSubmit();
      }
    }
  }, [handleSubmit, isRecordingVoice, onAutoSend]);

  // Allow parent to set text (for transcription)
  const appendText = useCallback((text: string) => {
    if (!text) return;
    
    setLocalInput(prev => {
      const prevText = prev || '';
      const newText = prevText ? prevText + ' ' + text : text;
      return newText.trim();
    });
    
    // Auto-resize after setting text
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
      }
    }, 10);
  }, []);

  // Get current text value
  const getCurrentText = useCallback(() => {
    return localInput;
  }, [localInput]);

  // Clear text
  const clearText = useCallback(() => {
    setLocalInput('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, []);

  // Expose methods to parent via useImperativeHandle
  useImperativeHandle(ref, () => ({
    appendText,
    getCurrentText,
    clearText
  }), [appendText, getCurrentText, clearText]);

  // Handle keyboard shortcuts during recording
  useEffect(() => {
    if (!isRecordingVoice) return;

    const handleRecordingKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 't':
          e.preventDefault();
          onTranscribeOnly?.();
          break;
        case 'escape':
          e.preventDefault();
          onCancelRecording?.();
          break;
        case 'enter':
          e.preventDefault();
          onAutoSend?.();
          break;
      }
    };

    document.addEventListener('keydown', handleRecordingKeyDown);
    return () => document.removeEventListener('keydown', handleRecordingKeyDown);
  }, [isRecordingVoice, onTranscribeOnly, onCancelRecording, onAutoSend]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="flex gap-2 items-end">
      <textarea
        ref={textareaRef}
        value={localInput}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={isRecordingVoice ? "Recording voice..." : (placeholder || "Ask Claude anything...")}
        disabled={disabled || isRecordingVoice}
        className={`flex-1 p-3 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none min-h-[44px] max-h-[200px] overflow-y-auto focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 ${
          isRecordingVoice 
            ? 'border-2 border-red-500 shadow-lg shadow-red-500/50 animate-pulse' 
            : 'border border-gray-300 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent'
        }`}
        rows={1}
        style={{ height: 'auto' }}
      />
      
      {isRecordingVoice ? (
        // Three buttons when recording: Text, Cancel, Auto-send
        <>
          <button
            onClick={onTranscribeOnly}
            className="p-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors flex-shrink-0 relative group border-2 border-blue-500"
            type="button"
            title="Transcribe to text box (T)"
          >
            <Type size={20} />
            <div className="absolute -top-1 -right-1 bg-black/80 text-white px-1 py-0.5 rounded text-[10px] opacity-75 group-hover:opacity-100 transition-opacity">
              T
            </div>
          </button>
          
          <button
            onClick={onCancelRecording}
            className="p-3 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors flex-shrink-0 relative group border-2 border-red-500"
            type="button"
            title="Cancel recording (Esc)"
          >
            <X size={20} />
            <div className="absolute -top-1 -right-1 bg-black/80 text-white px-1 py-0.5 rounded text-[10px] opacity-75 group-hover:opacity-100 transition-opacity">
              Esc
            </div>
          </button>
          
          <button
            onClick={onAutoSend}
            className="p-3 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors flex-shrink-0 relative group border-2 border-green-500"
            type="button"
            title="Auto-transcribe and send (Enter)"
          >
            <Send size={20} />
            <div className="absolute -top-1 -right-1 bg-black/80 text-white px-1 py-0.5 rounded text-[10px] opacity-75 group-hover:opacity-100 transition-opacity">
              ↵
            </div>
          </button>
        </>
      ) : (
        // Normal send button
        <button
          onClick={handleSubmit}
          disabled={disabled || !localInput.trim()}
          className="p-3 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0 border-2 border-green-500"
          type="button"
        >
          <Send size={20} />
        </button>
      )}
    </div>
  );
}));

IsolatedInput.displayName = 'IsolatedInput';

export default IsolatedInput;