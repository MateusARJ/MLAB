import { contextBridge, ipcRenderer } from 'electron'
import type {
  AnnotationSessionState,
  AnnotationShortcutCommand,
  AnnotationToolbarRect,
  CaptureSource,
  CaptureSourceType,
  CursorState,
  RecordingFormat
} from '@mlab/types'

/**
 * Preload script — expõe APIs do Electron ao renderer de forma segura.
 *
 * REGRA: o renderer NUNCA acessa APIs do Node.js diretamente.
 * Toda comunicação com o main process ocorre exclusivamente via este bridge.
 */

export type ScreenSource = CaptureSource

export interface SaveRecordingResult {
  success: boolean
  cancelled?: boolean
  filePath?: string
  error?: string
}

export interface ElectronAPI {
  /**
   * Retorna a lista de telas e/ou janelas disponíveis para captura.
   * Internamente usa desktopCapturer.getSources() no main process.
   */
  getScreenSources: (type?: CaptureSourceType) => Promise<CaptureSource[]>

  /**
   * Salva a gravação local de vídeo da aula via diálogo nativo do SO.
   */
  saveRecordedVideo: (
    buffer: ArrayBuffer,
    defaultName?: string,
    format?: RecordingFormat
  ) => Promise<SaveRecordingResult>

  /**
   * Copia texto para a área de transferência do SO de forma nativa.
   */
  copyToClipboard: (text: string) => Promise<boolean>

  /**
   * Retorna a chave de host desta execução, usada somente no header X-MLab-Host-Key
   * de POST /auth/session ao backend local (ADR 0006).
   */
  getHostKey: () => Promise<string>

  /**
   * Registra ou desregistra a sala ativa atual no processo principal para encerramento automático ao fechar a janela.
   */
  setActiveRoom: (room: { id: string; token?: string } | null) => Promise<void>

  /**
   * Altera dinamicamente a proteção de conteúdo da janela (oculta o MLab na captura ao vivo).
   */
  setContentProtection: (enabled: boolean) => Promise<boolean>

  /**
   * Captura a janela do MLab e copia a imagem diretamente para a área de transferência do SO.
   */
  captureWindowToClipboard: () => Promise<boolean>

  /**
   * Inicia o rastreamento de presença e posição do cursor para ocultação contextual na transmissão.
   * Suporta também modo de múltiplas janelas via `allowedSourceIds`.
   */
  startCursorTracking: (target: {
    sourceId: string
    type: CaptureSourceType
    displayId?: string
    allowedSourceIds?: string[]
  }) => Promise<boolean>

  /**
   * Encerra o rastreamento de presença do cursor e de múltiplas janelas.
   */
  stopCursorTracking: () => Promise<void>

  /**
   * Inscreve um callback para ser notificado quando a janela ativa mudar entre as janelas autorizadas pelo professor.
   */
  onActiveWindowChanged: (cb: (data: { sourceId: string }) => void) => () => void

  /**
   * Inscreve um callback para ser notificado quando uma janela não autorizada estiver em primeiro plano.
   */
  onActiveWindowUnauthorized: (cb: (data: { isUnauthorized: boolean }) => void) => () => void

  /**
   * Inscreve um callback para receber atualizações de visibilidade e posição do cursor.
   */
  onCursorState: (cb: (state: CursorState) => void) => () => void

  /**
   * Inicia a janela de overlay transparente externa de marcação e lupa (invisível na captura dos alunos).
   */
  startAnnotationOverlay: () => Promise<boolean>

  /**
   * Encerra a janela de overlay transparente externa de marcação e lupa.
   */
  stopAnnotationOverlay: () => Promise<void>

  /**
   * Sincroniza o estado das marcações e da lupa entre a janela do MLab e o overlay externo.
   */
  syncAnnotationState: (state: AnnotationSessionState) => Promise<void>

  /**
   * Controla se os cliques de mouse devem atravessar o overlay externo (click-through) ou ser capturados para desenho/barra.
   */
  setAnnotationOverlayIgnoreMouse: (ignore: boolean) => Promise<void>

  /**
   * Informa ao main o retângulo da barra de marcação no overlay (ou null quando não deve capturar o mouse).
   * No Linux o main usa esse retângulo para tirar o overlay do click-through sob o ponteiro (009, RF-901/RF-902).
   */
  setAnnotationToolbarRect: (rect: AnnotationToolbarRect | null) => Promise<void>

  /**
   * Inscreve um callback para receber atualizações de estado da sessão de marcação e lupa.
   */
  onAnnotationStateSync: (cb: (state: AnnotationSessionState) => void) => () => void

  /**
   * Inscreve um callback para receber comandos de atalhos globais do SO (Alt+Shift+...).
   */
  onAnnotationShortcutCommand: (cb: (command: AnnotationShortcutCommand) => void) => () => void
}

const api: ElectronAPI = {
  getScreenSources: (type) => ipcRenderer.invoke('get-screen-sources', type),
  saveRecordedVideo: (buffer, defaultName, format) =>
    ipcRenderer.invoke('save-recorded-video', { buffer, defaultName, format }),
  getHostKey: () => ipcRenderer.invoke('get-host-key'),
  // A escrita é feita no processo principal: `clipboard` não existe em preload com sandbox (002/S7).
  copyToClipboard: (text: string) => ipcRenderer.invoke('write-clipboard-text', text),
  setActiveRoom: (room) => ipcRenderer.invoke('set-active-room', room),
  setContentProtection: (enabled: boolean) => ipcRenderer.invoke('set-content-protection', enabled),
  captureWindowToClipboard: () => ipcRenderer.invoke('capture-window-to-clipboard'),
  startCursorTracking: (target) => ipcRenderer.invoke('cursor-tracking:start', target),
  stopCursorTracking: () => ipcRenderer.invoke('cursor-tracking:stop'),
  onCursorState: (cb) => {
    const listener = (_event: unknown, state: CursorState) => {
      if (state && typeof cb === 'function') {
        cb(state)
      }
    }
    ipcRenderer.on('cursor-state', listener)
    return () => {
      ipcRenderer.removeListener('cursor-state', listener)
    }
  },
  startAnnotationOverlay: () => ipcRenderer.invoke('annotation-overlay:start'),
  stopAnnotationOverlay: () => ipcRenderer.invoke('annotation-overlay:stop'),
  syncAnnotationState: (state) => ipcRenderer.invoke('annotation-overlay:sync-state', state),
  setAnnotationOverlayIgnoreMouse: (ignore) =>
    ipcRenderer.invoke('annotation-overlay:set-ignore-mouse', ignore),
  setAnnotationToolbarRect: (rect) => ipcRenderer.invoke('annotation-overlay:toolbar-rect', rect),
  onAnnotationStateSync: (cb) => {
    const listener = (_event: unknown, state: AnnotationSessionState) => {
      if (state && typeof cb === 'function') {
        cb(state)
      }
    }
    ipcRenderer.on('annotation-overlay:state', listener)
    return () => {
      ipcRenderer.removeListener('annotation-overlay:state', listener)
    }
  },
  onAnnotationShortcutCommand: (cb) => {
    const listener = (_event: unknown, command: AnnotationShortcutCommand) => {
      if (command && typeof cb === 'function') {
        cb(command)
      }
    }
    ipcRenderer.on('annotation-overlay:shortcut', listener)
    return () => {
      ipcRenderer.removeListener('annotation-overlay:shortcut', listener)
    }
  },
  onActiveWindowChanged: (cb) => {
    const listener = (_event: unknown, data: { sourceId: string }) => {
      if (data && typeof cb === 'function') {
        cb(data)
      }
    }
    ipcRenderer.on('active-window-changed', listener)
    return () => {
      ipcRenderer.removeListener('active-window-changed', listener)
    }
  },
  onActiveWindowUnauthorized: (cb) => {
    const listener = (_event: unknown, data: { isUnauthorized: boolean }) => {
      if (data && typeof cb === 'function') {
        cb(data)
      }
    }
    ipcRenderer.on('active-window-unauthorized', listener)
    return () => {
      ipcRenderer.removeListener('active-window-unauthorized', listener)
    }
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)

// Tipo global disponível no renderer
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
