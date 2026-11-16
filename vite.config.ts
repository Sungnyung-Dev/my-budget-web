import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: '나의 가계부',
        short_name: '나의 가계부',
        description: '매일의 수입과 지출을 차곡차곡 기록하는 나만의 가계부',
        lang: 'ko',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          { src: '/icons/pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/pwa-maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // 빌드된 앱 리소스만 캐시합니다. API나 사용자 데이터는 캐시하지 않습니다.
        globPatterns: ['**/*.{js,css,html,woff2}'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [],
        navigateFallback: 'index.html',
        navigateFallbackAllowlist: [/^\/(?:index\.html)?(?:\?.*)?$/],
        navigateFallbackDenylist: [/^\/api(?:\/|$)/],
      },
      devOptions: { enabled: false },
    }),
  ],
})
