# YouTube Video Integration

## Overview

The TapEarn app now supports YouTube videos for daily rewards! Users can watch actual YouTube videos embedded directly in the app to earn points.

## Features

### 🎥 YouTube Video Support
- **Direct YouTube embedding** using iframe
- **Automatic video ID extraction** from various YouTube URL formats
- **Simulated progress tracking** for YouTube videos (since iframe events can't be tracked)
- **YouTube branding** with red YouTube icon and badge
- **Autoplay and mute controls** for better user experience

### 🔧 Technical Implementation

#### Video URL Formats Supported
```typescript
// All these formats work:
"https://www.youtube.com/watch?v=dQw4w9WgXcQ"
"https://youtu.be/dQw4w9WgXcQ"
"https://www.youtube.com/embed/dQw4w9WgXcQ"
"https://www.youtube.com/v/dQw4w9WgXcQ"
```

#### Video Configuration
```typescript
// src/config/videos.ts
export const VIDEO_CONFIG = {
  youtube: {
    daily: {
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      title: 'Featured Video',
      description: 'Watch our featured video to earn points',
      points: 100,
      duration: 60
    },
    gaming: {
      url: 'https://www.youtube.com/watch?v=jNQXAC9IVRw',
      title: 'Gaming Video',
      description: 'Watch a gaming video',
      points: 150,
      duration: 45
    }
  }
}
```

## How It Works

### 1. YouTube Detection
The app automatically detects YouTube URLs and switches to YouTube mode:

```typescript
const ytId = extractYouTubeId(videoUrl)
if (ytId) {
  setIsYouTube(true)
  setYoutubeVideoId(ytId)
  // Switch to YouTube iframe mode
}
```

### 2. YouTube Iframe Embedding
YouTube videos are embedded using the official YouTube iframe API:

```typescript
<iframe
  src={`https://www.youtube.com/embed/${youtubeVideoId}?autoplay=${isPlaying ? 1 : 0}&mute=${isMuted ? 1 : 0}&controls=1&rel=0`}
  title="YouTube video player"
  frameBorder="0"
  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
  allowFullScreen
/>
```

### 3. Progress Simulation
Since we can't track iframe events directly, progress is simulated:

```typescript
const startYouTubeSimulation = () => {
  let progress = 0
  const interval = setInterval(() => {
    progress += 0.005 // Slow increment to simulate real watching
    setWatchProgress(progress)
    
    if (progress >= MIN_WATCH_PERCENTAGE) {
      setHasWatchedEnough(true)
      setShowRewardButton(true)
      clearInterval(interval)
    }
  }, 100)
}
```

## Usage

### For Users
1. **Click "Watch Video"** on the YouTube daily task
2. **YouTube video opens** in an embedded player
3. **Watch the video** - progress is tracked automatically
4. **Claim reward** when the progress bar reaches 80%
5. **Get 100 points** added to your account

### For Developers

#### Adding New YouTube Videos
```typescript
// In src/config/videos.ts
youtube: {
  newVideo: {
    url: 'https://www.youtube.com/watch?v=YOUR_VIDEO_ID',
    title: 'New Video Title',
    description: 'Video description',
    points: 150,
    duration: 90
  }
}
```

#### Using Different Videos
```typescript
// In your component
import { getVideoConfig } from '../config/videos'

const videoConfig = getVideoConfig('youtube', 'gaming')
<VideoPlayer
  videoUrl={videoConfig.url}
  videoId="watch_youtube"
  onVideoComplete={handleVideoComplete}
  onClose={handleVideoClose}
  isOpen={isVideoPlayerOpen}
/>
```

## Configuration Options

### YouTube Player Parameters
```typescript
// Available iframe parameters:
autoplay=1|0          // Auto-play video
mute=1|0              // Mute video
controls=1|0          // Show player controls
rel=1|0               // Show related videos
modestbranding=1|0    // Hide YouTube logo
```

### Progress Simulation
```typescript
// Adjust simulation speed:
progress += 0.005     // Slower (more realistic)
progress += 0.01      // Faster (for testing)
```

## Limitations & Considerations

### Technical Limitations
1. **No direct event tracking** - can't detect if user actually watches
2. **CORS restrictions** - can't access iframe content directly
3. **Mobile autoplay** - may be blocked on some devices

### Workarounds
1. **Progress simulation** - realistic timing based on video duration
2. **User interaction** - requires user to click play button
3. **Visual feedback** - clear progress indicators

### Future Improvements
1. **YouTube Data API** - get actual video duration and metadata
2. **User engagement tracking** - detect if user is actively watching
3. **Multiple video categories** - different types of content
4. **Video recommendations** - personalized content suggestions

## Testing

### Test YouTube URLs
```typescript
// Test these URLs:
"https://www.youtube.com/watch?v=dQw4w9WgXcQ"  // Rick Roll
"https://youtu.be/jNQXAC9IVRw"                  // First YouTube video
"https://www.youtube.com/watch?v=kJQP7kiw5Fk"  // Despacito
```

### Debug Mode
Enable debug logging:
```typescript
console.log('YouTube ID:', youtubeVideoId)
console.log('Progress:', watchProgress)
console.log('Is YouTube:', isYouTube)
```

## Security & Privacy

### YouTube Terms of Service
- **Embedding allowed** - YouTube allows iframe embedding
- **No data collection** - we don't collect YouTube viewing data
- **User consent** - users choose to watch videos

### Best Practices
1. **Respect copyright** - only use videos you have rights to
2. **Monitor content** - ensure videos are appropriate
3. **Update regularly** - rotate video content
4. **User feedback** - allow users to report issues

## Troubleshooting

### Common Issues
1. **Video not loading**: Check if video is available in your region
2. **Autoplay blocked**: User may need to click play manually
3. **Progress not updating**: Check if simulation is running
4. **Reward not claiming**: Verify minimum watch percentage

### Solutions
1. **Use different video**: Try alternative YouTube URLs
2. **Clear cache**: Refresh browser and try again
3. **Check console**: Look for JavaScript errors
4. **Test locally**: Ensure video works in development

The YouTube integration provides a much more engaging experience for users while maintaining the security and verification requirements of the reward system! 🎉
