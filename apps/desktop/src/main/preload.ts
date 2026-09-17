import { contextBridge, ipcRenderer } from 'electron'
import type { CaptureSource, CaptureSourceType, RecordingFormat } from '@screenshare/types'

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
}

const api: ElectronAPI = {
  getScreenSources: (type) => ipcRenderer.invoke('get-screen-sources', type),
  saveRecordedVideo: (buffer, defaultName, format) =>
    ipcRenderer.invoke('save-recorded-video', { buffer, defaultName, format })
}

contextBridge.exposeInMainWorld('electronAPI', api)

// Tipo global disponível no renderer
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

