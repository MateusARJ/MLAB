import {
  app,
  BrowserWindow,
  ipcMain,
  desktopCapturer,
  nativeImage,
  dialog,
  session,
  clipboard,
  shell
} from 'electron'
import { join } from 'path'
import { existsSync, appendFileSync, mkdirSync, chmodSync, promises as fsPromises } from 'fs'
import type { AnnotationSessionState } from '@mlab/types'
import { CursorPresenceTracker, type CursorTrackingTarget } from './cursorPresence'
import { AnnotationOverlayManager } from './annotationOverlayWindow'
import { resolveHostKey } from './hostKey'
import { hardenWebContents } from './navigationGuard'
import { buildAppInfo, type AppMeta } from './appInfo'
import { BackendManager, buildBackendEnv, createDefaultDeps } from './backendManager'

// Injetado pelo electron-vite no build do main (electron.vite.config.ts, 021/C-2105).
declare const __MLAB_APP_META__: AppMeta

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


// Registra o AppUserModelId no Windows para agrupar e exibir a logo na Barra de Tarefas.
// Edição MLab HTTPS (011, RF-1109): identificador próprio, igual ao appId do electron-builder.
if (process.platform === 'win32') {
  app.setAppUserModelId('com.mlab.classroom.https')
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

// ── Instância única (034/RF-3410) ─────────────────────────────────────────────
// Uma segunda abertura não cria janela nem backend: entrega o foco à janela existente.

let mainWindow: BrowserWindow | null = null
const hasSingleInstanceLock = app.requestSingleInstanceLock()

if (!hasSingleInstanceLock) {
  logApp('[Main] Outra instância do MLab já está aberta: esta instância será encerrada')
  app.quit()
} else {
  app.on('second-instance', () => {
    logApp('[Main] Segunda abertura do MLab: focando a janela existente')
    const win = mainWindow
    if (!win || win.isDestroyed()) return
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  })
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
      // Sandbox do renderer (002/S7): o preload só usa contextBridge e ipcRenderer.
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    },
    ...(process.platform === 'darwin' ? { titleBarStyle: 'hiddenInset' } : {}),
    show: false
  })
  mainWindow = win

  // Bloqueia navegação para fora do app e novas janelas; links web vão para o navegador do sistema (002/S7)
  hardenWebContents(win.webContents, (url) => shell.openExternal(url))

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

  // A janela principal é a única que mantém o app (034/C-3402): fechá-la libera o overlay de marcação e o
  // rastreador de cursor, que são janelas/recursos independentes e impediriam o window-all-closed (RF-3401).
  // No Windows/Linux o app encerra; no macOS segue no Dock com o backend vivo (C-3403).
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
    logApp('[Main] Janela principal fechada: encerrando overlay e rastreador de cursor')
    annotationOverlayManager.stop()
    cursorPresenceTracker.stop()
    if (process.platform !== 'darwin') {
      app.quit()
    }
  })

  // Logoff/desligamento do Windows: não há tempo para o encerramento assíncrono (034/RF-3403).
  win.on('session-end', () => {
    logApp('[Main] session-end: encerrando o backend de forma síncrona')
    backend.forceKillSync()
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

// ── IPC: escrita de texto na área de transferência (002/S7) ───────────────────
// Executada no main porque o módulo clipboard não está disponível em preload com sandbox.
ipcMain.handle('write-clipboard-text', (_event, text: unknown) => {
  if (typeof text !== 'string') {
    return false
  }
  try {
    clipboard.writeText(text)
    return true
  } catch {
    return false
  }
})

// ── IPC: chave de host para a sessão do professor (ADR 0006) ──────────────────
// Usada apenas no header X-MLab-Host-Key de POST /auth/session ao backend local.
ipcMain.handle('get-host-key', () => hostKey)

// ── IPC: informações do MLab para o rodapé e o "Sobre" (021, RF-2101/RF-2102) ─
// A versão vem do app em execução; nome, descrição e ano vêm do package.json no build (__MLAB_APP_META__).
ipcMain.handle('get-app-info', () => buildAppInfo(app.getVersion(), __MLAB_APP_META__))

// ── Gerenciamento da sala ativa para encerramento gracioso ao fechar o app ────

let activeRoom: { id: string; token?: string } | null = null

ipcMain.handle('set-active-room', (_event, room: { id: string; token?: string } | null) => {
  // Durante o encerramento a sala já foi (ou está sendo) encerrada: não reativa (034/RF-3403).
  if (room && shutdownPromise) {
    logApp(`[Main] activeRoom ignorada durante o encerramento: ${room.id}`)
    return
  }
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

// 017/RF-179: a janela do MLab informa a quantidade de mãos levantadas; o manager descarta o overlay e valores inválidos.
ipcMain.handle('annotation-overlay:raised-hands', (event, value: unknown) => {
  annotationOverlayManager.setRaisedHands(event.sender, value)
})

// 009/RF-902: só o renderer do overlay informa o retângulo da barra; o manager valida os valores.
ipcMain.handle('annotation-overlay:toolbar-rect', (event, rect: unknown) => {
  if (!annotationOverlayManager.isOverlayWebContents(event.sender)) return
  annotationOverlayManager.setToolbarRect(rect)
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

// Partida, encerramento e órfãos do backend ficam no BackendManager (034/T3402). Queda, travamento e reinício
// (053) são informados à janela do professor pelo canal backend:status (contrato ipc-backend-status.md).
const backend = new BackendManager(createDefaultDeps(logApp), (status) => {
  const win = mainWindow
  if (win && !win.isDestroyed()) {
    win.webContents.send('backend:status', status)
  }
})

function getBackendExecutablePath(): string | null {
  const isDev = !app.isPackaged
  // Nomes atuais (034/RF-3411) e, por último, os legados (até a 1.15.x), aceitos com aviso no log.
  const currentNames =
    process.platform === 'win32'
      ? ['mlab-backend.exe']
      : process.platform === 'darwin'
      ? ['mlab-backend-darwin', 'mlab-backend']
      : ['mlab-backend-linux', 'mlab-backend']
  const legacyNames =
    process.platform === 'win32'
      ? ['server.exe']
      : process.platform === 'darwin'
      ? ['server-darwin', 'server']
      : ['server-linux', 'server']

  const dirs = isDev
    ? [
        join(process.cwd(), '../backend/bin'),
        join(process.cwd(), '../../apps/backend/bin'),
        join(__dirname, '../../../../apps/backend/bin'),
        join(__dirname, '../../../backend/bin'),
        join(process.cwd(), 'apps/backend/bin')
      ]
    : [
        join(process.resourcesPath, 'bin'),
        process.resourcesPath,
        join(__dirname, '../../resources/bin'),
        join(process.cwd(), 'resources/bin')
      ]

  const find = (names: string[]): string | null => {
    for (const name of names) {
      for (const dir of dirs) {
        const candidate = join(dir, name)
        if (existsSync(candidate)) return candidate
      }
    }
    return null
  }

  const current = find(currentNames)
  if (current) return current
  const legacy = find(legacyNames)
  if (legacy) {
    logApp(`[Backend] Aviso: usando o binário com nome legado: ${legacy}`)
  }
  return legacy
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

  const binaryPath = getBackendExecutablePath()
  if (binaryPath && process.platform !== 'win32') {
    try {
      chmodSync(binaryPath, 0o755)
    } catch (err) {
      console.warn('[Backend] Aviso ao definir permissão de execução:', err)
    }
  }

  const webDir = app.isPackaged
    ? join(process.resourcesPath, 'web')
    : join(process.cwd(), '../web/dist')

  // Porta ocupada, corrida com o fechamento e stdin do watchdog: BackendManager (RF-3404, RF-3406, RF-3409).
  const result = await backend.start({
    binaryPath,
    cwd: app.getPath('userData'),
    env: buildBackendEnv({
      // Edição MLab HTTPS (ADR 0008, 011/RF-1109): CA local em <userData>/tls e HTTPS na 8443.
      base: { ...process.env, MLAB_TLS: '1', WEB_TLS_PORT: '8443' },
      webDir,
      parentPid: process.pid,
      // Log persistente do backend, ao lado do mlab-main.log (RF-3414).
      logFile: join(app.getPath('userData'), 'logs', 'mlab-backend.log')
    })
  })
  logApp(`[Backend] Resultado da partida: ${result}`)
}

// ── Procedimento único de encerramento (034/RF-3403, RF-3405) ────────────────

const SHUTDOWN_TIMEOUT_MS = 8000
let shutdownPromise: Promise<void> | null = null

/**
 * Encerra o app uma única vez: sala ativa (alunos avisados) → overlay e rastreador → backend → app.exit(0).
 * Estourando 8 s, encerra o backend de forma síncrona e sai mesmo assim.
 */
function shutdown(reason: string): Promise<void> {
  if (shutdownPromise) return shutdownPromise
  logApp(`[Main] Encerramento iniciado (motivo: ${reason})`)

  const timer = setTimeout(() => {
    logApp(`[Main] Encerramento excedeu ${SHUTDOWN_TIMEOUT_MS} ms: backend encerrado de forma síncrona`)
    backend.forceKillSync()
    app.exit(0)
  }, SHUTDOWN_TIMEOUT_MS)

  // Sem sala ativa o backend não é mais necessário: bloqueia já uma partida em andamento (RF-3406).
  if (!activeRoom) void backend.stop()

  const started = Date.now()
  const step = async (name: string, run: () => unknown): Promise<void> => {
    const t0 = Date.now()
    try {
      await run()
      logApp(`[Main] Encerramento: ${name} em ${Date.now() - t0} ms`)
    } catch (err) {
      logApp(`[Main] Encerramento: ${name} falhou após ${Date.now() - t0} ms: ${err}`)
    }
  }

  shutdownPromise = (async () => {
    await step('sala ativa', closeActiveRoomGracefully)
    await step('overlay e rastreador de cursor', () => {
      annotationOverlayManager.dispose()
      cursorPresenceTracker.dispose()
    })
    await step('backend', () => backend.stop())
  })().finally(() => {
    clearTimeout(timer)
    logApp(`[Main] Encerramento concluído em ${Date.now() - started} ms`)
    app.exit(0)
  })
  return shutdownPromise
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  // Sem a trava de instância única esta instância já está saindo: nem janela nem backend (RF-3410).
  if (!hasSingleInstanceLock) return
  logApp(`[Main] Partida do MLab ${app.getVersion()} (PID: ${process.pid}, plataforma: ${process.platform})`)
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

// Qualquer pedido de saída passa pelo procedimento único; ele termina com app.exit(0), que não reemite
// before-quit.
app.on('before-quit', (event) => {
  event.preventDefault()
  void shutdown('before-quit')
})

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))

// Redes de segurança síncronas: não há como aguardar nesses pontos.
app.on('will-quit', () => {
  annotationOverlayManager.dispose()
  cursorPresenceTracker.dispose()
  backend.forceKillSync()
})

// macOS: o app segue no Dock e o backend continua vivo para a próxima janela (activate); Cmd+Q passa pelo
// procedimento único (034/C-3403).
app.on('window-all-closed', () => {
  annotationOverlayManager.stop()
  cursorPresenceTracker.stop()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

process.on('exit', () => {
  annotationOverlayManager.dispose()
  cursorPresenceTracker.dispose()
  backend.forceKillSync()
})

