# TapEarn Backend

## 🚨 Current Issue: Telegram Bot 404 Errors

If you're seeing repeated `[polling_error] {"code":"ETELEGRAM","message":"ETELEGRAM: 404 Not Found"}` errors, this means your Telegram bot token is either:
- Missing from the `.env` file
- Invalid or expired
- The bot was deleted from BotFather

## 🔧 Quick Fix

### Option 1: Interactive Setup (Recommended)
```bash
npm run setup
```

This will guide you through entering your bot token interactively.

### Option 2: Manual Setup
1. Edit the `.env` file manually
2. Replace `your_bot_token_here` with your actual bot token

## 📱 Getting a Telegram Bot Token

1. **Open Telegram** and search for `@BotFather`
2. **Send the command**: `/newbot`
3. **Follow the instructions**:
   - Choose a name for your bot (e.g., "TapEarn Bot")
   - Choose a username (must end with "bot", e.g., "tapearn_bot")
4. **Copy the token** provided by BotFather
5. **Paste it** in your `.env` file as `TELEGRAM_BOT_TOKEN=your_actual_token_here`

## ⚙️ Required Environment Variables

```bash
# Required
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Optional (with defaults)
PORT=3001
NODE_ENV=development
TON_RPC_URL=https://toncenter.com/api/v2/jsonRPC
```

## 🚀 Starting the Backend

```bash
# Install dependencies
npm install

# Setup environment (if not done)
npm run setup

# Start the server
npm start
```

## 🔍 Troubleshooting

### Bot Still Getting 404 Errors?
1. **Verify the token**: Check that you copied the entire token from BotFather
2. **Check bot status**: Send `/mybots` to @BotFather and ensure your bot is active
3. **Restart the server**: Stop the server (Ctrl+C) and restart with `npm start`

### Common Issues
- **Token format**: Should look like `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`
- **Bot deleted**: If you deleted the bot, create a new one and get a new token
- **Network issues**: Ensure your server can reach Telegram's API

### Testing the Bot
1. Start the backend server
2. Find your bot on Telegram (using the username you created)
3. Send `/start` to test if it responds

## 📚 Additional Resources

- [Telegram Bot API Documentation](https://core.telegram.org/bots/api)
- [node-telegram-bot-api Documentation](https://github.com/yagop/node-telegram-bot-api)
- [BotFather Commands](https://t.me/botfather)

## 🆘 Still Having Issues?

1. Check the console output for specific error messages
2. Verify your bot token is correct
3. Ensure your bot is active in BotFather
4. Check if there are any network restrictions on your server
