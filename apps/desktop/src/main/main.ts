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
import { existsSync, appendFileSync, mkdirSync, promises as fsPromises } from 'fs'
import { spawn, ChildProcess } from 'child_process'
import http from 'http'


// Registra o AppUserModelId no Windows para agrupar e exibir a logo na Barra de Tarefas
if (process.platform === 'win32') {
  app.setAppUserModelId('com.mlab.classroom')
}

function logApp(msg: string): void {
  try {
    const logDir = join(app.getPath('userData'), 'logs')
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true })
    }
    const logFile = join(logDir, 'mlab-main.log')
    appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`)
  } catch {}
  console.log(msg)
}

process.on('uncaughtException', (err) => {
  logApp(`[UncaughtException] ${err.stack || err}`)
})

process.on('unhandledRejection', (reason) => {
  logApp(`[UnhandledRejection] ${reason}`)
})

function getAppIcon(): string | Electron.NativeImage {
  const icoPath = join(__dirname, '../../resources/icon.ico')
  const pngPath = join(__dirname, '../../resources/icon.png')
  const devIcoPath = join(process.cwd(), 'resources/icon.ico')
  const devPngPath = join(process.cwd(), 'resources/icon.png')

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
  logApp('[Main] createWindow iniciado...')
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

  // Garante que o ícone seja definido na janela de forma segura
  try {
    if (appIcon) {
      win.setIcon(appIcon)
    }
  } catch (err) {
    logApp(`[Main] Falha ao definir ícone da janela: ${err}`)
  }

  // Previne captura recursiva e oculta a janela e cursor do MLab ao compartilhar tela inteira (WDA_EXCLUDEFROMCAPTURE)
  try {
    win.setContentProtection(true)
  } catch (err) {
    logApp(`[Main] Falha ao ativar setContentProtection: ${err}`)
  }

  win.once('ready-to-show', () => {
    logApp('[Main] ready-to-show disparado: exibindo janela')
    win.show()
  })

  // Fallback garantido: caso ready-to-show atrase ou não dispare, abre a janela
  setTimeout(() => {
    if (!win.isDestroyed() && !win.isVisible()) {
      logApp('[Main] Fallback de exibição ativado: forçando win.show()')
      win.show()
    }
  }, 1500)

  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    logApp(`[Main WebContents DID-FAIL-LOAD] code=${errorCode}, desc=${errorDescription}, url=${validatedURL}`)
  })

  // Desenvolvimento: carrega do servidor Vite
  // Produção: carrega o HTML compilado
  if (process.env['ELECTRON_RENDERER_URL']) {
    logApp(`[Main] Carregando dev URL: ${process.env['ELECTRON_RENDERER_URL']}`)
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    const htmlPath = join(__dirname, '../renderer/index.html')
    logApp(`[Main] Carregando HTML de produção: ${htmlPath}`)
    win.loadFile(htmlPath).catch((err) => {
      logApp(`[Main] Erro fatal no win.loadFile: ${err}`)
    })
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
      const ext = format || 'webm'
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

// ── Backend Process Manager (Servidor Go SFU Invisível) ──────────────────────

let serverProcess: ChildProcess | null = null

function isPortInUse(port = 8080): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
      resolve(res.statusCode === 200)
    })
    req.on('error', () => {
      resolve(false)
    })
    req.setTimeout(500, () => {
      req.destroy()
      resolve(false)
    })
  })
}

function getBackendExecutablePath(): string | null {
  const binaryName = process.platform === 'win32' ? 'server.exe' : 'server'
  const isDev = !app.isPackaged

  const candidates = isDev
    ? [
        join(process.cwd(), '../backend/bin', binaryName),
        join(process.cwd(), '../../apps/backend/bin', binaryName),
        join(__dirname, '../../../../apps/backend/bin', binaryName),
        join(__dirname, '../../../backend/bin', binaryName),
        join(process.cwd(), 'apps/backend/bin', binaryName),
        'c:\\Users\\User\\Documents\\mlab\\apps\\backend\\bin\\server.exe'
      ]
    : [
        join(process.resourcesPath, 'bin', binaryName),
        join(process.resourcesPath, binaryName),
        join(__dirname, '../../resources/bin', binaryName),
        join(process.cwd(), 'resources/bin', binaryName)
      ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

async function startBackendServer(): Promise<void> {
  // Camada 1: Flag explícita do monorepo (propagada via turbo.json globalPassThroughEnv)
  if (process.env.MLAB_DEV_MONOREPO === '1') {
    console.log('[Backend] Ambiente Turborepo detectado (env): backend gerenciado externamente pelo @mlab/backend.')
    return
  }

  // Camada 2: Detecção por filesystem — se não empacotado E rodando sob electron-vite dev,
  // verificamos se turbo.json existe na raiz do monorepo. Se sim, o @mlab/backend já cuida do servidor.
  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    try {
      const monorepoRoot = join(__dirname, '../../../../')
      const turboPath = join(monorepoRoot, 'turbo.json')
      if (existsSync(turboPath)) {
        console.log('[Backend] Ambiente de desenvolvimento monorepo detectado (turbo.json): backend gerenciado externamente.')
        return
      }
    } catch {}
  }

  const inUse = await isPortInUse(8080)
  if (inUse) {
    console.log('[Backend] Servidor já detectado ativo na porta 8080. Nenhuma nova instância foi iniciada.')
    return
  }

  const binaryPath = getBackendExecutablePath()
  if (!binaryPath) {
    console.warn('[Backend] Executável do backend não encontrado. O app aguardará servidor externo na porta 8080.')
    return
  }

  console.log(`[Backend] Iniciando servidor em segundo plano de forma invisível: ${binaryPath}`)

  try {
    const webDir = app.isPackaged
      ? join(process.resourcesPath, 'web')
      : join(process.cwd(), '../web/dist')

    serverProcess = spawn(binaryPath, [], {
      cwd: app.getPath('userData'),
      detached: false,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PORT: '8080',
        WEB_PORT: '8080',
        WEB_DIR: webDir,
        JWT_SECRET: process.env['JWT_SECRET'] || 'dev-secret-key-12345'
      }
    })

    serverProcess.stdout?.on('data', (data: Buffer) => {
      const msg = data.toString().trim()
      logApp(`[Backend] ${msg}`)
      console.log(`[Backend] ${msg}`)
    })

    serverProcess.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString().trim()
      logApp(`[Backend ERR] ${msg}`)
      console.error(`[Backend ERR] ${msg}`)
    })

    serverProcess.on('error', (err) => {
      logApp(`[Backend] Falha ao iniciar processo do backend: ${err}`)
      console.error('[Backend] Falha ao iniciar processo do backend:', err)
      serverProcess = null
    })

    serverProcess.on('exit', (code, signal) => {
      logApp(`[Backend] Servidor finalizado (código: ${code}, sinal: ${signal})`)
      console.log(`[Backend] Servidor finalizado (código: ${code}, sinal: ${signal})`)
      serverProcess = null
    })
  } catch (err) {
    logApp(`[Backend] Erro ao disparar servidor: ${err}`)
    console.error('[Backend] Erro ao disparar servidor:', err)
  }
}

function stopBackendServer(): void {
  if (serverProcess && serverProcess.pid) {
    const pid = serverProcess.pid
    logApp(`[Backend] Encerrando processo do servidor (PID: ${pid})...`)
    console.log(`[Backend] Encerrando processo do servidor (PID: ${pid})...`)
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', pid.toString(), '/f', '/t'], {
          windowsHide: true,
          stdio: 'ignore'
        })
      } else {
        serverProcess.kill('SIGTERM')
      }
    } catch (err) {
      console.error('[Backend] Erro ao encerrar processo do servidor:', err)
    }
    serverProcess = null
  }
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  logApp('[Main] app.whenReady disparado. Configurando sessão e abrindo janela...')

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
    return (permission as string) === 'media' || (permission as string) === 'display-capture'
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
        logApp(`[Main] Erro no displayMediaRequestHandler: ${err}`)
        callback({ video: null as any })
      })
  })

  // 1. Cria a janela do professor IMEDIATAMENTE (sem travar à espera do servidor Go)
  createWindow()

  // 2. Inicia o servidor Go SFU invisível em segundo plano de forma assíncrona
  startBackendServer().catch((err) => {
    logApp(`[Backend] Erro ao iniciar servidor em background: ${err}`)
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  stopBackendServer()
})

app.on('will-quit', () => {
  stopBackendServer()
})

app.on('window-all-closed', () => {
  stopBackendServer()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

process.on('exit', () => {
  stopBackendServer()
})

