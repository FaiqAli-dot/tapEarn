import React from 'react'
import { motion } from 'framer-motion'
import { ExternalLink, Sparkles, Users, Wallet, Zap } from 'lucide-react'

const BOT_URL = 'https://t.me/YORZAEARNBOT'
const BOT_HANDLE = '@YORZAEARNBOT'

const features = [
  {
    icon: Zap,
    title: 'Earn YP daily',
    body: 'Tap, complete quests, and collect YORZA Points inside the Telegram Mini App.'
  },
  {
    icon: Users,
    title: 'Invite & grow',
    body: 'Share your referral link. Friends join on TON testnet — you earn when they subscribe.'
  },
  {
    icon: Wallet,
    title: 'TON wallet ready',
    body: 'Connect via TON Connect, verify ownership, and unlock subscription flows on testnet.'
  }
]

const MarketingHomePage: React.FC = () => {
  return (
    <div className="yorza-public min-h-screen text-white overflow-x-hidden">
      <div className="yorza-public__bg" aria-hidden />
      <div className="yorza-public__grid" aria-hidden />

      <header className="relative z-10 flex items-center justify-between px-5 sm:px-10 py-6 max-w-6xl mx-auto">
        <a href={BOT_URL} className="font-yorza-display text-xl tracking-[0.2em] text-yorza-gold">
          YORZA
        </a>
        <a
          href={BOT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-yorza-cyan/90 hover:text-yorza-cyan transition-colors"
        >
          {BOT_HANDLE}
        </a>
      </header>

      <section className="relative z-10 px-5 sm:px-10 pt-8 pb-20 sm:pt-16 sm:pb-28 max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-3xl"
        >
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.6 }}
            className="font-yorza-display text-5xl sm:text-7xl md:text-8xl tracking-[0.12em] text-yorza-gold mb-6"
          >
            YORZA
          </motion.p>
          <h1 className="font-yorza-body text-2xl sm:text-3xl md:text-4xl font-semibold text-white/95 leading-tight max-w-xl">
            The Telegram Mini App where taps, invites, and TON turn into YP.
          </h1>
          <p className="mt-5 text-base sm:text-lg text-white/60 max-w-lg leading-relaxed">
            Open inside Telegram. Earn points, run referrals on TON testnet, and grow with
            sponsored campaigns — all from {BOT_HANDLE}.
          </p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.5 }}
            className="mt-10 flex flex-wrap gap-4"
          >
            <a
              href={BOT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="yorza-cta inline-flex items-center gap-2 px-7 py-3.5 font-semibold text-black"
            >
              <Sparkles className="w-4 h-4" />
              Open {BOT_HANDLE}
              <ExternalLink className="w-4 h-4" />
            </a>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.45, duration: 0.8 }}
          className="yorza-orb mt-16 sm:mt-0 sm:absolute sm:right-10 sm:top-24 w-48 h-48 sm:w-72 sm:h-72 rounded-full pointer-events-none"
          aria-hidden
        />
      </section>

      <section className="relative z-10 px-5 sm:px-10 pb-24 max-w-6xl mx-auto">
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
          className="font-yorza-display text-sm tracking-[0.3em] text-yorza-cyan mb-10"
        >
          WHY YORZA
        </motion.h2>
        <div className="grid gap-10 sm:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: i * 0.1, duration: 0.45 }}
            >
              <f.icon className="w-7 h-7 text-yorza-gold mb-4" strokeWidth={1.5} />
              <h3 className="font-yorza-body text-lg font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-white/55 leading-relaxed">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10 px-5 sm:px-10 py-8 max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-white/40">
        <span className="font-yorza-display tracking-[0.2em] text-yorza-gold/70">YORZA</span>
        <a href={BOT_URL} target="_blank" rel="noopener noreferrer" className="hover:text-yorza-cyan transition-colors">
          Launch in Telegram → {BOT_HANDLE}
        </a>
      </footer>
    </div>
  )
}

export default MarketingHomePage
