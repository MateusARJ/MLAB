import {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  nativeImage,
  dialog,
  session,
  systemPreferences,
  clipboard
} from 'electron'
import { join } from 'path'
import { existsSync, appendFileSync, mkdirSync, chmodSync, promises as fsPromises } from 'fs'
import { spawn, ChildProcess } from 'child_process'
import http from 'http'
import type { AnnotationSessionState } from '@mlab/types'
import { CursorPresenceTracker, type CursorTrackingTarget } from './cursorPresence'
import { AnnotationOverlayManager } from './annotationOverlayWindow'
import { resolveHostKey } from './hostKey'

// Chave de host desta execução (ADR 0006). Resolvida antes de iniciar o backend embarcado,
// que a herda via process.env; o renderer a obtém pelo IPC 'get-host-key'.
const hostKey = resolveHostKey(process.env)

const cursorPresenceTracker = new CursorPresenceTracker()
const annotationOverlayManager = new AnnotationOverlayManager()

cursorPresenceTracker.setStateListener((state) => {
  annotationOverlayManager.forwardCursorState(state)
})

// Impede que o Chromium reduza a prioridade de captura/codificação quando o MLab está em segundo plano
app.commandLine.appendSwitch('disable-renderer-backgrounding')
app.commandLine.appendSwitch('disable-background-timer-throttling')
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows')
app.commandLine.appendSwitch(
  'disable-features',
  'CalculateNativeWinOcclusion,IntensiveWakeUpThrottling,MacAllowBackgroundingRenderProcesses'
)
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('enable-features', 'AllowWgcWindowCapturer,AllowWgcScreenCapturer')
} else if (process.platform === 'darwin') {
  app.commandLine.appendSwitch(
    'enable-features',
    'ScreenCaptureKitMac,ScreenCaptureKitMacWindow,ScreenCaptureKitStreamPickerSonoma'
  )
}


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
  logApp('[Main] createWindow iniciado...')
  const appIcon = getAppIcon()
  if (process.platform === 'darwin' && app.dock && appIcon) {
    app.dock.setIcon(appIcon)
  }
  
  // Ícone transparente de 1x1 pixel para manter a barra nativa do Windows sem logo
  const transparentIcon = nativeImage.createFromBuffer(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64'
    )
  )

  const win = new BrowserWindow({
    title: ' ',
    icon: transparentIcon,
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: getPreloadPath(),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    },
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' } : {}),
    show: false
  })

  // Previne que tags <title> do HTML exibam texto na barra de título nativa
  win.on('page-title-updated', (event) => {
    event.preventDefault()
  })

  // Mantém a titlebar nativa sem logo visível
  try {
    win.setIcon(transparentIcon)
  } catch (err) {
    logApp(`[Main] Falha ao definir ícone da janela: ${err}`)
  }

  // Inicia com proteção desativada para permitir prints nativos fora da transmissão (Win+Shift+S, PrtScn)
  try {
    win.setContentProtection(false)
  } catch (err) {
    logApp(`[Main] Falha ao configurar setContentProtection inicial: ${err}`)
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

  // Encerramento gracioso ao clicar no 'X' da janela: notifica alunos se houver sala ativa
  let isWindowClosing = false
  win.on('close', async (event) => {
    if (isWindowClosing) return

    if (activeRoom && activeRoom.id) {
      event.preventDefault()
      isWindowClosing = true
      await closeActiveRoomGracefully()
      if (!win.isDestroyed()) {
        win.destroy()
      }
    }
  })

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

ipcMain.handle('get-screen-sources', async (event, type?: 'screen' | 'window') => {
  try {
    const types: ('screen' | 'window')[] = type ? [type] : ['screen', 'window']
    const selfWin = BrowserWindow.fromWebContents(event.sender)
    if (activeRoom && selfWin && !selfWin.isDestroyed()) {
      try {
        selfWin.setContentProtection(true)
      } catch {}
    }
    const selfMediaSourceId =
      selfWin && typeof selfWin.getMediaSourceId === 'function' ? selfWin.getMediaSourceId() : null
    const overlayMediaSourceId = annotationOverlayManager.getMediaSourceId()

    const sources = await desktopCapturer.getSources({
      types,
      thumbnailSize: { width: 480, height: 270 },
      fetchWindowIcons: types.includes('window')
    })

    return sources
      .filter((source) => {
        // Exclui a própria janela do MLab e o overlay de anotação para evitar espelho infinito
        if (selfMediaSourceId && source.id === selfMediaSourceId) {
          return false
        }
        if (overlayMediaSourceId && source.id === overlayMediaSourceId) {
          return false
        }
        if (source.name === 'MLab Annotation Overlay') {
          return false
        }
        return true
      })
      .map((source) => {
        let cleanName = source.name ? source.name.trim() : ''
        if (!cleanName) {
          cleanName = source.id.startsWith('screen') ? 'Tela Inteira' : 'Janela do Aplicativo'
        }
        return {
          id: source.id,
          name: cleanName,
          thumbnail: source.thumbnail.toDataURL(),
          type: source.id.startsWith('screen') ? ('screen' as const) : ('window' as const),
          displayId: source.display_id || undefined
        }
      })
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

// ── IPC: chave de host para a sessão do professor (ADR 0006) ──────────────────
// Usada apenas no header X-MLab-Host-Key de POST /auth/session ao backend local.
ipcMain.handle('get-host-key', () => hostKey)

// ── Gerenciamento da sala ativa para encerramento gracioso ao fechar o app ────

let activeRoom: { id: string; token?: string } | null = null

ipcMain.handle('set-active-room', (_event, room: { id: string; token?: string } | null) => {
  activeRoom = room
  if (!room) {
    annotationOverlayManager.stop()
  }
  logApp(`[Main] activeRoom atualizada: ${room ? room.id : 'nenhuma'}`)
})

ipcMain.handle('set-content-protection', (event, enabled: boolean) => {
  const targetWin = BrowserWindow.fromWebContents(event.sender)
  if (targetWin && !targetWin.isDestroyed()) {
    try {
      targetWin.setContentProtection(enabled)
      logApp(`[Main] setContentProtection alterado dinamicamente para: ${enabled}`)
      return true
    } catch (err) {
      logApp(`[Main] Erro ao alterar setContentProtection: ${err}`)
      return false
    }
  }
  return false
})

ipcMain.handle('capture-window-to-clipboard', async (event) => {
  const targetWin = BrowserWindow.fromWebContents(event.sender)
  if (!targetWin || targetWin.isDestroyed()) return false
  try {
    const img = await targetWin.webContents.capturePage()
    clipboard.writeImage(img)
    logApp('[Main] Captura da janela salva na área de transferência com sucesso')
    return true
  } catch (err) {
    logApp(`[Main] Erro ao capturar janela para clipboard: ${err}`)
    return false
  }
})

ipcMain.handle('cursor-tracking:start', (event, target: CursorTrackingTarget) => {
  const targetWin = BrowserWindow.fromWebContents(event.sender)
  if (!targetWin || targetWin.isDestroyed() || !target || !target.sourceId) {
    return false
  }
  return cursorPresenceTracker.start(targetWin, target)
})

ipcMain.handle('cursor-tracking:stop', () => {
  cursorPresenceTracker.stop()
})

ipcMain.handle('annotation-overlay:start', (event) => {
  const targetWin = BrowserWindow.fromWebContents(event.sender)
  if (!targetWin || targetWin.isDestroyed()) {
    return false
  }
  return annotationOverlayManager.start(targetWin, getPreloadPath())
})

ipcMain.handle('annotation-overlay:stop', () => {
  annotationOverlayManager.stop()
})

ipcMain.handle('annotation-overlay:sync-state', (event, state: AnnotationSessionState) => {
  if (state) {
    annotationOverlayManager.syncState(event.sender, state)
  }
})

ipcMain.handle('annotation-overlay:set-ignore-mouse', (_event, ignore: boolean) => {
  annotationOverlayManager.setIgnoreMouseEvents(Boolean(ignore))
})

async function closeActiveRoomGracefully(): Promise<void> {
  if (!activeRoom || !activeRoom.id) return

  const roomToClose = activeRoom
  activeRoom = null

  logApp(`[Main] Encerrando sala ativa (${roomToClose.id}) antes de finalizar o aplicativo...`)

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (roomToClose.token) {
      headers['Authorization'] = `Bearer ${roomToClose.token}`
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 1200)

    await fetch(`http://127.0.0.1:8080/rooms/${roomToClose.id}/close`, {
      method: 'POST',
      headers,
      signal: controller.signal
    }).catch((err) => {
      logApp(`[Main] Aviso ao enviar closeRoom na saída: ${err}`)
    })
    clearTimeout(timer)
  } catch (err) {
    logApp(`[Main] Erro ao disparar closeRoom na saída: ${err}`)
  }

  // Aguarda 400ms para permitir que os frames WebSocket cheguem aos alunos conectados
  await new Promise((resolve) => setTimeout(resolve, 400))
}

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
  const isDev = !app.isPackaged
  const platformBin =
    process.platform === 'win32'
      ? 'server.exe'
      : process.platform === 'darwin'
      ? 'server-darwin'
      : 'server-linux'
  const genericBin = process.platform === 'win32' ? 'server.exe' : 'server'

  const binaryNames = platformBin === genericBin ? [genericBin] : [platformBin, genericBin]

  const candidates: string[] = []

  if (isDev) {
    const devDirs = [
      join(process.cwd(), '../backend/bin'),
      join(process.cwd(), '../../apps/backend/bin'),
      join(__dirname, '../../../../apps/backend/bin'),
      join(__dirname, '../../../backend/bin'),
      join(process.cwd(), 'apps/backend/bin')
    ]
    for (const dir of devDirs) {
      for (const b of binaryNames) {
        candidates.push(join(dir, b))
      }
    }
    if (process.platform === 'win32') {
      candidates.push('c:\\Users\\User\\Documents\\mlab\\apps\\backend\\bin\\server.exe')
    }
  } else {
    for (const b of binaryNames) {
      candidates.push(join(process.resourcesPath, 'bin', b))
      candidates.push(join(process.resourcesPath, b))
      candidates.push(join(__dirname, '../../resources/bin', b))
      candidates.push(join(process.cwd(), 'resources/bin', b))
    }
  }

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

  if (process.platform !== 'win32') {
    try {
      chmodSync(binaryPath, 0o755)
    } catch (err) {
      console.warn('[Backend] Aviso ao definir permissão de execução:', err)
    }
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
        // JWT_SECRET só é repassado se vier do ambiente (via ...process.env);
        // caso contrário o backend gera um segredo aleatório por execução (ADR 0006).
        WEB_DIR: webDir
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

let isAppQuitting = false

app.on('before-quit', async (event) => {
  if (isAppQuitting) {
    stopBackendServer()
    return
  }

  if (activeRoom && activeRoom.id) {
    event.preventDefault()
    isAppQuitting = true
    await closeActiveRoomGracefully()
    stopBackendServer()
    app.quit()
  } else {
    stopBackendServer()
  }
})

app.on('will-quit', () => {
  annotationOverlayManager.dispose()
  cursorPresenceTracker.dispose()
  stopBackendServer()
})

app.on('window-all-closed', () => {
  annotationOverlayManager.stop()
  cursorPresenceTracker.stop()
  stopBackendServer()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

process.on('exit', () => {
  annotationOverlayManager.dispose()
  cursorPresenceTracker.dispose()
  stopBackendServer()
})

