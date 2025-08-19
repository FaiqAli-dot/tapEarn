import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ton: ['@tonconnect/ui', '@tonconnect/sdk', 'ton'],
        },
      },
    },
  },
  server: {
    port: 3000,
    host: true,
  },
  define: {
    global: 'globalThis',
  },
})
