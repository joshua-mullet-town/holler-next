'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import HollerSessionManager from '../components/HollerSessionManager';

export default function HollerTerminal() {
  const [isHydrated, setIsHydrated] = useState(false);
  const [globalSocket, setGlobalSocket] = useState<Socket | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  
  // Initialize global socket connection once
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    console.log('🌐 Initializing global socket connection');
    const socket = io();
    
    socket.on('connect', () => {
      console.log('🔌 Global socket connected');
      setIsSocketConnected(true);
    });
    
    socket.on('disconnect', () => {
      console.log('🔌 Global socket disconnected');
      setIsSocketConnected(false);
    });
    
    setGlobalSocket(socket);
    setIsHydrated(true);
    
    return () => {
      console.log('🧹 Cleaning up global socket');
      socket.disconnect();
    };
  }, []);

  // Prevent hydration mismatches
  if (!isHydrated) {
    return <div className="min-h-screen bg-gradient-to-br from-orange-400 via-yellow-500 to-orange-600" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-400 via-yellow-500 to-orange-600">
      {/* Western sky background with animated clouds */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div 
          className="absolute top-20 left-1/4 w-32 h-8 bg-white/20 rounded-full blur-sm"
          animate={{ x: [0, 100, 0] }}
          transition={{ duration: 20, repeat: Infinity }}
        />
        <motion.div 
          className="absolute top-32 right-1/3 w-24 h-6 bg-white/15 rounded-full blur-sm"
          animate={{ x: [0, -80, 0] }}
          transition={{ duration: 15, repeat: Infinity }}
        />
      </div>

      <div className="relative z-10 flex flex-col h-screen">
        {/* Header */}
        <header className="flex items-center justify-between p-6 text-black">
          <div className="flex items-center space-x-3">
            <div className="text-4xl font-bold">🤠</div>
            <div>
              <h1 className="text-3xl font-bold font-mono">The Holler</h1>
              <p className="text-sm opacity-75">VS Code Terminal</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <a 
              href="https://www.hulu.com/series/fdeb1018-4472-442f-ba94-fb087cdea069"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white px-3 py-3 rounded-lg font-semibold flex items-center justify-center transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl"
              title="Watch Bob's Burgers on Hulu"
            >
              <img 
                src="/tina.png" 
                alt="Tina Belcher" 
                className="w-8 h-8" 
              />
            </a>
          </div>
        </header>

        {/* Main terminal area */}
        <div className="flex-1 bg-black/20 backdrop-blur-md border border-white/30 mx-6 mb-6 rounded-lg" style={{ overflow: 'visible' }}>
          {!isSocketConnected ? (
            <div className="flex items-center justify-center h-full text-white">
              <div className="text-center">
                <div className="animate-spin text-4xl mb-4">🤠</div>
                <p className="text-xl">Connecting to Holler Terminal Server...</p>
              </div>
            </div>
          ) : (
            <HollerSessionManager />
          )}
        </div>
      </div>
    </div>
  );
}