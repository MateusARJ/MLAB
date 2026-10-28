import { defineConfig, createLogger } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

const customLogger = createLogger()
const loggerError = customLogger.error.bind(customLogger)
customLogger.error = (msg, options) => {
  if (typeof msg === 'string' && (msg.includes('ECONNABORTED') || msg.includes('ECONNRESET'))) {
    return
  }
  loggerError(msg, options)
}

export default defineConfig({
  customLogger,
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
    allowedHosts: true,
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
  },
  preview: {
    host: true,
    port: 5173,
    allowedHosts: true
  }
})
