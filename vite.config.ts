import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'

const base = process.env.VITE_BASE ?? '/'

export default defineConfig({
  base,
  server: {
    host: true,
  },
  plugins: [
    svelte(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Coach Box (Jižní Supi)',
        short_name: 'Coach Box',
        description: 'Live zápis a analýza basketbalových zápasů - Jižní Supi',
        theme_color: '#1e3a8a',
        background_color: '#1e3a8a',
        display: 'standalone',
        // 'any' = mobil se točí volně (portrait i landscape); v portrait appka
        // nabídne hlášku 'otoč na šířku'. Na desktopu orientation nic nezamyká.
        orientation: 'any',
        scope: base,
        start_url: base,
        icons: [
          {
            src: 'logo-jizni-supi.png',
            sizes: '248x248',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
    }),
  ],
})
