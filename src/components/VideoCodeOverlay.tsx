import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface VideoCodeOverlayProps {
  code: string
  isVisible: boolean
  onCodeShown: () => void
}

const VideoCodeOverlay: React.FC<VideoCodeOverlayProps> = ({
  code,
  isVisible,
  onCodeShown
}) => {
  const [showCode, setShowCode] = useState(false)

  useEffect(() => {
    if (isVisible && !showCode) {
      // Show code after a short delay to simulate it appearing in video
      const timer = setTimeout(() => {
        setShowCode(true)
        onCodeShown()
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isVisible, showCode, onCodeShown])

  if (!isVisible) return null

  return (
    <AnimatePresence>
      {showCode && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50"
        >
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-lg p-6 shadow-2xl border-4 border-blue-500"
          >
            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-800 mb-2">
                🎯 Video Code
              </h3>
              <div className="bg-blue-100 border-2 border-blue-300 rounded-lg p-4 mb-3">
                <span className="text-2xl font-mono font-bold text-blue-800 tracking-wider">
                  {code}
                </span>
              </div>
              <p className="text-sm text-gray-600">
                Remember this code to claim your reward!
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default VideoCodeOverlay
