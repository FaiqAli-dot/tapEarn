import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, '..', 'dist')
const indexPath = path.join(distDir, 'index.html')
const notFoundPath = path.join(distDir, '404.html')

if (!fs.existsSync(indexPath)) {
  console.error('dist/index.html not found. Run npm run build:pages first.')
  process.exit(1)
}

fs.copyFileSync(indexPath, notFoundPath)
console.log('✅ Copied index.html → 404.html for GitHub Pages SPA routing')
