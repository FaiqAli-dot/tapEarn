/**
 * Writes public/tonconnect-manifest.json before production builds.
 * Set VITE_APP_PUBLIC_URL (no trailing slash) e.g. https://faiqali-dot.github.io/tapEarn
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')

const publicUrl = (
  process.env.VITE_APP_PUBLIC_URL ||
  'https://faiqali-dot.github.io/tapEarn'
).replace(/\/$/, '')

const manifest = {
  url: publicUrl,
  name: 'TapEarn TON Game',
  iconUrl: `${publicUrl}/icon.png`,
  termsOfUseUrl: `${publicUrl}/`,
  privacyPolicyUrl: `${publicUrl}/`
}

const outPath = path.join(root, 'public', 'tonconnect-manifest.json')
fs.writeFileSync(outPath, JSON.stringify(manifest, null, 2) + '\n')
console.log(`✅ tonconnect-manifest.json → ${publicUrl}`)
