'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { Mic, Square, X, Send, Eye, Loader2, AlertCircle, GripHorizontal } from 'lucide-react';
import WaveSurfer from 'wavesurfer.js';
import RecordPlugin from 'wavesurfer.js/dist/plugins/record.esm.js';

interface FloatingWorkbenchProps {
  activeSessionId: string;
  onSendMessage: (message: string, sessionId: string) => void;
}

interface TimelineVisualizerProps {
  isRecording: boolean;
}

const TimelineVisualizer: React.FC<TimelineVisualizerProps> = ({ isRecording }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const recordPluginRef = useRef<any>(null);

  // Expose record plugin to parent component
  useEffect(() => {
    if (recordPluginRef.current) {
      (window as any).hollerRecordPlugin = recordPluginRef.current;
      
      // Listen for record-end event to store the blob
      recordPluginRef.current.on('record-end', (blob: Blob) => {
        // Recording ended, blob received
        (window as any).hollerRecordedBlob = blob;
      });
    }
  }, [recordPluginRef.current]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize WaveSurfer with golden theme
    const waveSurfer = WaveSurfer.create({
      container: containerRef.current,
      height: 40,
      waveColor: '#ffd700',
      progressColor: '#d4af37',
      backgroundColor: 'transparent',
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize: true,
    });

    // Add record plugin
    const recordPlugin = waveSurfer.registerPlugin(RecordPlugin.create({
      scrollingWaveform: true,
      renderRecordedAudio: true,
    }));

    waveSurferRef.current = waveSurfer;
    recordPluginRef.current = recordPlugin;

    return () => {
      waveSurfer.destroy();
    };
  }, []);

  useEffect(() => {
    if (!recordPluginRef.current) return;

    if (isRecording) {
      recordPluginRef.current.startRecording();
    } else {
      if (recordPluginRef.current.isRecording()) {
        recordPluginRef.current.stopRecording();
      }
    }
  }, [isRecording]);

  return (
    <div className="w-full" ref={containerRef} style={{ minHeight: '40px' }} />
  );
};

export default function FloatingWorkbench({ activeSessionId, onSendMessage }: FloatingWorkbenchProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [showTextPreview, setShowTextPreview] = useState(false);
  const [error, setError] = useState('');
  const [capturedSessionId, setCapturedSessionId] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const dragControls = useDragControls();

  const startRecording = useCallback(async () => {
    try {
      // Start MediaRecorder for actual audio capture
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      
      streamRef.current = stream;

      const options: MediaRecorderOptions = {};
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options.mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options.mimeType = 'audio/mp4';
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setError('');
      // Don't clear preview or text when starting a new recording
    } catch (err) {
      // Error starting recording
      setError('Failed to access microphone');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    setIsRecording(false);
  }, []);

  const cancelRecording = useCallback(() => {
    stopRecording();
    audioChunksRef.current = [];
    setError('');
    // Note: Keep transcribedText and showTextPreview as-is (don't clear existing message)
  }, [stopRecording]);

  const transcribeAudio = useCallback(async (audioBlob: Blob): Promise<string> => {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.webm');

    const response = await fetch('/api/sessions/transcribe', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Transcription failed');
    }

    const result = await response.json();
    return result.transcript;
  }, []);

  const handleTranscribe = useCallback(async () => {
    if (audioChunksRef.current.length === 0) return;

    setCapturedSessionId(activeSessionId);
    stopRecording();
    setIsTranscribing(true);

    try {
      const audioBlob = new Blob(audioChunksRef.current, { 
        type: mediaRecorderRef.current?.mimeType || 'audio/webm' 
      });
      
      const transcript = await transcribeAudio(audioBlob);
      
      // Concatenate with existing text if preview is already open
      const newText = transcribedText 
        ? `${transcribedText} ${transcript}` 
        : transcript;
      
      setTranscribedText(newText);
      setShowTextPreview(true);
      setError('');
      
      // Clear this recording's audio chunks (ready for next recording)
      audioChunksRef.current = [];
    } catch (err) {
      // Transcription error
      setError(err instanceof Error ? err.message : 'Transcription failed');
      setShowTextPreview(true);
    } finally {
      setIsTranscribing(false);
    }
  }, [activeSessionId, stopRecording, transcribeAudio, transcribedText]);

  const handleDirectSend = useCallback(async () => {
    if (audioChunksRef.current.length === 0 && !transcribedText) return;

    const sessionIdToUse = activeSessionId;
    setCapturedSessionId(sessionIdToUse);
    stopRecording();
    setIsTranscribing(true);

    try {
      let finalMessage = transcribedText || '';

      // If there's a current recording, transcribe and concatenate it
      if (audioChunksRef.current.length > 0) {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mediaRecorderRef.current?.mimeType || 'audio/webm' 
        });
        
        const transcript = await transcribeAudio(audioBlob);
        finalMessage = finalMessage 
          ? `${finalMessage} ${transcript}` 
          : transcript;
      }
      
      if (finalMessage && sessionIdToUse) {
        onSendMessage(finalMessage, sessionIdToUse);
      }
      
      // Reset ALL state (clear everything)
      setTranscribedText('');
      setShowTextPreview(false);
      setError('');
      audioChunksRef.current = [];
    } catch (err) {
      // Direct send error
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setShowTextPreview(true);
    } finally {
      setIsTranscribing(false);
    }
  }, [activeSessionId, stopRecording, transcribeAudio, onSendMessage, transcribedText]);

  const handleSendTranscribed = useCallback(() => {
    if (transcribedText && capturedSessionId) {
      onSendMessage(transcribedText, capturedSessionId);
      
      // Reset state
      setTranscribedText('');
      setShowTextPreview(false);
      setError('');
      audioChunksRef.current = [];
      setCapturedSessionId('');
    }
  }, [transcribedText, capturedSessionId, onSendMessage]);



  return (
    <>
      {/* Floating Workbench */}
      <motion.div
        drag
        dragControls={dragControls}
        dragMomentum={false}
        className="fixed z-50"
        style={{ left: 20, top: 80 }}
        whileDrag={{ scale: 1.02 }}
        dragConstraints={false}
        onDragStart={() => setIsDragging(true)}
        onDragEnd={() => setIsDragging(false)}
      >
        <div className="relative min-w-48 rounded-lg" style={{
          background: 'linear-gradient(145deg, #8b6f47 0%, #6d5635 100%)',
          border: '2px dashed #f5f5dc',
          borderRadius: '12px',
          boxShadow: `
            0 0 0 3px #8b6f47,
            0 0 0 5px rgba(0,0,0,0.1),
            2px 2px 8px 3px rgba(0,0,0,0.4),
            inset 0 0 15px rgba(0,0,0,0.2)
          `,
          padding: '16px',
          backgroundImage: `
            repeating-linear-gradient(
              45deg,
              transparent,
              transparent 2px,
              rgba(0,0,0,.1) 2px,
              rgba(0,0,0,.1) 4px
            )
          `
        }}>
          {/* Leather Toolbelt Drag Handle */}
          <div 
            onPointerDown={(e) => {
              setIsDragging(false);
              dragControls.start(e);
            }}
            onPointerUp={() => {
              // Only toggle minimize if we didn't actually drag
              setTimeout(() => {
                if (!isDragging) {
                  setIsMinimized(!isMinimized);
                }
              }, 10);
            }}
            className="flex items-center gap-2 mb-3 p-3 cursor-move rounded"
            style={{
              background: 'linear-gradient(145deg, #654321 0%, #4a2c17 100%)',
              border: '2px dashed #d2b48c',
              boxShadow: 'inset 0 0 8px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.2)',
              color: '#f5f5dc',
              textShadow: '1px 1px 2px rgba(0,0,0,0.7)'
            }}
          >
            <GripHorizontal className="w-4 h-4" style={{ color: '#d2b48c' }} />
            <span className="text-xs font-bold tracking-wide">🤠 TOOLBELT</span>
          </div>

          {/* Audio Visualizer */}
          {!isMinimized && isRecording && (
            <div className="mb-3 p-3 rounded" style={{
              background: 'linear-gradient(145deg, #4a2c17 0%, #3d1f0f 100%)',
              border: '2px dashed #d2b48c',
              boxShadow: 'inset 0 0 8px rgba(0,0,0,0.4)'
            }}>
              <div className="space-y-2">
                <div className="text-xs" style={{ 
                  color: '#f5f5dc', 
                  textShadow: '1px 1px 2px rgba(0,0,0,0.7)',
                  fontWeight: 'bold'
                }}>🎙️ RECORDING...</div>
                <TimelineVisualizer isRecording={isRecording} />
              </div>
            </div>
          )}

          {/* Tool Buttons - Hidden when minimized */}
          {!isMinimized && (
            <div className="flex flex-col gap-3">
              {!isRecording ? (
              /* Single Record Button - Leather Tool Style */
              <button
                onClick={startRecording}
                disabled={isTranscribing}
                className="p-4 rounded-lg transition-all flex flex-col items-center gap-2 cursor-pointer
                         disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(145deg, #a0522d 0%, #8b4513 100%)',
                  border: '2px dashed #f5f5dc',
                  boxShadow: `
                    0 0 0 2px #a0522d,
                    0 0 0 4px rgba(0,0,0,0.1),
                    2px 2px 6px 2px rgba(0,0,0,0.3),
                    inset 0 0 10px rgba(0,0,0,0.2)
                  `,
                  color: '#f5f5dc',
                  textShadow: '2px 2px 4px rgba(0,0,0,0.8)'
                }}
              >
                <Mic className="w-6 h-6" />
                <span className="text-sm font-bold tracking-wide">🎤 RECORD</span>
              </button>
            ) : (
              /* Three Leather Tool Buttons During Recording */
              <div className="grid grid-cols-3 gap-3">
                {/* Cancel Button - Red Leather */}
                <button
                  onClick={cancelRecording}
                  className="p-3 rounded-lg transition-all flex flex-col items-center gap-1 cursor-pointer"
                  style={{
                    background: 'linear-gradient(145deg, #8b4444 0%, #654545 100%)',
                    border: '2px dashed #f5f5dc',
                    boxShadow: `
                      0 0 0 2px #8b4444,
                      0 0 0 4px rgba(0,0,0,0.1),
                      2px 2px 6px 2px rgba(0,0,0,0.3),
                      inset 0 0 10px rgba(0,0,0,0.2)
                    `,
                    color: '#f5f5dc',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.7)'
                  }}
                >
                  <X className="w-4 h-4" />
                  <span className="text-xs font-bold">CANCEL</span>
                </button>

                {/* Preview Button - Blue Leather */}
                <button
                  onClick={handleTranscribe}
                  disabled={isTranscribing}
                  className="p-3 rounded-lg transition-all flex flex-col items-center gap-1 cursor-pointer
                           disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(145deg, #4a4a8b 0%, #454565 100%)',
                    border: '2px dashed #f5f5dc',
                    boxShadow: `
                      0 0 0 2px #4a4a8b,
                      0 0 0 4px rgba(0,0,0,0.1),
                      2px 2px 6px 2px rgba(0,0,0,0.3),
                      inset 0 0 10px rgba(0,0,0,0.2)
                    `,
                    color: '#f5f5dc',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.7)'
                  }}
                >
                  {isTranscribing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                  <span className="text-xs font-bold">PREVIEW</span>
                </button>

                {/* Send Button - Green Leather */}
                <button
                  onClick={handleDirectSend}
                  disabled={isTranscribing}
                  className="p-3 rounded-lg transition-all flex flex-col items-center gap-1 cursor-pointer
                           disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(145deg, #4a8b4a 0%, #456545 100%)',
                    border: '2px dashed #f5f5dc',
                    boxShadow: `
                      0 0 0 2px #4a8b4a,
                      0 0 0 4px rgba(0,0,0,0.1),
                      2px 2px 6px 2px rgba(0,0,0,0.3),
                      inset 0 0 10px rgba(0,0,0,0.2)
                    `,
                    color: '#f5f5dc',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.7)'
                  }}
                >
                  <Send className="w-4 h-4" />
                  <span className="text-xs font-bold">SEND</span>
                </button>
              </div>
            )}
            </div>
          )}

        </div>


        {/* Text Preview To The Side */}
        {showTextPreview && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute left-full ml-4 top-0 w-80"
          >
              <div className="rounded-lg p-4" style={{
                background: error ? 
                  'linear-gradient(145deg, #8b4444 0%, #654545 100%)' :
                  'linear-gradient(145deg, #4a2c17 0%, #3d1f0f 100%)',
                border: '2px dashed #f5f5dc',
                boxShadow: `
                  0 0 0 2px ${error ? '#8b4444' : '#4a2c17'},
                  inset 0 0 10px rgba(0,0,0,0.3)
                `
              }}>
                {error ? (
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 mt-0.5" style={{ color: '#f5f5dc' }} />
                    <div className="flex-1">
                      <p className="font-bold text-xs" style={{ 
                        color: '#f5f5dc', 
                        textShadow: '1px 1px 2px rgba(0,0,0,0.7)' 
                      }}>TRANSCRIPTION ERROR</p>
                      <p className="text-xs mt-1" style={{ 
                        color: '#f5f5dc', 
                        textShadow: '1px 1px 2px rgba(0,0,0,0.7)' 
                      }}>{error}</p>
                    </div>
                    <button
                      onClick={() => {
                        setShowTextPreview(false);
                        setError('');
                      }}
                      className="transition-colors"
                      style={{ color: '#f5f5dc' }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-bold tracking-wide" style={{ 
                        color: '#f5f5dc', 
                        textShadow: '1px 1px 2px rgba(0,0,0,0.7)' 
                      }}>📝 YOUR MESSAGE</h3>
                      <button
                        onClick={() => {
                          setShowTextPreview(false);
                          setTranscribedText('');
                        }}
                        className="transition-colors"
                        style={{ color: '#f5f5dc' }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <textarea
                      value={transcribedText}
                      onChange={(e) => setTranscribedText(e.target.value)}
                      className="w-full h-32 p-3 rounded-md resize-none transition-all"
                      style={{
                        background: 'linear-gradient(145deg, #3d1f0f 0%, #2a1509 100%)',
                        border: '1px dashed #d2b48c',
                        color: '#f5f5dc',
                        textShadow: '1px 1px 2px rgba(0,0,0,0.7)',
                        boxShadow: 'inset 0 0 8px rgba(0,0,0,0.4)',
                        outline: 'none'
                      }}
                      placeholder="Your transcribed message appears here..."
                    />
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={handleSendTranscribed}
                        disabled={!transcribedText.trim()}
                        className="flex-1 px-4 py-2 rounded-lg transition-all flex items-center justify-center gap-2
                                 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{
                          background: 'linear-gradient(145deg, #4a8b4a 0%, #456545 100%)',
                          border: '2px dashed #f5f5dc',
                          boxShadow: `
                            0 0 0 2px #4a8b4a,
                            2px 2px 6px 2px rgba(0,0,0,0.3),
                            inset 0 0 8px rgba(0,0,0,0.2)
                          `,
                          color: '#f5f5dc',
                          textShadow: '1px 1px 2px rgba(0,0,0,0.7)'
                        }}
                      >
                        <Send className="w-4 h-4" />
                        <span className="font-bold text-sm">SEND MESSAGE</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
      </motion.div>
    </>
  );
}