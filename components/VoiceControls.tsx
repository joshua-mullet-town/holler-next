'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Mic, Square, X } from 'lucide-react';

interface VoiceControlsProps {
  isRecordingVoice: boolean;
  isTranscribing: boolean;
  hasActiveSession: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onCancelRecording: () => void;
  onTranscribeOnly: () => void;
}

const VoiceControls: React.FC<VoiceControlsProps> = ({
  isRecordingVoice,
  isTranscribing,
  hasActiveSession,
  onStartRecording,
  onStopRecording,
  onCancelRecording,
  onTranscribeOnly
}) => {
  if (isTranscribing) {
    return (
      <div className="p-3 rounded-xl bg-blue-100 border-2 border-blue-300 text-blue-600">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold">Transcribing...</span>
        </div>
      </div>
    );
  }

  if (isRecordingVoice) {
    // Don't show mic button during recording - input being disabled is visual indication enough
    return null;
  }

  return (
    <motion.button
      onClick={onStartRecording}
      className="p-3 rounded-xl border-2 bg-orange-500 border-orange-500 text-white hover:bg-orange-600 transition-all relative group"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      title={hasActiveSession ? "Start recording (M)" : "Start recording (creates new session)"}
    >
      <Mic size={20} />
      <div className="absolute -top-1 -right-1 bg-black/80 text-white px-1 py-0.5 rounded text-[10px] opacity-75 group-hover:opacity-100 transition-opacity">
        M
      </div>
    </motion.button>
  );
};

export default VoiceControls;