# Code Verification System

## Overview

The TapEarn app now includes a robust code verification system for video watching rewards. Users must watch videos and enter codes that appear during the video to claim their rewards, ensuring genuine engagement.

## Features

### 🔐 **Code Verification**
- **Video codes** appear at specific times during videos
- **User input validation** - codes must be entered correctly
- **Real-time feedback** - immediate verification results
- **Case-insensitive** - codes work regardless of case

### 🎯 **Enhanced Security**
- **Two-step verification** - watch video + enter code
- **Prevents automation** - requires human interaction
- **Time-based codes** - appear at specific video timestamps
- **Multiple code support** - different codes for different videos

### 🎥 **Video Integration**
- **Demo overlay** - shows how codes appear in videos
- **Configurable timing** - codes appear at specific video progress
- **Visual feedback** - clear code display with animations
- **Hint system** - helps users understand what to look for

## How It Works

### 1. **Video Watching Process**
```typescript
// User watches video
// At 50% progress, code input appears
// User must enter the code that appeared in video
// Only then can they claim the reward
```

### 2. **Code Configuration**
```typescript
// src/config/videos.ts
export const VIDEO_CODES = {
  'watch_youtube': {
    code: 'TAP2024',
    hint: 'Look for the code that appears in the video',
    timeToShow: 0.5 // Show at 50% of video progress
  }
}
```

### 3. **Verification Flow**
```typescript
// 1. User watches video
// 2. Code appears at specified time
// 3. User enters code
// 4. System validates code
// 5. If correct + watched enough → reward available
```

## Implementation Details

### **VideoPlayer Component**
- **Code input section** - appears during video playback
- **Real-time validation** - checks code as user types
- **Progress tracking** - monitors video watch progress
- **Reward gating** - only shows reward button when both conditions met

### **Code Overlay System**
- **Demo overlay** - shows how codes appear in videos
- **Animated display** - smooth code appearance
- **Visual styling** - clear, readable code presentation
- **Timing control** - appears at specific video progress

### **Configuration System**
- **Centralized codes** - all codes in one configuration file
- **Easy management** - simple to add/change codes
- **Multiple videos** - different codes for different content
- **Flexible timing** - configurable when codes appear

## Usage Examples

### **For Users**
1. **Start watching** the video
2. **Look for code** that appears during video
3. **Enter code** in the input field
4. **Verify code** by clicking "Verify" button
5. **Claim reward** when both conditions are met

### **For Developers**

#### **Adding New Video Codes**
```typescript
// In src/config/videos.ts
export const VIDEO_CODES = {
  'new_video_task': {
    code: 'NEW2024',
    hint: 'Find the new code in the video',
    timeToShow: 0.7 // Show at 70% progress
  }
}
```

#### **Using Different Codes**
```typescript
// In your component
const videoCode = getVideoCode('watch_youtube')
console.log(videoCode.code) // 'TAP2024'
console.log(videoCode.hint) // 'Look for the code...'
```

## Security Benefits

### **Anti-Automation**
- **Human interaction required** - can't be automated
- **Visual verification** - must actually see the code
- **Time-based** - codes appear at specific times
- **Unique codes** - different for each video

### **Engagement Verification**
- **Must watch video** - can't skip to end
- **Must pay attention** - need to see the code
- **Must interact** - manual code entry required
- **Must complete** - both watching and code entry

### **Fraud Prevention**
- **No quick clicking** - requires actual video watching
- **No automation** - human input required
- **No bypassing** - code verification mandatory
- **No multiple claims** - one code per video

## Configuration Options

### **Code Properties**
```typescript
interface VideoCode {
  code: string           // The actual code to enter
  hint: string          // Helpful hint for users
  timeToShow: number    // When to show code input (0-1)
}
```

### **Timing Options**
```typescript
timeToShow: 0.3  // Show at 30% of video
timeToShow: 0.5  // Show at 50% of video (default)
timeToShow: 0.7  // Show at 70% of video
timeToShow: 0.9  // Show near end of video
```

### **Code Examples**
```typescript
// Simple codes
code: 'TAP2024'
code: 'GAME2024'
code: 'LEARN2024'

// Complex codes
code: 'TAP-EARN-2024'
code: 'GAMING-REWARD-2024'
code: 'LEARNING-BONUS-2024'
```

## User Experience

### **Visual Feedback**
- **Code input appears** - clear indication when to enter code
- **Hint system** - helps users understand what to do
- **Error messages** - clear feedback for wrong codes
- **Success indicators** - confirmation when code is correct

### **Progressive Disclosure**
- **Watch first** - focus on video content initially
- **Code appears** - introduce code requirement at right time
- **Enter code** - simple input process
- **Claim reward** - final step after verification

### **Accessibility**
- **Clear instructions** - easy to understand
- **Visual cues** - obvious when code input is needed
- **Error handling** - helpful error messages
- **Keyboard support** - Enter key works for submission

## Testing

### **Test Scenarios**
1. **Correct code** - should allow reward claim
2. **Wrong code** - should show error message
3. **Case sensitivity** - should work with different cases
4. **Timing** - should appear at correct video progress
5. **Multiple attempts** - should allow retries

### **Test Codes**
```typescript
// Test these codes:
'TAP2024'     // Correct code
'tap2024'     // Should work (case insensitive)
'TAP2023'     // Should fail
'WRONG'       // Should fail
''            // Should fail (empty)
```

## Future Enhancements

### **Planned Features**
- **Multiple codes per video** - different codes at different times
- **Code expiration** - codes expire after certain time
- **Dynamic codes** - codes change based on user or time
- **Code categories** - different types of codes for different rewards

### **Advanced Security**
- **Code rotation** - codes change regularly
- **User-specific codes** - unique codes per user
- **Time-based codes** - codes valid only for certain time
- **Location-based codes** - codes vary by region

### **Analytics & Monitoring**
- **Code success rates** - track how often codes are entered correctly
- **User behavior** - monitor code entry patterns
- **Fraud detection** - identify suspicious activity
- **Performance metrics** - measure system effectiveness

## Troubleshooting

### **Common Issues**
1. **Code not appearing** - check video progress and timing
2. **Code not accepted** - verify code spelling and case
3. **Input not working** - check browser compatibility
4. **Reward not claiming** - ensure both conditions are met

### **Debug Mode**
```typescript
// Enable debug logging
console.log('Video Code:', currentVideoCode)
console.log('Entered Code:', enteredCode)
console.log('Is Correct:', isCodeCorrect)
console.log('Watch Progress:', watchProgress)
```

The code verification system significantly improves the security and integrity of the video reward system while maintaining a good user experience! 🎉
