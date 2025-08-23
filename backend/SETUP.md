# Backend Setup Guide

## Prerequisites

1. Node.js 18+ installed
2. MongoDB instance (local or cloud)
3. Telegram Bot Token

## Installation

1. **Install dependencies:**
```bash
cd backend
npm install
```

2. **Set up environment variables:**
```bash
cp .env.example .env
```

3. **Configure your `.env` file:**
```env
PORT=3001
MONGODB_URI=mongodb://localhost:27017/tapearn
TELEGRAM_BOT_TOKEN=your_bot_token_here
FRONTEND_URL=http://localhost:3000
NODE_ENV=development
```

## Database Setup

1. **Start MongoDB:**
```bash
# Local MongoDB
mongod

# Or use MongoDB Atlas (cloud)
# Update MONGODB_URI in .env with your Atlas connection string
```

2. **The database and collections will be created automatically when the app starts.**

## Running the Backend

1. **Development mode:**
```bash
npm run dev
```

2. **Production mode:**
```bash
npm start
```

## API Endpoints

### User Management
- `GET /api/users/init` - Initialize user
- `GET /api/users/me` - Get user profile
- `PATCH /api/users/update` - Update user data

### Game Actions
- `GET /api/users/game-state` - Get user game state
- `POST /api/users/game-state` - Update user game state
- `POST /api/users/tap` - Handle tap action
- `POST /api/users/complete-task` - Complete daily task
- `POST /api/users/purchase-upgrade` - Purchase upgrade

### Social Features
- `GET /api/users/leaderboard` - Get leaderboard

## Authentication

The backend uses Telegram user IDs for authentication. The user ID is passed via:
- URL query parameter: `?userId=123456789`
- Header: `x-user-id: 123456789`

## Data Structure

User data is stored in MongoDB with the following structure:
- Telegram user info (ID, username, name)
- Game state (points, energy, upgrades)
- Statistics (total taps, earnings)
- Daily tasks and completion status
- Referral system data
- Wallet integration data

## Testing

1. **Start the backend server**
2. **Test API endpoints using curl or Postman:**

```bash
# Initialize user
curl "http://localhost:3001/api/users/init?userId=123456789&username=testuser"

# Get game state
curl -H "x-user-id: 123456789" http://localhost:3001/api/users/game-state

# Tap action
curl -X POST -H "x-user-id: 123456789" http://localhost:3001/api/users/tap
```

## Deployment

1. **Set up environment variables for production**
2. **Use PM2 or similar process manager:**
```bash
npm install -g pm2
pm2 start src/index.js --name tapearn-backend
```

3. **Set up reverse proxy (nginx) for production**
4. **Configure SSL certificates**
5. **Set up monitoring and logging** 