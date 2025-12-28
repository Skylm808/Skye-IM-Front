import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/v1/friend': {
        target: 'http://localhost:10200',
        changeOrigin: true,
      },
      '/api/v1/user': {
        target: 'http://localhost:10100',
        changeOrigin: true,
      },
      '/api/v1/auth': {
        target: 'http://localhost:10000',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
      },
    },
  },
})
