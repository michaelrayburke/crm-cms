// admin/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
      '@utils': '/src/utils'
    }
  },
  build: {
    sourcemap: false
  }
})
