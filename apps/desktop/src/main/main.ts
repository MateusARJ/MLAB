import { app, BrowserWindow, ipcMain, desktopCapturer, nativeImage, dialog } from 'electron'
import { join } from 'path'
import { existsSync, promises as fsPromises } from 'fs'

// Registra o AppUserModelId no Windows para agrupar e exibir a logo na Barra de Tarefas
if (process.platform === 'win32') {
  app.setAppUserModelId('com.mlab.classroom')
}

function getAppIcon(): string | Electron.NativeImage {
  const icoPath = join(__dirname, '../../resources/icon-dark.ico')
  const pngPath = join(__dirname, '../../resources/icon-dark.png')
  const devIcoPath = join(process.cwd(), 'resources/icon-dark.ico')
  const devPngPath = join(process.cwd(), 'resources/icon-dark.png')

  const candidates = process.platform === 'win32'
    ? [icoPath, devIcoPath, pngPath, devPngPath]
    : [pngPath, devPngPath, icoPath, devIcoPath]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      const img = nativeImage.createFromPath(candidate)
      if (!img.isEmpty()) {
        return img
      }
      return candidate
    }
  }
  return pngPath
}

function createWindow(): void {
  const appIcon = getAppIcon()

  const win = new BrowserWindow({
    title: 'MLab',
    icon: appIcon,
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    },
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' } : {}),
    show: false
  })

  // Garante que o ícone seja definido na janela (barra de título / menu) no Windows
  win.setIcon(appIcon)

  win.on('ready-to-show', () => {
    win.show()
  })

  // Desenvolvimento: carrega do servidor Vite
  // Produção: carrega o HTML compilado
  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ── IPC: desktopCapturer (acesso seguro via contextBridge) ────────────────────

ipcMain.handle('get-screen-sources', async (_event, type?: 'screen' | 'window') => {
  const types: ('screen' | 'window')[] = type ? [type] : ['screen', 'window']
  const sources = await desktopCapturer.getSources({
    types,
    thumbnailSize: { width: 320, height: 180 },
    fetchWindowIcons: true
  })

  return sources
    .filter((source) => {
      // No modo janela, ignora janelas internas sem título
      if (type === 'window' && (!source.name || source.name.trim() === '')) {
        return false
      }
      return true
    })
    .map((source) => ({
      id: source.id,
      name: source.name,
      thumbnail: source.thumbnail.toDataURL(),
      type: source.id.startsWith('screen') ? ('screen' as const) : ('window' as const)
    }))
})

// ── IPC: Gravação local de aula (salvamento em disco via diálogo nativo) ──────

ipcMain.handle(
  'save-recorded-video',
  async (
    _event,
    {
      buffer,
      defaultName,
      format = 'webm'
    }: {
      buffer: ArrayBuffer
      defaultName?: string
      format?: 'webm' | 'mp4'
    }
  ) => {
    try {
      const now = new Date()
      const dateStr = now.toISOString().slice(0, 10)
      const timeStr = now.toTimeString().slice(0, 5).replace(':', '')
      const ext = format === 'mp4' ? 'mp4' : 'webm'
      const suggestedName = defaultName || `aula-mlab-${dateStr}-${timeStr}.${ext}`

      const filters =
        format === 'mp4'
          ? [
              { name: 'Vídeo MP4 (*.mp4)', extensions: ['mp4'] },
              { name: 'Todos os Arquivos', extensions: ['*'] }
            ]
          : [
              { name: 'Vídeo WebM (*.webm)', extensions: ['webm'] },
              { name: 'Todos os Arquivos', extensions: ['*'] }
            ]

      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Salvar Gravação da Aula — MLab',
        defaultPath: suggestedName,
        filters
      })

      if (canceled || !filePath) {
        return { success: false, cancelled: true }
      }

      await fsPromises.writeFile(filePath, Buffer.from(buffer))
      return { success: true, filePath }
    } catch (err: any) {
      console.error('Erro ao salvar gravação:', err)
      return { success: false, error: err.message || 'Falha ao gravar arquivo em disco' }
    }
  }
)

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
