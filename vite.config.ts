import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "node:url";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const appVersion = new Date()
  .toISOString()
  .replace(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}).*$/, '$1.$2.$3.$4$5');

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      // O registro é feito só por src/lib/pwa.ts (com proteções de preview/iframe).
      injectRegister: null,
      devOptions: { enabled: false },
      includeAssets: [
        'favicon.ico',
        'logo.png',
        'line-tape-brand-192.png',
        'line-tape-brand-512.png',
      ],

      manifest: {
        name: 'GESTAO LINE TAPE',
        short_name: 'GESTAO LINE TAPE',
        description: 'Sistema de gestão de locação e controle de estoque',
        theme_color: '#1a1a2e',
        background_color: '#1a1a2e',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/line-tape-brand-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/line-tape-brand-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/line-tape-brand-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        // Ativa a versão nova imediatamente: um SW antigo com cache corrompido
        // precisa ser substituído sem depender de o usuário ver o banner
        // (a tela em branco impedia qualquer interação).
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10 MB limit
        // Cache only the app shell. Large PDF/XLSX workers and lazy chunks are
        // fetched on demand instead of forcing a multi-megabyte first install.
        globPatterns: ['manifest.webmanifest', '**/*.{css,ico,png,svg,woff2}'],

        // index.html nunca é servido de cache: sempre rede primeiro.
        navigateFallback: null,
        runtimeCaching: [
          {
            // Toda gravação feita sem internet fica numa fila persistente do
            // Service Worker. O Workbox reenvia na mesma ordem quando a rede
            // voltar, mesmo após fechar e abrir o aplicativo.
            urlPattern: ({ url }) =>
              url.hostname.endsWith('.supabase.co') &&
              url.pathname.startsWith('/rest/v1/'),
            method: 'POST',
            handler: 'NetworkOnly',
            options: {
              cacheName: 'supabase-gravacoes',
              backgroundSync: {
                name: 'gestao-line-tape-post',
                options: { maxRetentionTime: 60 * 24 * 30 },
              },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.hostname.endsWith('.supabase.co') &&
              url.pathname.startsWith('/rest/v1/'),
            method: 'PATCH',
            handler: 'NetworkOnly',
            options: {
              cacheName: 'supabase-gravacoes',
              backgroundSync: {
                name: 'gestao-line-tape-patch',
                options: { maxRetentionTime: 60 * 24 * 30 },
              },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.hostname.endsWith('.supabase.co') &&
              url.pathname.startsWith('/rest/v1/'),
            method: 'DELETE',
            handler: 'NetworkOnly',
            options: {
              cacheName: 'supabase-gravacoes',
              backgroundSync: {
                name: 'gestao-line-tape-delete',
                options: { maxRetentionTime: 60 * 24 * 30 },
              },
            },
          },
          {
            // Mantém no aparelho as últimas consultas bem-sucedidas. Cada URL
            // conserva sua própria resposta e a rede sempre tem prioridade.
            urlPattern: ({ url, request }) =>
              request.method === 'GET' &&
              url.hostname.endsWith('.supabase.co') &&
              url.pathname.startsWith('/rest/v1/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-consultas',
              networkTimeoutSeconds: 5,
              cacheableResponse: { statuses: [0, 200, 206] },
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ url, request }) =>
              request.method === 'GET' &&
              url.hostname.endsWith('.supabase.co') &&
              url.pathname.startsWith('/storage/v1/object/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-anexos',
              cacheableResponse: { statuses: [0, 200, 206] },
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-navegacao',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            // Auth, Edge Functions e demais endpoints sensíveis continuam
            // sempre online. REST e anexos já foram tratados acima.
            urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co'),
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ sameOrigin, request }: { sameOrigin: boolean; request: Request }) =>
              sameOrigin && request.destination === 'script',
            handler: 'CacheFirst',
            options: {
              cacheName: 'assets-hash',
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
        navigateFallbackDenylist: [/^\/~oauth/],
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "./src"),
    },
  },
}));
