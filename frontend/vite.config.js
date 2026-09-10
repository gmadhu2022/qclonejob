import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      // Uploaded images are served by the backend too — without this the
      // browser asks Vite for /uploads/... and gets a 404, so images never show.
      '/uploads': 'http://localhost:8000',
    },
  }
})
