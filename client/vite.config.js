import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy API calls to the Express backend during development.
    // This means /api/parse in the frontend hits http://localhost:5000/api/parse
    // without needing to hardcode the backend URL everywhere.
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
})
