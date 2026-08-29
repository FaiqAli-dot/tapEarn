# Deployment — GitHub Pages + Render

Host the **Mini App** on GitHub Pages and the **API + Telegram bot** on Render.

| Piece | URL |
| --- | --- |
| Frontend (Mini App) | `https://faiqali-dot.github.io/tapEarn/` |
| Backend (API) | `https://<your-service>.onrender.com` |
| Bot | @YORZAEARNBOT |

---

## 1. MongoDB Atlas (required for Render)

Render does not include MongoDB. Use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) free tier:

1. Create a cluster → **Connect** → driver connection string.
2. Replace `<password>` and allow network access (`0.0.0.0/0` for MVP or Render IPs).
3. Connection string example:
   `mongodb+srv://user:pass@cluster.mongodb.net/tapearn?retryWrites=true&w=majority`

---

## 2. Deploy backend on Render

### Option A — Blueprint (`render.yaml`)

1. Push this repo to GitHub.
2. [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint** → connect `FaiqAli-dot/tapEarn`.
3. Set secrets when prompted:
   - `TELEGRAM_BOT_TOKEN` (revoke old token if it was leaked; use a new one)
   - `MONGODB_URI`
4. Deploy. Note the service URL, e.g. `https://tapearn-api.onrender.com`.

### Option B — Manual Web Service

1. **New Web Service** → connect repo.
2. **Root directory:** `backend`
3. **Build:** `npm install`
4. **Start:** `npm start`
5. **Health check path:** `/health`

### Render environment variables

Copy from `backend/env.production.example`:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `ALLOW_DEV_AUTH` | `false` |
| `USE_MEMORY_MONGO` | `false` |
| `TELEGRAM_BOT_TOKEN` | from @BotFather |
| `TELEGRAM_BOT_USERNAME` | `YORZAEARNBOT` |
| `JWT_SECRET` | long random string |
| `MONGODB_URI` | Atlas connection string |
| `FRONTEND_URL` | `https://faiqali-dot.github.io/tapEarn/` |
| `FRONTEND_ORIGINS` | `https://faiqali-dot.github.io` |

Test:

```bash
curl https://<your-service>.onrender.com/health
```

API base for the frontend: `https://<your-service>.onrender.com/api`

---

## 3. Deploy frontend on GitHub Pages

### GitHub repo settings

1. **Settings → Pages** → Source: **Deploy from a branch**
2. Branch: `gh-pages` / `/ (root)`
3. Wait for first deploy after workflow runs.

### GitHub Actions variable (required)

**Settings → Secrets and variables → Actions → Variables**

| Name | Example |
| --- | --- |
| `VITE_API_BASE_URL` | `https://tapearn-api.onrender.com/api` |

Must include `/api` at the end.

### Automatic deploy

On every push to `main`, `.github/workflows/deploy-gh-pages.yml` builds with base `/tapEarn/` and pushes to `gh-pages`.

Manual local build:

```bash
export VITE_API_BASE_URL=https://your-service.onrender.com/api
export VITE_APP_PUBLIC_URL=https://faiqali-dot.github.io/tapEarn
npm run build:pages
```

### Optional: app icon for TON Connect

Add `public/icon.png` (192×192 PNG). Referenced in `tonconnect-manifest.json`.

---

## 4. Telegram @BotFather setup

1. **BotFather** → your bot → **Bot Settings** → **Menu Button** → **Configure menu button**
   - URL: `https://faiqali-dot.github.io/tapEarn/`
2. Or **/setdomain** / Web App domain if using Mini App settings.
3. Ensure `FRONTEND_URL` on Render matches this exact URL (with trailing slash is OK).

Test in Telegram:

- `/start`
- `/start ref_SOMECODE`
- Tap **Open TapEarn**

---

## 5. Checklist

- [ ] Atlas `MONGODB_URI` on Render
- [ ] `TELEGRAM_BOT_TOKEN` on Render (not in git)
- [ ] `ALLOW_DEV_AUTH=false` on Render
- [ ] Render `/health` returns OK
- [ ] GitHub variable `VITE_API_BASE_URL` set
- [ ] `main` pushed → gh-pages updated
- [ ] `https://faiqali-dot.github.io/tapEarn/` loads
- [ ] BotFather Web App URL set
- [ ] Open Mini App from Telegram → login works (real `initData`)

---

## Troubleshooting

| Issue | Fix |
| --- | --- |
| CORS error in browser | `FRONTEND_ORIGINS=https://faiqali-dot.github.io` on Render |
| API 401 in Telegram | `ALLOW_DEV_AUTH=false`; user must open from Telegram |
| Blank page / wrong routes | Pages must use `gh-pages` build with base `/tapEarn/` |
| Bot button missing | Set `FRONTEND_URL` on Render |
| Render sleeps (free tier) | First request after idle may take ~30s; upgrade or use uptime ping |

---

## Local vs production

| | Local | Production |
| --- | --- | --- |
| Frontend | `http://localhost:3000/?userId=…` | GitHub Pages URL |
| API | `http://localhost:3001/api` | Render `/api` |
| Auth | `ALLOW_DEV_AUTH=true` | Telegram `initData` only |
