import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@mlab/types': resolve(__dirname, '../../packages/types/src/index.ts')
    }
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/rooms': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/auth': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err: any) => {
            // Ignora erros transitórios de socket abortado em reload/desconexão
            if (err.code === 'ECONNABORTED' || err.code === 'ECONNRESET') {
              return;
            }
            console.warn('[vite] ws proxy error:', err.message);
          });
        }
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
