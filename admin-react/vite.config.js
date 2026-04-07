import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const target = process.env.BUILD_TARGET || 'admin';

const configs = {
  admin: {
    base: '/panel/admin/',
    outDir: '../panel/admin',
    entry: 'admin.html',
  },
  user: {
    base: '/panel/user/',
    outDir: '../panel/user',
    entry: 'index.html',
  },
};

const cfg = configs[target];

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: cfg.base,
  build: {
    outDir: cfg.outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: cfg.entry,
    },
  },
  server: {
    port: target === 'admin' ? 5173 : 5174,
    proxy: {
      '/api': {
        target: 'https://www.imporlan.cl',
        changeOrigin: true,
      }
    }
  }
})
