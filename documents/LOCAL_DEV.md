# Local development (no Telegram bot / no real MongoDB)

## One-time

```bash
# root
npm install
cp env.example .env   # if needed

# backend
cd backend
npm install
cp env.example .env
```

Ensure `backend/.env` has:

```env
NODE_ENV=development
ALLOW_DEV_AUTH=true
USE_MEMORY_MONGO=true
JWT_SECRET=local-dev-jwt-secret-change-me
FRONTEND_URL=http://localhost:3000
TELEGRAM_BOT_TOKEN=<from @BotFather — never commit>
TELEGRAM_BOT_USERNAME=YORZAEARNBOT
```

Ensure root `.env` has:

```env
VITE_API_BASE_URL=http://localhost:3001/api
VITE_TELEGRAM_BOT_USERNAME=YORZAEARNBOT
```

## Run

Terminal 1:

```bash
cd backend && npm run dev
```

Terminal 2:

```bash
npm run dev
```

## Open the app

http://localhost:5173/?userId=123456789

Optional referral on first create:

http://localhost:5173/?userId=999888777&start=ref_SOMECODE

## API smoke test

```bash
curl -s -X POST http://localhost:3001/api/auth/dev \
  -H 'Content-Type: application/json' \
  -d '{"telegramId":"123456789","username":"localuser","firstName":"Local"}'

# then use the returned token:
curl -s http://localhost:3001/api/users/game-state \
  -H "Authorization: Bearer <token>"
```

## Notes

- In-memory Mongo loses all data when the backend stops.
- Bot will log a warning and not start until `TELEGRAM_BOT_TOKEN` is set — that is expected for local.
- Never set `ALLOW_DEV_AUTH=true` in production.
