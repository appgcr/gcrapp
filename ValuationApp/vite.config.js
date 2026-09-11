import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    cors: true,
    watch: {
      ignored: ['**/android/**', '**/android/build/**', '**/.gradle/**', '**/node_modules/**']
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Security-Policy': "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval' blob:; script-src-elem * 'unsafe-inline' 'unsafe-eval' blob:; connect-src * 'unsafe-inline' blob: data: ws: wss:; img-src * data: blob:; style-src * 'unsafe-inline';"
    }
  }
})
