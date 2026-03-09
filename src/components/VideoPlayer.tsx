import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, Volume2, VolumeX, CheckCircle, X, Eye, AlertCircle, Youtube, Key, EyeOff, Eye as EyeIcon } from 'lucide-react'
import { extractYouTubeId } from '../config/videos'
import VideoCodeOverlay from './VideoCodeOverlay'
import { apiService } from '../services/api'

interface VideoPlayerProps {
  videoUrl: string
  videoId: string
  onVideoComplete: (videoId: string) => void
  onClose: () => void
  isOpen: boolean
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  videoId,
  onVideoComplete,
  onClose,
  isOpen
}) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [hasWatchedEnough, setHasWatchedEnough] = useState(false)
  const [showRewardButton, setShowRewardButton] = useState(false)
  const [watchProgress, setWatchProgress] = useState(0)
  const [videoError, setVideoError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isYouTube, setIsYouTube] = useState(false)
  const [youtubeVideoId, setYoutubeVideoId] = useState('')
  
  // Code verification states
  const [showCodeInput, setShowCodeInput] = useState(false)
  const [enteredCode, setEnteredCode] = useState('')
  const [codeError, setCodeError] = useState('')
  const [isCodeCorrect, setIsCodeCorrect] = useState(false)
  const [showCodeHint, setShowCodeHint] = useState(false)
  const [showCodeOverlay, setShowCodeOverlay] = useState(false)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const progressInterval = useRef<NodeJS.Timeout | null>(null)
  const codeInputRef = useRef<HTMLInputElement>(null)
  
  // Minimum watch time required (80% of video duration)
  const MIN_WATCH_PERCENTAGE = 0.8
  const MIN_WATCH_TIME = duration * MIN_WATCH_PERCENTAGE

  // Video code state
  const [currentVideoCode, setCurrentVideoCode] = useState({
    code: 'TAP2024',
    hint: 'Look for the code that appears in the video',
    timeToShow: 0.5,
    points: 100
  })

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true)
      setVideoError(false)
      setHasWatchedEnough(false)
      setShowRewardButton(false)
      setWatchProgress(0)
      setCurrentTime(0)
      setShowCodeInput(false)
      setEnteredCode('')
      setCodeError('')
      setIsCodeCorrect(false)
      setShowCodeHint(false)
      setShowCodeOverlay(false)
      
      // Fetch video code from database
      const fetchVideoCode = async () => {
        try {
          const videoCode = await apiService.getVideoCode(videoId)
          setCurrentVideoCode({
            code: videoCode.code,
            hint: videoCode.hint,
            timeToShow: videoCode.timeToShow,
            points: videoCode.points
          })
        } catch (error) {
          console.error('Failed to fetch video code:', error)
          // Use default values if fetch fails
        }
      }
      
      fetchVideoCode()
      
      // Check if it's a YouTube URL
      const ytId = extractYouTubeId(videoUrl)
      if (ytId) {
        setIsYouTube(true)
        setYoutubeVideoId(ytId)
        setIsLoading(false)
        // For YouTube, we'll simulate progress since we can't track iframe events
        startYouTubeSimulation()
      } else {
        setIsYouTube(false)
        if (videoRef.current) {
          videoRef.current.load()
        }
      }
    }
  }, [isOpen, videoUrl, videoId])

  const startYouTubeSimulation = () => {
    // Simulate YouTube video watching progress
    let progress = 0
    const interval = setInterval(() => {
      progress += 0.005 // Increment slowly to simulate real watching
      setWatchProgress(progress)
      setCurrentTime(progress * 60) // Assume 60 second video
      setDuration(60)
      
      // Show code input at specified time
      if (progress >= currentVideoCode?.timeToShow && !showCodeInput) {
        setShowCodeInput(true)
        setShowCodeHint(true)
        setShowCodeOverlay(true)
        setTimeout(() => setShowCodeHint(false), 5000) // Hide hint after 5 seconds
      }
      
      if (progress >= MIN_WATCH_PERCENTAGE && !hasWatchedEnough) {
        setHasWatchedEnough(true)
        // Only show reward button if code is correct
        if (isCodeCorrect) {
          setShowRewardButton(true)
        }
      }
    }, 100)
  }

  useEffect(() => {
    if (isPlaying && !isYouTube) {
      progressInterval.current = setInterval(() => {
        if (videoRef.current) {
          const current = videoRef.current.currentTime
          const total = videoRef.current.duration
          setCurrentTime(current)
          setDuration(total)
          
          const progress = current / total
          setWatchProgress(progress)
          
          // Show code input at specified time
          if (progress >= currentVideoCode?.timeToShow && !showCodeInput) {
            setShowCodeInput(true)
            setShowCodeHint(true)
            setShowCodeOverlay(true)
            setTimeout(() => setShowCodeHint(false), 5000) // Hide hint after 5 seconds
          }
          
          // Check if user has watched enough
          if (progress >= MIN_WATCH_PERCENTAGE && !hasWatchedEnough) {
            setHasWatchedEnough(true)
            // Only show reward button if code is correct
            if (isCodeCorrect) {
              setShowRewardButton(true)
            }
          }
        }
      }, 100)
    } else {
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
      }
    }

    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current)
      }
    }
  }, [isPlaying, hasWatchedEnough, isYouTube, showCodeInput, isCodeCorrect])

  const handlePlayPause = () => {
    if (isYouTube) {
      // For YouTube, toggle play state and start/stop simulation
      setIsPlaying(!isPlaying)
      if (!isPlaying) {
        startYouTubeSimulation()
      }
    } else if (videoRef.current && !videoError) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleMuteToggle = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted
      setIsMuted(!isMuted)
    }
  }

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
      setDuration(videoRef.current.duration)
    }
  }

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration)
      setIsLoading(false)
    }
  }

  const handleVideoError = () => {
    setVideoError(true)
    setIsLoading(false)
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekTime = parseFloat(e.target.value)
    if (videoRef.current && !videoError) {
      videoRef.current.currentTime = seekTime
      setCurrentTime(seekTime)
    }
  }

  const handleCodeSubmit = async () => {
    try {
      const result = await apiService.verifyVideoCode(videoId, enteredCode)
      if (result.isCorrect) {
        setIsCodeCorrect(true)
        setCodeError('')
        // If user has watched enough, show reward button
        if (hasWatchedEnough) {
          setShowRewardButton(true)
        }
      } else {
        setCodeError('Incorrect code. Please try again.')
        setIsCodeCorrect(false)
        setShowRewardButton(false)
      }
    } catch (error) {
      console.error('Failed to verify code:', error)
      setCodeError('Failed to verify code. Please try again.')
    }
  }

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEnteredCode(e.target.value)
    setCodeError('')
  }

  const handleRewardClaim = () => {
    onVideoComplete(videoId)
    onClose()
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0
  const watchProgressPercentage = watchProgress * 100

  // For demo purposes, simulate video watching if video fails to load
  const handleSimulateVideo = () => {
    setVideoError(false)
    setIsLoading(false)
    setDuration(30) // 30 second demo video
    setIsPlaying(true)
    
    // Simulate watching progress
    let progress = 0
    const interval = setInterval(() => {
      progress += 0.01
      setWatchProgress(progress)
      setCurrentTime(progress * 30)
      
      // Show code input at 50% progress
      if (progress >= 0.5 && !showCodeInput) {
        setShowCodeInput(true)
        setShowCodeHint(true)
        setShowCodeOverlay(true)
        setTimeout(() => setShowCodeHint(false), 5000)
      }
      
      if (progress >= MIN_WATCH_PERCENTAGE && !hasWatchedEnough) {
        setHasWatchedEnough(true)
        if (isCodeCorrect) {
          setShowRewardButton(true)
        }
        setIsPlaying(false)
        clearInterval(interval)
      }
    }, 100)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-2xl overflow-hidden w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-gray-50">
              <div className="flex items-center space-x-2">
                {isYouTube ? (
                  <Youtube className="w-5 h-5 text-red-600" />
                ) : (
                  <Eye className="w-5 h-5 text-blue-600" />
                )}
                <h3 className="font-semibold text-gray-800">
                  {isYouTube ? 'Watch YouTube Video' : 'Watch Video'}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            {/* Video Container */}
            <div className="relative bg-black">
              {isLoading && !isYouTube && (
                <div className="w-full h-64 flex items-center justify-center">
                  <div className="text-white text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                    <p>Loading video...</p>
                  </div>
                </div>
              )}

              {videoError && !isYouTube && (
                <div className="w-full h-64 flex items-center justify-center">
                  <div className="text-white text-center p-4">
                    <AlertCircle className="w-12 h-12 mx-auto mb-4 text-yellow-400" />
                    <h4 className="text-lg font-semibold mb-2">Video Unavailable</h4>
                    <p className="text-sm mb-4">The video couldn't be loaded. You can simulate watching for demo purposes.</p>
                    <button
                      onClick={handleSimulateVideo}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium"
                    >
                      Simulate Video Watch
                    </button>
                  </div>
                </div>
              )}

              {isYouTube && (
                <div className="relative">
                  <iframe
                    ref={iframeRef}
                    className="w-full h-64"
                    src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=${isPlaying ? 1 : 0}&mute=${isMuted ? 1 : 0}&controls=1&rel=0`}
                    title="YouTube video player"
                    frameBorder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                  <div className="absolute top-2 right-2 bg-red-600 text-white px-2 py-1 rounded text-xs font-medium">
                    YouTube
                  </div>
                </div>
              )}

              {!isLoading && !videoError && !isYouTube && (
                <>
                  <div className="relative">
                    <video
                      ref={videoRef}
                      className="w-full h-64 object-cover"
                      onTimeUpdate={handleTimeUpdate}
                      onLoadedMetadata={handleLoadedMetadata}
                      onError={handleVideoError}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                    >
                      <source src={videoUrl} type="video/mp4" />
                      Your browser does not support the video tag.
                    </video>
                    
                    {/* Demo Code Overlay */}
                    <VideoCodeOverlay
                      code={currentVideoCode?.code || 'DEMO'}
                      isVisible={showCodeOverlay}
                      onCodeShown={() => {}}
                    />
                  </div>

                  {/* Video Controls Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                    {/* Progress Bar */}
                    <div className="mb-2">
                      <input
                        type="range"
                        min="0"
                        max={duration || 0}
                        value={currentTime}
                        onChange={handleSeek}
                        className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
                      />
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={handlePlayPause}
                          className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                        >
                          {isPlaying ? (
                            <Pause className="w-4 h-4 text-white" />
                          ) : (
                            <Play className="w-4 h-4 text-white" />
                          )}
                        </button>
                        <button
                          onClick={handleMuteToggle}
                          className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
                        >
                          {isMuted ? (
                            <VolumeX className="w-4 h-4 text-white" />
                          ) : (
                            <Volume2 className="w-4 h-4 text-white" />
                          )}
                        </button>
                        <span className="text-white text-sm">
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Code Verification Section */}
            {showCodeInput && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-blue-50 border-l-4 border-blue-500"
              >
                <div className="flex items-center space-x-2 mb-3">
                  <Key className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-blue-800">Enter Video Code</h4>
                </div>
                
                {showCodeHint && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mb-3 p-3 bg-blue-100 rounded-lg"
                  >
                    <p className="text-sm text-blue-700">
                      💡 <strong>Hint:</strong> {currentVideoCode?.hint}
                    </p>
                  </motion.div>
                )}
                
                <div className="flex space-x-2">
                  <input
                    ref={codeInputRef}
                    type="text"
                    value={enteredCode}
                    onChange={handleCodeChange}
                    placeholder="Enter the code from the video..."
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    onKeyPress={(e) => e.key === 'Enter' && handleCodeSubmit()}
                  />
                  <button
                    onClick={handleCodeSubmit}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Verify
                  </button>
                </div>
                
                {codeError && (
                  <p className="text-red-600 text-sm mt-2">{codeError}</p>
                )}
                
                {isCodeCorrect && (
                  <div className="flex items-center space-x-2 mt-2 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Code verified successfully!</span>
                  </div>
                )}
              </motion.div>
            )}

            {/* Watch Progress */}
            <div className="p-4 bg-gray-50">
              <div className="mb-2">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Watch Progress</span>
                  <span>{Math.round(watchProgressPercentage)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${watchProgressPercentage}%` }}
                  />
                </div>
              </div>
              
              <div className="text-xs text-gray-500">
                {hasWatchedEnough && isCodeCorrect ? (
                  <span className="text-green-600 flex items-center">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Video watched and code verified! You can now claim your reward.
                  </span>
                ) : hasWatchedEnough && !isCodeCorrect ? (
                  <span className="text-orange-600 flex items-center">
                    <Key className="w-3 h-3 mr-1" />
                    Video watched! Please enter the code to claim your reward.
                  </span>
                ) : (
                  <span>
                    {isYouTube ? (
                      "Watch the YouTube video and enter the code that appears to earn your reward."
                    ) : (
                      `Watch at least ${Math.round(MIN_WATCH_PERCENTAGE * 100)}% of the video and enter the code to claim your reward`
                    )}
                  </span>
                )}
              </div>
            </div>

            {/* Reward Button */}
            {showRewardButton && (
              <div className="p-4">
                <button
                  onClick={handleRewardClaim}
                  className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-3 px-4 rounded-lg font-medium hover:from-green-600 hover:to-green-700 transition-all flex items-center justify-center space-x-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  <span>Claim {currentVideoCode?.points || 100} Points Reward</span>
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default VideoPlayer
