import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['@ffmpeg/ffmpeg', '@ffmpeg/util'],
  },
  build: {
    commonjsOptions: {
      include: [/node_modules/],
    },
    // Support WebAssembly
    target: 'esnext',
  },
  // Configure headers for cross-origin isolation (needed for SharedArrayBuffer in WASM)
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
})
