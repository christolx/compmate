/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // Only load proxy config from root .env; DB credentials stay server-side.
  const env = loadEnv(mode, fileURLToPath(new URL('../../', import.meta.url)), 'API_PROXY_TARGET');
  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: { '/api': process.env.API_PROXY_TARGET || env.API_PROXY_TARGET || 'http://127.0.0.1:8080' },
    },
    test: {
      environment: 'node',
    },
  };
});
