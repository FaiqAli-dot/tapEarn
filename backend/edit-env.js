const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🔧 TapEarn Backend Environment Setup');
console.log('=====================================\n');

// Check if .env exists
if (!fs.existsSync('.env')) {
  console.log('❌ .env file not found!');
  console.log('Please run: cp env.example .env');
  process.exit(1);
}

// Read current .env content
const envContent = fs.readFileSync('.env', 'utf8');

// Check if token is still placeholder
if (envContent.includes('your_bot_token_here')) {
  console.log('⚠️  Your .env file still contains placeholder values!');
  console.log('');
  console.log('📱 To get a Telegram bot token:');
  console.log('1. Open Telegram and search for @BotFather');
  console.log('2. Send /newbot command');
  console.log('3. Follow the instructions to create your bot');
  console.log('4. Copy the token provided by BotFather');
  console.log('');
  console.log('🔑 The token should look like: 1234567890:ABCdefGHIjklMNOpqrsTUVwxyz');
  console.log('');
  
  rl.question('Enter your Telegram bot token: ', (token) => {
    if (token.trim() && !token.includes('your_bot_token_here')) {
      // Replace the placeholder
      const newContent = envContent.replace('your_bot_token_here', token.trim());
      fs.writeFileSync('.env', newContent);
      console.log('✅ Bot token updated successfully!');
      console.log('');
      console.log('🚀 You can now start the backend with: npm start');
    } else {
      console.log('❌ Invalid token. Please try again.');
    }
    rl.close();
  });
} else {
  console.log('✅ .env file is already configured!');
  console.log('🚀 You can start the backend with: npm start');
  rl.close();
}
