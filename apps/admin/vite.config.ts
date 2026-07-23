import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Literal values mirror the design-system brand and app-background tokens; a web
// app manifest cannot read CSS variables. The tokens remain the source of truth.
const BRAND = '#743930';
const APP_BACKGROUND = '#faf6f4';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'slideops-mark.svg', 'icon-180.png'],
      manifest: {
        name: 'SlideOps Admin',
        short_name: 'SlideOps Admin',
        description: 'Oversight, analytics, and emergency controls for the SlideOps platform.',
        theme_color: BRAND,
        background_color: APP_BACKGROUND,
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    port: 4323,
    // Forward API calls to the backend during development so the session cookie
    // is same origin. In production the app is served from the same origin as
    // the API, so no proxy is needed there.
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
});
