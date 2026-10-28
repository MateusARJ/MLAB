import { contextBridge, ipcRenderer, clipboard } from 'electron'
import type { CaptureSource, CaptureSourceType, CursorState, RecordingFormat } from '@mlab/types'

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
   * Verifica o status atual de permissões de mídia (microfone e tela) no SO.
   */
  checkMediaPermissions: () => Promise<{ microphone: string; screen: string }>

  /**
   * Solicita autorização de mídia ao Sistema Operacional.
   */
  requestMediaPermissions: () => Promise<{ microphone: boolean; screen: boolean }>

  /**
   * Copia texto para a área de transferência do SO de forma nativa.
   */
  copyToClipboard: (text: string) => Promise<boolean>

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
   */
  startCursorTracking: (target: {
    sourceId: string
    type: CaptureSourceType
    displayId?: string
  }) => Promise<boolean>

  /**
   * Encerra o rastreamento de presença do cursor.
   */
  stopCursorTracking: () => Promise<void>

  /**
   * Inscreve um callback para receber atualizações de visibilidade e posição do cursor.
   */
  onCursorState: (cb: (state: CursorState) => void) => () => void
}

const api: ElectronAPI = {
  getScreenSources: (type) => ipcRenderer.invoke('get-screen-sources', type),
  saveRecordedVideo: (buffer, defaultName, format) =>
    ipcRenderer.invoke('save-recorded-video', { buffer, defaultName, format }),
  checkMediaPermissions: () => ipcRenderer.invoke('check-media-permissions'),
  requestMediaPermissions: () => ipcRenderer.invoke('request-media-permissions'),
  copyToClipboard: (text: string) => {
    try {
      clipboard.writeText(text)
      return Promise.resolve(true)
    } catch {
      return Promise.resolve(false)
    }
  },
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
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)

// Tipo global disponível no renderer
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

