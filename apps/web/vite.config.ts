import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// One manifest and one service worker for the whole application. The theme and
// background colors mirror the design-system brand and app-background tokens.
// They live here as literal values because a web app manifest cannot read CSS
// variables; the source of truth remains the tokens.
const BRAND = '#743930';
const APP_BACKGROUND = '#faf6f4';

// Where the dev server forwards /api to. It is read from the environment so the
// backend can run wherever you like: in docker compose on :8090, bare on :8080,
// or on another machine entirely: without editing this file.
//
// Development only. In production the app either shares an origin with the API,
// or points at it directly through VITE_API_BASE_URL, and no proxy is involved.
const DEFAULT_DEV_API_TARGET = 'http://localhost:8090';

export default defineConfig(({ mode }) => {
  // loadEnv reads .env, .env.local, and the mode-specific files from the app
  // directory, so the proxy target is configured the same way as everything else.
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const devApiTarget = env.VITE_DEV_API_PROXY_TARGET || DEFAULT_DEV_API_TARGET;

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'slideops-mark.svg', 'icon-180.png'],
        workbox: {
          // The API is never a navigation fallback; app shell routes are.
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              // Cache the read-only resource lists so History and cached views in
              // the operator area stay readable offline. NetworkFirst serves fresh
              // data when online and the last good response when unreachable.
              urlPattern: ({ url, request }: { url: URL; request: Request }) =>
                request.method === 'GET' &&
                (url.pathname.startsWith('/api/v1/operations') ||
                  url.pathname.startsWith('/api/v1/nodes') ||
                  url.pathname.startsWith('/api/v1/capabilities') ||
                  url.pathname.startsWith('/api/v1/projects')),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'slideops-api-read',
                networkTimeoutSeconds: 5,
                expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
        manifest: {
          name: 'SlideOps',
          short_name: 'SlideOps',
          description:
            'Discover, plan, approve, execute, and verify infrastructure Operations, in plain language.',
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
      port: Number(env.VITE_DEV_PORT) || 4321,
      // Forward API calls to the backend during development, so the single session
      // cookie stays same origin and none of the cross-origin machinery is needed
      // just to work locally. In production the app is served from the same origin
      // as the API, or points at it with VITE_API_BASE_URL.
      proxy: {
        '/api': {
          target: devApiTarget,
          changeOrigin: true,
          // Dev only: the app is proxied from the dev port to the API, so rewrite
          // the WebSocket Origin to the API origin, which the backend accepts.
          headers: { origin: devApiTarget },
          // Upgrade websocket connections too, so the /api/v1/stream event feed
          // works in development from the same origin as the session cookie.
          ws: true,
        },
      },
    },
  };
});
