import type { WebContents } from 'electron'

/**
 * Decide se uma URL pertence ao próprio app (002-security-hardening/S7):
 * - em produção, páginas `file://` empacotadas;
 * - em desenvolvimento, a mesma origem do servidor do electron-vite (`ELECTRON_RENDERER_URL`).
 */
export function isAppUrl(target: string, devRendererUrl?: string): boolean {
  let url: URL
  try {
    url = new URL(target)
  } catch {
    return false
  }
  if (url.protocol === 'file:') {
    return true
  }
  if (devRendererUrl) {
    try {
      return url.origin === new URL(devRendererUrl).origin
    } catch {
      return false
    }
  }
  return false
}

/** URLs que podem ser entregues ao navegador do sistema em vez de abertas dentro do app. */
export function isExternalWebUrl(target: string): boolean {
  try {
    const { protocol } = new URL(target)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Impede que a janela navegue para fora do app ou abra novas janelas Electron.
 * Links http/https são entregues ao navegador padrão do sistema via `openExternal`.
 */
export function hardenWebContents(
  contents: WebContents,
  openExternal: (url: string) => Promise<void> | void,
  devRendererUrl: string | undefined = process.env['ELECTRON_RENDERER_URL']
): void {
  contents.setWindowOpenHandler(({ url }) => {
    if (isExternalWebUrl(url) && !isAppUrl(url, devRendererUrl)) {
      void openExternal(url)
    }
    return { action: 'deny' }
  })

  contents.on('will-navigate', (event, url) => {
    if (isAppUrl(url, devRendererUrl)) {
      return
    }
    event.preventDefault()
    if (isExternalWebUrl(url)) {
      void openExternal(url)
    }
  })
}
