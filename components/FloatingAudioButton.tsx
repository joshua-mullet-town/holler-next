'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, useDragControls } from 'framer-motion';
import { Mic, Square, X, Send, Eye, Loader2, AlertCircle } from 'lucide-react';

interface FloatingAudioButtonProps {
  activeSessionId: string;
  onSendMessage: (message: string, sessionId: string) => void;
}

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ analyser }) => {
  const [volumeLevel, setVolumeLevel] = useState(0);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (!analyser) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateVolume = () => {
      animationRef.current = requestAnimationFrame(updateVolume);
      analyser.getByteFrequencyData(dataArray);
      
      // Calculate average volume level
      const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
      setVolumeLevel(average / 255 * 100);
    };

    updateVolume();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser]);

  return (
    <div className="absolute bottom-full mb-2 flex items-end gap-1 px-2">
      {[1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className="w-1 bg-amber-400/70 rounded-full"
          animate={{
            height: Math.max(4, (volumeLevel / 100) * (16 + i * 4))
          }}
          transition={{
            duration: 0.1,
            ease: "easeOut"
          }}
        />
      ))}
    </div>
  );
};

export default function FloatingAudioButton({ activeSessionId, onSendMessage }: FloatingAudioButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [showTextPreview, setShowTextPreview] = useState(false);
  const [showActionButtons, setShowActionButtons] = useState(false);
  const [error, setError] = useState('');
  const [capturedSessionId, setCapturedSessionId] = useState('');
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const dragControls = useDragControls();

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      
      streamRef.current = stream;

      // Set up audio visualization
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      // Set up MediaRecorder
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

      mediaRecorder.start(100); // Collect data every 100ms
      setIsRecording(true);
      setError('');
      setShowTextPreview(false);
      setTranscribedText('');
    } catch (err) {
      console.error('Error starting recording:', err);
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
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    
    setIsRecording(false);
    setShowActionButtons(true);
    analyserRef.current = null;
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    
    setIsRecording(false);
    setShowActionButtons(false);
    audioChunksRef.current = [];
    setError('');
    setTranscribedText('');
    setShowTextPreview(false);
    analyserRef.current = null;
  }, []);

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

    // Capture the active session ID at the moment of clicking transcribe
    setCapturedSessionId(activeSessionId);
    stopRecording();
    setIsTranscribing(true);

    try {
      const audioBlob = new Blob(audioChunksRef.current, { 
        type: mediaRecorderRef.current?.mimeType || 'audio/webm' 
      });
      
      const transcript = await transcribeAudio(audioBlob);
      setTranscribedText(transcript);
      setShowTextPreview(true);
      setError('');
    } catch (err) {
      console.error('Transcription error:', err);
      setError(err instanceof Error ? err.message : 'Transcription failed');
      setShowTextPreview(true);
    } finally {
      setIsTranscribing(false);
    }
  }, [activeSessionId, stopRecording, transcribeAudio]);

  const handleDirectSend = useCallback(async () => {
    if (audioChunksRef.current.length === 0) return;

    // Capture the active session ID at the moment of clicking send
    const sessionIdToUse = activeSessionId;
    setCapturedSessionId(sessionIdToUse);
    stopRecording();
    setIsTranscribing(true);

    try {
      const audioBlob = new Blob(audioChunksRef.current, { 
        type: mediaRecorderRef.current?.mimeType || 'audio/webm' 
      });
      
      const transcript = await transcribeAudio(audioBlob);
      
      // Send immediately without showing preview
      if (transcript && sessionIdToUse) {
        onSendMessage(transcript, sessionIdToUse);
      }
      
      // Reset state
      setTranscribedText('');
      setShowTextPreview(false);
      setShowActionButtons(false);
      setError('');
      audioChunksRef.current = [];
    } catch (err) {
      console.error('Direct send error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setShowTextPreview(true);
    } finally {
      setIsTranscribing(false);
    }
  }, [activeSessionId, stopRecording, transcribeAudio, onSendMessage]);

  const handleSendTranscribed = useCallback(() => {
    if (transcribedText && capturedSessionId) {
      onSendMessage(transcribedText, capturedSessionId);
      
      // Reset state
      setTranscribedText('');
      setShowTextPreview(false);
      setShowActionButtons(false);
      setError('');
      audioChunksRef.current = [];
      setCapturedSessionId('');
    }
  }, [transcribedText, capturedSessionId, onSendMessage]);

  return (
    <>
      <motion.div
        drag
        dragControls={dragControls}
        dragMomentum={false}
        initial={{ x: 20, y: -100 }}
        className="fixed z-50 bottom-20 left-4"
        whileDrag={{ scale: 1.1 }}
        dragConstraints={{
          left: 0,
          right: typeof window !== 'undefined' ? window.innerWidth - 100 : 1000,
          top: 0,
          bottom: typeof window !== 'undefined' ? window.innerHeight - 100 : 800
        }}
      >
        <div className="relative">
          {/* Audio Visualizer */}
          {isRecording && <AudioVisualizer analyser={analyserRef.current} />}
          
          {/* Main Button */}
          <motion.button
            onPointerDown={(e) => dragControls.start(e)}
            onClick={
              isRecording ? stopRecording :
              !isTranscribing && !showTextPreview ? startRecording : 
              undefined
            }
            className={`
              w-16 h-16 rounded-full shadow-lg flex items-center justify-center
              transition-all duration-200 cursor-move
              ${isRecording ? 'bg-red-500 hover:bg-red-600' : 
                isTranscribing ? 'bg-blue-500' :
                showTextPreview ? 'bg-green-500 hover:bg-green-600' :
                'bg-indigo-500 hover:bg-indigo-600'}
            `}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {isRecording ? (
              <Square className="w-6 h-6 text-white" />
            ) : isTranscribing ? (
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            ) : showTextPreview ? (
              <Eye className="w-6 h-6 text-white" />
            ) : (
              <Mic className="w-6 h-6 text-white" />
            )}
          </motion.button>

          {/* Action Buttons */}
          {showActionButtons && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="absolute left-20 top-0 flex gap-2"
            >
              <button
                onClick={cancelRecording}
                className="w-12 h-12 rounded-full bg-gray-600 hover:bg-gray-700 
                         flex items-center justify-center shadow-md transition-colors"
                title="Cancel"
              >
                <X className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={handleTranscribe}
                className="w-12 h-12 rounded-full bg-blue-500 hover:bg-blue-600 
                         flex items-center justify-center shadow-md transition-colors"
                title="Transcribe"
              >
                <Eye className="w-5 h-5 text-white" />
              </button>
              <button
                onClick={handleDirectSend}
                className="w-12 h-12 rounded-full bg-green-500 hover:bg-green-600 
                         flex items-center justify-center shadow-md transition-colors"
                title="Send"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>

      {/* Text Preview Modal */}
      {showTextPreview && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50"
        >
          <div className={`rounded-lg shadow-xl p-4 ${error ? 'bg-red-50 border-2 border-red-300' : 'bg-white'}`}>
            {error ? (
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-red-700 font-medium">Transcription Error</p>
                  <p className="text-red-600 text-sm mt-1">{error}</p>
                </div>
                <button
                  onClick={() => {
                    setShowTextPreview(false);
                    setError('');
                  }}
                  className="text-red-400 hover:text-red-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-700">Transcribed Text</h3>
                  <button
                    onClick={() => {
                      setShowTextPreview(false);
                      setTranscribedText('');
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <textarea
                  value={transcribedText}
                  onChange={(e) => setTranscribedText(e.target.value)}
                  className="w-full h-24 p-2 border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Transcribed text will appear here..."
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={handleSendTranscribed}
                    disabled={!transcribedText.trim()}
                    className="flex-1 px-4 py-2 bg-indigo-500 text-white rounded-md 
                             hover:bg-indigo-600 disabled:bg-gray-300 disabled:cursor-not-allowed
                             transition-colors flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </>
  );
}