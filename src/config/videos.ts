// Video configuration for daily tasks
export const VIDEO_CONFIG = {
  // YouTube videos for daily tasks
  youtube: {
    daily: {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Featured Video',
      description: 'Watch our featured video to earn points',
      points: 100,
      duration: 60, // Estimated duration in seconds
      code: 'TAP2024',
      codeHint: 'Look for the code that appears in the video',
      codeTime: 0.5 // Show code input at 50% of video progress
    },
    // Add more YouTube videos here
    gaming: {
      url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw', // First YouTube video
      title: 'Gaming Video',
      description: 'Watch a gaming video',
      points: 150,
      duration: 45,
      code: 'GAME2024',
      codeHint: 'Find the gaming code in the video',
      codeTime: 0.6
    },
    educational: {
      url: 'https://www.youtube.com/watch?v=kJQP7kiw5Fk', // Despacito (popular)
      title: 'Educational Content',
      description: 'Learn something new',
      points: 200,
      duration: 90,
      code: 'LEARN2024',
      codeHint: 'The educational code will appear during the video',
      codeTime: 0.4
    }
  },
  
  // Direct video files (MP4, WebM, etc.)
  direct: {
    promo: {
      url: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
      title: 'Promotional Video',
      description: 'Watch our promotional content',
      points: 75,
      duration: 30,
      code: 'PROMO2024',
      codeHint: 'Look for the promotional code',
      codeTime: 0.5
    }
  }
}

// Video codes mapping for easy access
export const VIDEO_CODES = {
  'watch_youtube': {
    code: 'TAP2024',
    hint: 'Look for the code that appears in the video',
    timeToShow: 0.5 // Show code input at 50% of video progress
  },
  'watch_gaming': {
    code: 'GAME2024',
    hint: 'Find the gaming code in the video',
    timeToShow: 0.6
  },
  'watch_educational': {
    code: 'LEARN2024',
    hint: 'The educational code will appear during the video',
    timeToShow: 0.4
  }
}

// Helper function to get video config by type and category
export const getVideoConfig = (type: 'youtube' | 'direct', category: string) => {
  const group = VIDEO_CONFIG[type] as Record<string, typeof VIDEO_CONFIG.youtube.daily>
  return group?.[category] || VIDEO_CONFIG.youtube.daily
}

// Helper function to get video code by video ID
export const getVideoCode = (videoId: string) => {
  return VIDEO_CODES[videoId as keyof typeof VIDEO_CODES] || VIDEO_CODES['watch_youtube']
}

// Helper function to extract YouTube video ID
export const extractYouTubeId = (url: string): string | null => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
  const match = url.match(regExp)
  return (match && match[2].length === 11) ? match[2] : null
}

// Helper function to check if URL is YouTube
export const isYouTubeUrl = (url: string): boolean => {
  return extractYouTubeId(url) !== null
}

// Default video for daily tasks
export const DEFAULT_DAILY_VIDEO = VIDEO_CONFIG.youtube.daily
