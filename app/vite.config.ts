import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { quasar, transformAssetUrls } from '@quasar/vite-plugin'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    vue({ template: { transformAssetUrls } }),
    quasar({ sassVariables: false }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icon-192.png'],
      manifest: {
        name: 'Attestto — La App Soberana',
        short_name: 'Attestto',
        description: 'Identidad, credenciales, exámenes, firma digital y módulos — todo soberano, todo en tu dispositivo.',
        lang: 'es',
        theme_color: '#0f1923',
        background_color: '#0f1923',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
        screenshots: [
          { src: '/og-app.png', sizes: '1200x630', type: 'image/png', label: 'Attestto — pantalla principal' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler',
      },
    },
  },
})
