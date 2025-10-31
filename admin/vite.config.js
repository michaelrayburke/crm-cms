import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:4000'
    }
  }
});


// injected resolve.alias
import path from 'path';
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@utils': path.resolve(__dirname, 'src/utils'),
    },
  },
});
