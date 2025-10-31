import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/

// Plugin to handle /app route before Vite's file system access
const handleAppRoute = () => {
  return {
    name: 'handle-app-route',
    enforce: 'pre',
    configureServer(server) {
      // Insert middleware at the very beginning
      const originalStack = server.middlewares.stack || []
      server.middlewares.stack = [
        {
          route: '',
          handle: (req, res, next) => {
            // Rewrite /app to /index.html for SPA routing
            if (req.url && /^\/app(\/|$|\?)/.test(req.url)) {
              req.url = '/index.html'
            }
            next()
          }
        },
        ...originalStack
      ]
    }
  }
}

export default defineConfig({
  plugins: [
    handleAppRoute(),
    react({
      fastRefresh: true,
      jsxRuntime: 'automatic'
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    },
    dedupe: ['react', 'react-dom']
  },
  server: {
    port: 5173,
    host: true,
    hmr: {
      overlay: false
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          xlsx: ['xlsx'],
          openai: ['openai']
        }
      }
    }
  },
})

