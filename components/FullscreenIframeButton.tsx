'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FullscreenIframeButtonProps {
  url: string;
  buttonText?: string;
  className?: string;
}

export default function FullscreenIframeButton({ 
  url, 
  buttonText = "Open Fullscreen",
  className = ""
}: FullscreenIframeButtonProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <>
      {/* Button */}
      <motion.button
        onClick={toggleExpanded}
        className={`
          px-4 py-2 bg-gradient-to-r from-orange-500 to-yellow-500 
          text-white font-semibold rounded-lg shadow-lg hover:shadow-xl 
          transition-all duration-200 hover:scale-105 active:scale-95
          ${className}
        `}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {isExpanded ? '🔙 Close' : '📺 ' + buttonText}
      </motion.button>

      {/* Fullscreen Overlay */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 bg-black"
          >
            {/* Close button in overlay */}
            <motion.button
              onClick={toggleExpanded}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="
                absolute top-4 right-4 z-60 px-6 py-3 bg-red-600 hover:bg-red-700 
                text-white font-semibold rounded-full shadow-xl transition-all duration-200
                hover:scale-105 active:scale-95
              "
            >
              ✕ Close
            </motion.button>

            {/* Iframe container */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ 
                duration: 0.5, 
                ease: [0.25, 0.46, 0.45, 0.94] // Custom easing for smooth feel
              }}
              className="w-full h-full"
            >
              <iframe
                src={url}
                className="w-full h-full border-none"
                allow="autoplay; encrypted-media; fullscreen"
                allowFullScreen
                title="Fullscreen Content"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}