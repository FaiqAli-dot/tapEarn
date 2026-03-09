# Database-Driven Video Code System

## Overview

The TapEarn app now uses a **database-driven video code system** where you can manage video links and codes directly through the database. This gives you full control over video content and verification codes without needing to modify code.

## 🎯 **Key Features**

### **Database Management**
- **Video codes stored in MongoDB** - No more hardcoded values
- **Dynamic video URLs** - Change videos without code changes
- **Flexible code management** - Add, edit, delete codes through admin interface
- **Real-time updates** - Changes take effect immediately

### **Admin Interface**
- **Web-based admin panel** - Manage codes through browser
- **CRUD operations** - Create, Read, Update, Delete video codes
- **Visual management** - Easy-to-use interface
- **Real-time validation** - Immediate feedback on changes

### **API Endpoints**
- **RESTful API** - Full CRUD operations
- **Secure verification** - Server-side code validation
- **Scalable design** - Easy to extend for more features

## 🗄️ **Database Schema**

### **VideoCode Model**
```javascript
{
  taskId: String,        // Unique identifier (e.g., 'watch_youtube')
  videoUrl: String,      // Video URL (YouTube, direct, etc.)
  code: String,          // Verification code (e.g., 'TAP2024')
  hint: String,          // User hint (e.g., 'Look for the code...')
  timeToShow: Number,    // When to show code input (0-1)
  points: Number,        // Reward points
  isActive: Boolean,     // Whether code is active
  createdAt: Date,       // Creation timestamp
  updatedAt: Date        // Last update timestamp
}
```

## 🚀 **Quick Start**

### **1. Initialize Default Video Code**
```bash
cd backend
npm run init-video-codes
```

This creates the default video code:
- **Task ID**: `watch_youtube`
- **Video URL**: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- **Code**: `TAP2024`
- **Points**: 100

### **2. Access Admin Interface**
Navigate to: `http://localhost:3000/admin/video-codes`

### **3. Manage Video Codes**
- **Add new codes** - Click "Add New" button
- **Edit existing codes** - Click edit icon
- **Delete codes** - Click delete icon
- **Activate/Deactivate** - Toggle status

## 📋 **Admin Interface Features**

### **Add/Edit Video Code Form**
- **Task ID**: Unique identifier for the video task
- **Video URL**: YouTube or direct video URL
- **Code**: Verification code (auto-uppercase)
- **Points**: Reward points for completing
- **Time to Show**: When code input appears (0-1)
- **Status**: Active/Inactive toggle
- **Hint**: Helpful text for users

### **Video Codes Table**
- **Task ID & URL**: Video identification
- **Code & Hint**: Verification details
- **Points & Timing**: Reward configuration
- **Status**: Active/Inactive indicator
- **Actions**: Edit/Delete buttons

## 🔧 **API Endpoints**

### **Get Video Code**
```http
GET /api/video-codes/:taskId
```
**Response:**
```json
{
  "success": true,
  "data": {
    "taskId": "watch_youtube",
    "videoUrl": "https://youtube.com/watch?v=...",
    "code": "TAP2024",
    "hint": "Look for the code...",
    "timeToShow": 0.5,
    "points": 100
  }
}
```

### **Create/Update Video Code**
```http
POST /api/video-codes/:taskId
Content-Type: application/json

{
  "videoUrl": "https://youtube.com/watch?v=...",
  "code": "NEW2024",
  "hint": "Find the new code",
  "timeToShow": 0.6,
  "points": 150,
  "isActive": true
}
```

### **Verify Video Code**
```http
POST /api/video-codes/verify
Content-Type: application/json

{
  "taskId": "watch_youtube",
  "enteredCode": "TAP2024"
}
```

### **Get All Video Codes (Admin)**
```http
GET /api/video-codes
```

### **Delete Video Code (Admin)**
```http
DELETE /api/video-codes/:taskId
```

## 💡 **Usage Examples**

### **Adding a New Video Code**
1. **Go to admin interface**: `http://localhost:3000/admin/video-codes`
2. **Click "Add New"**
3. **Fill in details**:
   - Task ID: `watch_gaming`
   - Video URL: `https://youtube.com/watch?v=...`
   - Code: `GAME2024`
   - Points: 150
   - Time to Show: 0.7
4. **Click "Save"**

### **Changing Video URL**
1. **Find the video code** in the admin table
2. **Click edit icon**
3. **Update Video URL** field
4. **Click "Save"**

### **Changing Verification Code**
1. **Edit the video code**
2. **Update Code field** (auto-uppercase)
3. **Update Hint** if needed
4. **Save changes**

## 🔒 **Security Features**

### **Server-Side Verification**
- **Codes verified on backend** - No client-side validation
- **Case-insensitive** - Works with any case
- **Trimmed input** - Handles whitespace
- **Rate limiting** - Prevents brute force

### **Database Security**
- **Unique task IDs** - No duplicates
- **Validation** - Required fields enforced
- **Timestamps** - Audit trail
- **Soft deletes** - Data preservation

## 📊 **Monitoring & Analytics**

### **Backend Logs**
```javascript
// Code verification logs
🔍 Verifying code for task: watch_youtube - Entered: TAP2024, Correct: TAP2024, Result: true

// Admin operation logs
📹 Created/Updated video code for task: watch_youtube - Code: TAP2024
📹 Getting video code for task: watch_youtube
```

### **Database Queries**
```javascript
// Check current video codes
db.videocodes.find({ isActive: true })

// Get specific video code
db.videocodes.findOne({ taskId: 'watch_youtube' })
```

## 🛠️ **Development Workflow**

### **1. Local Development**
```bash
# Start servers
npm run start

# Initialize video codes
cd backend && npm run init-video-codes

# Access admin interface
# http://localhost:3000/admin/video-codes
```

### **2. Testing Video Codes**
```bash
# Test with curl
curl -X POST http://localhost:3002/api/video-codes/verify \
  -H "Content-Type: application/json" \
  -d '{"taskId": "watch_youtube", "enteredCode": "TAP2024"}'
```

### **3. Database Management**
```bash
# Connect to MongoDB
mongosh

# Check video codes
use tap-earn
db.videocodes.find().pretty()
```

## 🔄 **Migration from Hardcoded**

### **Before (Hardcoded)**
```typescript
// src/config/videos.ts
export const VIDEO_CODES = {
  'watch_youtube': {
    code: 'TAP2024',
    hint: 'Look for the code...',
    timeToShow: 0.5
  }
}
```

### **After (Database-Driven)**
```typescript
// Frontend fetches from database
const videoCode = await apiService.getVideoCode('watch_youtube')
// videoCode.code, videoCode.hint, etc.
```

## 🎯 **Benefits**

### **For Developers**
- **No code changes needed** for video updates
- **Centralized management** - All codes in one place
- **Easy testing** - Change codes without deployment
- **Scalable** - Add unlimited video codes

### **For Users**
- **Faster updates** - No app updates needed
- **More content** - Easy to add new videos
- **Better experience** - Dynamic content
- **Reliable** - Server-side verification

### **For Business**
- **Content control** - Manage videos easily
- **Analytics** - Track code usage
- **Flexibility** - Change rewards dynamically
- **Security** - Server-side validation

## 🚀 **Future Enhancements**

### **Planned Features**
- **Bulk operations** - Import/export video codes
- **Scheduling** - Time-based code activation
- **Analytics dashboard** - Usage statistics
- **User-specific codes** - Personalized content
- **Code rotation** - Automatic code changes

### **Advanced Features**
- **Video categories** - Organize by type
- **Multi-language support** - Localized hints
- **A/B testing** - Test different codes
- **Integration APIs** - Connect with external systems

The database-driven video code system provides complete flexibility and control over your video reward system! 🎉
