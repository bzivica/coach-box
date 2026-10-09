import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'
import { spawn, type ChildProcess } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const base = process.env.VITE_BASE ?? '/'
const projectDir = path.dirname(fileURLToPath(import.meta.url))

// Start the local CZ.BASKETBALL import API together with Vite in development.
// Without this process, /api requests fall back to Vite's HTML page and the UI
// reports the misleading "Unexpected end of JSON input" error.
function czBasketballImportServer() {
  let child: ChildProcess | undefined
  return {
    name: 'coach-box-cz-basketball-import-server',
    configureServer() {
      if (child) return
      child = spawn(process.execPath, [path.join(projectDir, 'server', 'cz-basketball-server.mjs')], {
        cwd: projectDir,
        stdio: 'inherit',
        env: { ...process.env },
      })
      child.on('error', (error) => {
        console.error('[Coach-Box] Nepodařilo se spustit server importu CZ.BASKETBALL:', error)
      })
      child.on('exit', (code) => {
        if (code && code !== 0) console.error(`[Coach-Box] Server importu skončil s kódem ${code}.`)
        child = undefined
      })
    },
    closeBundle() {
      child?.kill()
      child = undefined
    },
    configurePreviewServer() {
      // Production preview does not start this local development-only API.
    },
  }
}

export default defineConfig({
  base,
  server: {
    host: true,
    proxy: {
      '/api/cz-basketball': 'http://127.0.0.1:4179',
    },
  },
  plugins: [
    czBasketballImportServer(),
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
