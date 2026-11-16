import type { WebContents } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'

/**
 * URL `file://` do `index.html` empacotado do renderer. É o mesmo caminho carregado pela janela principal
 * (`main.ts`) e pelo overlay de marcação (`annotationOverlayWindow.ts`); o guard é empacotado no mesmo
 * `out/main/main.js`, então o `__dirname` coincide (018-arquivos-arrastar, RNF-181).
 */
export function defaultAppIndexUrl(): string {
  return pathToFileURL(join(__dirname, '../renderer/index.html')).href
}

function normalizedFilePath(url: URL, caseInsensitive: boolean): string {
  let path = url.pathname
  try {
    path = decodeURIComponent(path)
  } catch {
    // mantém o pathname bruto se a codificação for inválida
  }
  return caseInsensitive ? path.toLowerCase() : path
}

/**
 * Decide se uma URL pertence ao próprio app (002-security-hardening/S7; 018-arquivos-arrastar/RNF-181):
 * - em produção, só o `index.html` empacotado (`appIndexUrl`), com qualquer query ou hash. Qualquer outro
 *   `file://` (ex.: um arquivo solto na janela) é recusado, assim como `file:` sem `appIndexUrl`;
 * - em desenvolvimento, a mesma origem do servidor do electron-vite (`ELECTRON_RENDERER_URL`).
 */
export function isAppUrl(
  target: string,
  devRendererUrl?: string,
  appIndexUrl?: string,
  caseInsensitive: boolean = process.platform === 'win32'
): boolean {
  let url: URL
  try {
    url = new URL(target)
  } catch {
    return false
  }
  if (url.protocol === 'file:') {
    if (!appIndexUrl) {
      return false
    }
    let appUrl: URL
    try {
      appUrl = new URL(appIndexUrl)
    } catch {
      return false
    }
    if (appUrl.protocol !== 'file:') {
      return false
    }
    const sameHost = caseInsensitive
      ? url.host.toLowerCase() === appUrl.host.toLowerCase()
      : url.host === appUrl.host
    return sameHost && normalizedFilePath(url, caseInsensitive) === normalizedFilePath(appUrl, caseInsensitive)
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
  devRendererUrl: string | undefined = process.env['ELECTRON_RENDERER_URL'],
  appIndexUrl: string = defaultAppIndexUrl()
): void {
  contents.setWindowOpenHandler(({ url }) => {
    if (isExternalWebUrl(url) && !isAppUrl(url, devRendererUrl, appIndexUrl)) {
      void openExternal(url)
    }
    return { action: 'deny' }
  })

  contents.on('will-navigate', (event, url) => {
    if (isAppUrl(url, devRendererUrl, appIndexUrl)) {
      return
    }
    event.preventDefault()
    if (isExternalWebUrl(url)) {
      void openExternal(url)
    }
  })
}
