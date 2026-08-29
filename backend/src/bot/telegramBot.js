import TelegramBot from 'node-telegram-bot-api';

let botInstance = null;

const DEFAULT_MINI_APP_URL = 'https://faiqali-dot.github.io/tapEarn';

function getFrontendBaseUrl() {
  return (process.env.FRONTEND_URL || DEFAULT_MINI_APP_URL).replace(/\/$/, '');
}

function buildMiniAppUrl(startParam) {
  const base = getFrontendBaseUrl();
  if (!base) return null;
  if (startParam) {
    const sep = base.includes('?') ? '&' : '?';
    // Frontend reads ?start= / ?tgWebAppStartParam=; also used if initData has no start_param
    return `${base}${sep}start=${encodeURIComponent(startParam)}`;
  }
  return base;
}

function welcomeText(startParam) {
  const lines = [
    'Welcome to TapEarn!',
    '',
    'Tap to earn points, invite friends, and climb the leaderboard.',
    '',
    'Open the Mini App below to start.'
  ];
  if (startParam) {
    lines.splice(3, 0, `Referral code detected: ${startParam.replace(/^ref_/, '')}`);
    lines.splice(4, 0, '');
  }
  return lines.join('\n');
}

/**
 * Start Telegram bot polling for /start and Mini App launch button.
 * No-ops if TELEGRAM_BOT_TOKEN is missing (so API can still run in local mode).
 */
export function startTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || token === 'your_bot_token_here') {
    console.warn('⚠️  Telegram bot not started: TELEGRAM_BOT_TOKEN is not set');
    return null;
  }

  // Only one process can poll a bot token. Keep local API from fighting Render.
  const pollingOptIn = process.env.TELEGRAM_BOT_POLLING === 'true';
  const pollingOptOut = process.env.TELEGRAM_BOT_POLLING === 'false';
  const shouldPoll =
    pollingOptIn || (process.env.NODE_ENV === 'production' && !pollingOptOut);
  if (!shouldPoll) {
    console.warn(
      '⚠️  Telegram bot polling skipped (local). Render should poll instead. Set TELEGRAM_BOT_POLLING=true to enable locally.'
    );
    return null;
  }

  if (botInstance) {
    return botInstance;
  }

  const bot = new TelegramBot(token, { polling: true });
  botInstance = bot;

  bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const startParam = match?.[1]?.trim() || null;
    const miniAppUrl = buildMiniAppUrl(startParam);

    const replyMarkup = miniAppUrl
      ? {
          inline_keyboard: [
            [
              {
                text: '🎮 Open TapEarn',
                web_app: { url: miniAppUrl }
              }
            ]
          ]
        }
      : undefined;

    try {
      await bot.sendMessage(chatId, welcomeText(startParam), {
        reply_markup: replyMarkup
      });

      if (!miniAppUrl) {
        await bot.sendMessage(
          chatId,
          'Mini App URL is not configured yet. Set FRONTEND_URL on the server.'
        );
      }
    } catch (error) {
      console.error('Bot /start handler error:', error.message);
    }
  });

  bot.onText(/\/help/, async (msg) => {
    try {
      await bot.sendMessage(
        msg.chat.id,
        [
          'TapEarn commands:',
          '/start — open the game',
          '/help — show this message',
          '',
          'Invite friends with your referral link from inside the app.'
        ].join('\n')
      );
    } catch (error) {
      console.error('Bot /help handler error:', error.message);
    }
  });

  bot.on('polling_error', (error) => {
    console.error('Telegram polling error:', error.message);
  });

  console.log('🤖 Telegram bot started (polling)');
  console.log(`🎮 Mini App URL: ${getFrontendBaseUrl()}`);
  return bot;
}

export function stopTelegramBot() {
  if (botInstance) {
    botInstance.stopPolling();
    botInstance = null;
  }
}

export function getBot() {
  return botInstance;
}
