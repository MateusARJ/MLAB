import {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  nativeImage,
  dialog,
  session,
  systemPreferences
} from 'electron'
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

function getPreloadPath(): string {
  const candidates = [
    join(__dirname, '../preload/preload.js'),
    join(__dirname, '../preload/index.js'),
    join(__dirname, 'preload.js')
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }
  return join(__dirname, '../preload/preload.js')
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
      preload: getPreloadPath(),
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
  try {
    const types: ('screen' | 'window')[] = type ? [type] : ['screen', 'window']
    const sources = await desktopCapturer.getSources({
      types,
      thumbnailSize: { width: 1280, height: 720 },
      fetchWindowIcons: types.includes('window')
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
  } catch (err) {
    console.error('Erro ao listar fontes no desktopCapturer:', err)
    return []
  }
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
      format?: 'webm'
    }
  ) => {
    try {
      const now = new Date()
      const dateStr = now.toISOString().slice(0, 10)
      const timeStr = now.toTimeString().slice(0, 5).replace(':', '')
      const ext = 'webm'
      const suggestedName = defaultName || `aula-mlab-${dateStr}-${timeStr}.${ext}`

      const filters = [
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

// ── IPC: Verificação e solicitação de permissões de SO (Microfone e Tela) ─────

ipcMain.handle('check-media-permissions', async () => {
  let micStatus = 'granted'
  let screenStatus = 'granted'

  try {
    if (process.platform === 'darwin' || process.platform === 'win32') {
      if (typeof systemPreferences.getMediaAccessStatus === 'function') {
        micStatus = systemPreferences.getMediaAccessStatus('microphone')
        screenStatus = systemPreferences.getMediaAccessStatus('screen')
      }
    }
  } catch (err) {
    console.warn('Falha ao consultar getMediaAccessStatus:', err)
  }

  return {
    microphone: micStatus,
    screen: screenStatus
  }
})

ipcMain.handle('request-media-permissions', async () => {
  let micGranted = true
  try {
    if (process.platform === 'darwin' && typeof systemPreferences.askForMediaAccess === 'function') {
      micGranted = await systemPreferences.askForMediaAccess('microphone')
    }
  } catch (err) {
    console.warn('Falha ao solicitar permissão de microfone:', err)
    micGranted = false
  }

  return {
    microphone: micGranted,
    screen: true
  }
})

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Configuração explícita de permissões do Chromium para captura e áudio
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ['media', 'display-capture', 'mediaKeySystem', 'notifications']
    if (allowed.includes(permission)) {
      callback(true)
    } else {
      callback(false)
    }
  })

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => {
    return permission === 'media' || permission === 'display-capture'
  })

  session.defaultSession.setDisplayMediaRequestHandler((_request, callback) => {
    desktopCapturer
      .getSources({ types: ['screen', 'window'] })
      .then((sources) => {
        if (sources.length > 0) {
          callback({ video: sources[0] })
        } else {
          callback({ video: null as any })
        }
      })
      .catch((err) => {
        console.error('Erro no displayMediaRequestHandler:', err)
        callback({ video: null as any })
      })
  })

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
