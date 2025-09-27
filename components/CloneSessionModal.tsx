'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, X } from 'lucide-react';

interface CloneSessionModalProps {
  isOpen: boolean;
  originalSessionName: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
  isCloning?: boolean;
}

const CloneSessionModal: React.FC<CloneSessionModalProps> = ({
  isOpen,
  originalSessionName,
  onConfirm,
  onCancel,
  isCloning = false
}) => {
  const [sessionName, setSessionName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSessionName(`${originalSessionName} (Copy)`);
      // Focus the input after the modal animation
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 150);
    }
  }, [isOpen, originalSessionName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (sessionName.trim() && !isCloning) {
      onConfirm(sessionName.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 p-8 max-w-md w-full mx-4 shadow-2xl"
          onKeyDown={handleKeyDown}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <Copy className="text-white" size={24} />
              <h2 className="text-xl font-bold text-white">Clone Session</h2>
            </div>
            <button
              onClick={onCancel}
              className="text-white/60 hover:text-white transition-colors"
              disabled={isCloning}
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-white/80 text-sm font-medium mb-2">
                Session Name
              </label>
              <input
                ref={inputRef}
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Enter session name"
                disabled={isCloning}
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={!sessionName.trim() || isCloning}
                className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-lg font-medium transition-all ${
                  isCloning
                    ? 'bg-orange-500/50 cursor-not-allowed'
                    : 'bg-orange-500 hover:bg-orange-600 hover:scale-105'
                } text-white`}
              >
                {isCloning ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    <span>Cloning...</span>
                  </>
                ) : (
                  <>
                    <Copy size={16} />
                    <span>Clone Session</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={onCancel}
                disabled={isCloning}
                className="px-6 py-3 text-white/80 hover:text-white transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>

          <p className="text-white/60 text-xs mt-4">
            This will create a new session with the conversation history from "{originalSessionName}".
          </p>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default CloneSessionModal;