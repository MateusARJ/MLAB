import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { readFileSync } from 'fs'

// Metadados do produto para o "Sobre" do app (021/C-2105), lidos do package.json do desktop no build.
// A versão não entra aqui: o main usa app.getVersion() em tempo de execução.
const desktopPkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))
const appMeta = {
  name: desktopPkg.build.productName,
  description: desktopPkg.description,
  copyrightHolder: desktopPkg.author.name,
  buildYear: new Date().getFullYear()
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: {
      __MLAB_APP_META__: JSON.stringify(appMeta)
    },
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/main/main.ts')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/main/preload.ts')
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    server: {
      port: 5174
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer'),
        '@mlab/types': resolve(__dirname, '../../packages/types/src/index.ts')
      }
    },
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/renderer/index.html')
      }
    }
  }
})
