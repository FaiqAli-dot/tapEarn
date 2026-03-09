# Mobile Testing Guide

This guide will help you test the TapEarn app on your phone.

## Prerequisites

1. **Same WiFi Network**: Make sure your phone and computer are connected to the same WiFi network
2. **MongoDB Running**: Ensure MongoDB is running on your computer
3. **Firewall**: You may need to allow incoming connections on ports 3000 and 3001

## Quick Start

### Option 1: Automatic Setup (Recommended)

Run the mobile setup script which will automatically detect your IP and configure everything:

```bash
npm run mobile
```

This will:
- Detect your local IP address
- Create/update the `.env` file with the correct backend URL
- Start both frontend and backend servers
- Display the URL to access from your phone

### Option 2: Manual Setup

1. **Find Your Local IP Address**

   On macOS/Linux:
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```

   On Windows:
   ```bash
   ipconfig
   ```

   Look for something like `192.168.1.x` or `10.0.0.x`

2. **Create/Update .env File**

   Create a `.env` file in the project root:
   ```
   VITE_API_BASE_URL=http://YOUR_LOCAL_IP:3001/api
   ```

   Replace `YOUR_LOCAL_IP` with your actual IP address (e.g., `192.168.1.100`)

3. **Start the Servers**

   ```bash
   npm start
   ```

4. **Access from Phone**

   Open your phone's browser and navigate to:
   ```
   http://YOUR_LOCAL_IP:3000
   ```

## Troubleshooting

### Can't Connect from Phone

1. **Check WiFi**: Verify both devices are on the same network
2. **Firewall**: Temporarily disable firewall or allow ports 3000 and 3001
3. **IP Address**: Make sure you're using the correct local IP (not 127.0.0.1 or localhost)
4. **Server Running**: Verify both servers are running without errors

### CORS Errors

The backend is now configured to accept connections from any origin in development mode. If you still see CORS errors:

1. Check the backend console for errors
2. Verify the `.env` file has the correct `VITE_API_BASE_URL`
3. Try clearing your phone's browser cache

### Port Already in Use

If ports 3000 or 3001 are already in use:

```bash
# Stop existing servers
npm run stop

# Then start again
npm run mobile
```

## Testing Telegram Features

Since this is a Telegram Mini App, for full testing:

1. Use Telegram's Web App testing tools
2. Or deploy to a test Telegram bot using the production build

## Development Tips

- Keep the console open to see real-time logs
- Use Chrome DevTools for remote debugging (chrome://inspect)
- The app will automatically reload when you make changes to the code
- Backend changes require restarting the server (use `npm run restart`)

## Stopping the Servers

```bash
npm run stop
```

Or use `Ctrl+C` in the terminal where the servers are running.

