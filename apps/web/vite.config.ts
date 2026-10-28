import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3001,
    strictPort: true,
    // The phone opens this dev server through a Cloudflare quick tunnel. Vite
    // rejects unknown Host headers by default (403), which reads as "site down"
    // on the phone. Only tunnel hostnames are added, not every host.
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true
      }
    }
  },
  // The built app is what a phone opens through the tunnel: the dev module graph
  // is too heavy to load over a quick tunnel.
  preview: {
    port: 4173,
    strictPort: true,
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true
      }
    }
  }
})
