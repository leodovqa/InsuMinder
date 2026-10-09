import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import process from 'node:process'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const target = env.VITE_BACKEND_URL || 'http://localhost:5000'

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 5173,
      watch: {
        usePolling: true,
      },
      proxy: {
        '/api': {
          target,
          changeOrigin: true,
        },
      },
    },
  }
})
