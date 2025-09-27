'use client';

import { motion } from 'framer-motion';

interface OperationalMetadataProps {
  contextRemaining?: number;
  permissionsBypass?: boolean;
}

const OperationalMetadata: React.FC<OperationalMetadataProps> = ({ 
  contextRemaining, 
  permissionsBypass 
}) => {
  if (!contextRemaining && !permissionsBypass) return null;

  return (
    <div className="absolute top-1/2 -translate-y-1/2 right-10 flex flex-col gap-0.5">
      {/* Context Remaining Indicator - Only show when actually low (meaningful) */}
      {contextRemaining !== undefined && contextRemaining < 100 && (
        <div className={`
          px-1.5 py-0.5 rounded text-xs font-mono text-white
          ${contextRemaining < 20 
            ? 'bg-red-500/80' // Critical - red
            : contextRemaining < 50 
            ? 'bg-yellow-500/80' // Warning - yellow
            : 'bg-green-500/80' // Good - green
          }
        `}>
          {contextRemaining}%
        </div>
      )}
      
      {/* Permissions Bypass Indicator */}
      {permissionsBypass && (
        <motion.div 
          className="px-1.5 py-0.5 bg-orange-500/80 text-white rounded text-xs font-mono"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          title="--dangerously-skip-permissions active"
        >
          🚫
        </motion.div>
      )}
    </div>
  );
};

export default OperationalMetadata;