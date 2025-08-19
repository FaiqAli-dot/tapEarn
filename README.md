# TapEarn - TON Blockchain Tap-to-Earn Game

A Telegram Mini App that combines the addictive gameplay of tap-to-earn mechanics with the power of TON blockchain technology. Users can tap to earn points, complete daily tasks, upgrade their earning potential, and earn real rewards through TON Jettons.

## 🎮 Features

### Core Gameplay
- **Tap to Earn**: Simple tap mechanics with energy system
- **Energy Management**: Regenerating energy system with upgrades
- **Points System**: Earn points through tapping, tasks, and referrals
- **Offline Earnings**: Continue earning while away from the app

### Daily Tasks & Upgrades
- **Daily Tasks**: Complete tasks for bonus points (login, watch videos, streaks)
- **Upgrade System**: Improve tap power, offline earning, and energy regeneration
- **Progressive Costs**: Increasing costs for higher-level upgrades

### Referral System
- **Referral Links**: Generate unique referral codes
- **Bonus Rewards**: Earn 10% of referred users' earnings
- **Milestone Rewards**: Unlock bonuses at referral milestones
- **Multi-platform Sharing**: Share via Telegram, WhatsApp, and other apps

### TON Blockchain Integration
- **Wallet Connection**: Connect TON wallets using TON Connect
- **Smart Contracts**: On-chain upgrades and point claiming
- **Jetton Rewards**: Convert points to TON Jettons
- **Secure Transactions**: All blockchain operations are secure and transparent

## 🏗️ Architecture

### Frontend (Telegram Mini App)
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **TON Connect** for wallet integration
- **Responsive Design** optimized for mobile

### Backend (Node.js Server)
- **Express.js** REST API
- **Telegram Bot API** integration
- **TON SDK** for blockchain operations
- **Rate Limiting** and security middleware
- **Real-time Updates** via WebSocket

### Smart Contracts (TON Blockchain)
- **FunC Language** contracts
- **Points Management** and upgrades
- **Referral System** tracking
- **Jetton Integration** for rewards
- **Gas Optimization** for cost efficiency

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- TON wallet (Tonkeeper, MyTonWallet, etc.)
- Telegram Bot Token
- TON RPC endpoint

### Frontend Setup

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/tap-earn-ton-app.git
cd tap-earn-ton-app
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Start development server**
```bash
npm run dev
```

5. **Build for production**
```bash
npm run build
```

### Backend Setup

1. **Navigate to backend directory**
```bash
cd backend
npm install
```

2. **Configure environment variables**
```bash
cp .env.example .env
# Edit .env with your Telegram bot token and TON configuration
```

3. **Start the server**
```bash
npm run dev  # Development mode
npm start    # Production mode
```

### Smart Contract Deployment

1. **Compile the contract**
```bash
cd contracts
func build TapEarn.fc
```

2. **Deploy to TON testnet/mainnet**
```bash
# Use TON CLI or your preferred deployment method
ton-cli deploy TapEarn.tact
```

## ⚙️ Configuration

### Environment Variables

#### Frontend (.env)
```env
VITE_TELEGRAM_BOT_USERNAME=@your_bot_username
VITE_TON_CONNECT_MANIFEST_URL=https://your-domain.com/tonconnect-manifest.json
VITE_API_BASE_URL=http://localhost:3001
```

#### Backend (.env)
```env
PORT=3001
TELEGRAM_BOT_TOKEN=your_bot_token_here
TON_RPC_URL=https://toncenter.com/api/v2/jsonRPC
TON_CONTRACT_ADDRESS=EQ...
TON_WALLET_MNEMONIC=your_wallet_mnemonic_here
```

### Telegram Bot Setup

1. **Create a bot with @BotFather**
2. **Get your bot token**
3. **Set up webhook or polling**
4. **Configure Mini App settings**

### TON Wallet Integration

1. **Deploy smart contracts**
2. **Configure TON Connect manifest**
3. **Set up Jetton master contract**
4. **Test wallet connections**

## 🎯 Game Mechanics

### Energy System
- **Base Energy**: 1000 points
- **Regeneration**: 3 energy per second
- **Upgrades**: Increase regeneration rate up to 10/s
- **Tap Cost**: 1 energy per tap

### Points System
- **Base Rate**: 1 point per tap
- **Upgrades**: Increase to 2-5 points per tap
- **Daily Tasks**: 50-500 bonus points
- **Referrals**: 10% of referred users' earnings

### Upgrade Costs
- **Tap Power**: Current level × 100 points
- **Offline Earning**: Current level × 200 points  
- **Energy Regen**: Current level × 150 points

### Referral Rewards
- **Level 1**: 1 friend = 100 bonus points
- **Level 2**: 5 friends = 500 bonus points
- **Level 3**: 10 friends = 1000 bonus points
- **Level 4**: 25 friends = 2500 bonus points

## 🔒 Security Features

- **Rate Limiting**: Prevent abuse and spam
- **Input Validation**: Sanitize all user inputs
- **Secure Storage**: Encrypted user data
- **Blockchain Security**: Smart contract safety checks
- **Telegram Auth**: Verified user authentication

## 📱 Telegram Mini App Features

- **Responsive Design**: Optimized for all screen sizes
- **Native Integration**: Seamless Telegram experience
- **Theme Support**: Automatic light/dark mode
- **Haptic Feedback**: Tactile response for actions
- **Push Notifications**: Daily reminders and updates

## 🚀 Deployment

### Frontend Deployment
```bash
npm run build
# Deploy dist/ folder to your hosting service
```

### Backend Deployment
```bash
npm run build
npm start
# Use PM2 or similar for production
```

### Smart Contract Deployment
```bash
# Testnet
ton-cli deploy --network testnet TapEarn.tact

# Mainnet  
ton-cli deploy --network mainnet TapEarn.tact
```

## 🧪 Testing

### Frontend Tests
```bash
npm run test
npm run test:coverage
```

### Backend Tests
```bash
cd backend
npm test
```

### Smart Contract Tests
```bash
cd contracts
func test TapEarn.fc
```

## 📊 Analytics & Monitoring

- **User Metrics**: Active users, retention, engagement
- **Game Analytics**: Points earned, upgrades purchased
- **Blockchain Metrics**: Transaction volume, gas usage
- **Performance Monitoring**: Response times, error rates

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: [Wiki](https://github.com/yourusername/tap-earn-ton-app/wiki)
- **Issues**: [GitHub Issues](https://github.com/yourusername/tap-earn-ton-app/issues)
- **Discord**: [Join our community](https://discord.gg/your-invite)
- **Telegram**: [@support_username](https://t.me/support_username)

## 🙏 Acknowledgments

- **TON Foundation** for blockchain infrastructure
- **Telegram** for Mini App platform
- **Open Source Community** for amazing libraries and tools

## 🔮 Roadmap

### Phase 1 (Current)
- ✅ Basic tap-to-earn mechanics
- ✅ Energy system and upgrades
- ✅ Daily tasks and referral system
- ✅ TON wallet integration

### Phase 2 (Next)
- 🔄 Advanced upgrade trees
- 🔄 Seasonal events and challenges
- 🔄 Social features and leaderboards
- 🔄 NFT integration

### Phase 3 (Future)
- 📋 Cross-chain bridges
- 📋 DeFi integration
- 📋 Mobile app development
- 📋 Governance token system

---

**Made with ❤️ by the TapEarn Team**

*Transform your taps into TON rewards! 🚀*
# tapEarn
