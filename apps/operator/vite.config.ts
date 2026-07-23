import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// The manifest theme and background colors mirror the design-system brand and
// app-background tokens. They live here as literal values because a web app
// manifest cannot read CSS variables; the source of truth remains the tokens.
const BRAND = '#743930';
const APP_BACKGROUND = '#faf6f4';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'slideops-mark.svg', 'icon-180.png'],
      manifest: {
        name: 'SlideOps Operator',
        short_name: 'SlideOps',
        description: 'Discover, plan, approve, execute, and verify infrastructure Operations.',
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
    port: 4322,
  },
});
