import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/admin/',
  plugins: [react()],
  build: {
    outDir: 'dist'
  },
  server: {
    port: 5173,
    proxy: {
      // Dev-only: avoids CORS by proxying admin requests to the bridge server.
      '/admin/api': {
        target: process.env.VITE_ADMIN_UI_PROXY_TARGET ?? 'http://127.0.0.1:8787',
        changeOrigin: true,
        secure: false
      },
      '/mcp': {
        target: process.env.VITE_ADMIN_UI_PROXY_TARGET ?? 'http://127.0.0.1:8787',
        changeOrigin: true,
        secure: false
      }
    }
  }
});
