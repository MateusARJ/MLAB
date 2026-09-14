import { contextBridge, ipcRenderer } from 'electron'

/**
 * Preload script — expõe APIs do Electron ao renderer de forma segura.
 *
 * REGRA: o renderer NUNCA acessa APIs do Node.js diretamente.
 * Toda comunicação com o main process ocorre exclusivamente via este bridge.
 */

export interface ScreenSource {
  id: string
  name: string
  thumbnail: string // data URL
}

export interface ElectronAPI {
  /**
   * Retorna a lista de telas e janelas disponíveis para captura.
   * Internamente usa desktopCapturer.getSources() no main process.
   */
  getScreenSources: () => Promise<ScreenSource[]>
}

const api: ElectronAPI = {
  getScreenSources: () => ipcRenderer.invoke('get-screen-sources')
}

contextBridge.exposeInMainWorld('electronAPI', api)

// Tipo global disponível no renderer
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
