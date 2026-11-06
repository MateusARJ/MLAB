/**
 * HTTPS na LAN (edição MLab HTTPS — ADR 0008, feature 011, contrato 011/tls.md).
 */

export interface TlsInfo {
  enabled: boolean
  port?: string
  fingerprint?: string
  fingerprint_sha256?: string
  ca_url?: string
}

export type Platform = 'windows' | 'android' | 'ios' | 'macos' | 'linux' | 'chromeos' | 'other'

/** Consulta GET /tls/info no mesmo servidor. Qualquer falha devolve null (o app segue como hoje — RF-1106). */
export async function fetchTlsInfo(): Promise<TlsInfo | null> {
  try {
    const resp = await fetch('/tls/info', { cache: 'no-store' })
    if (!resp.ok) return null
    const data = (await resp.json()) as TlsInfo
    return typeof data?.enabled === 'boolean' ? data : null
  } catch {
    return null
  }
}

/** URL HTTPS equivalente à página atual, na porta TLS (mesmo caminho, query e hash). */
export function httpsUrlFor(
  loc: Pick<Location, 'hostname' | 'pathname' | 'search' | 'hash'>,
  port: string,
): string {
  const host = loc.hostname.includes(':') && !loc.hostname.startsWith('[') ? `[${loc.hostname}]` : loc.hostname
  const portPart = port && port !== '443' ? `:${port}` : ''
  return `https://${host}${portPart}${loc.pathname}${loc.search}${loc.hash}`
}

/**
 * Testa se o aparelho já confia na CA do MLab: GET https://<host>:<port>/tls/ok.
 * Erro de certificado, rede ou tempo esgotado = não confia.
 */
export async function probeHttps(hostname: string, port: string, timeoutMs = 4000): Promise<boolean> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null
  try {
    const url = httpsUrlFor({ hostname, pathname: '/tls/ok', search: '', hash: '' }, port)
    const resp = await fetch(url, { cache: 'no-store', signal: controller?.signal })
    if (!resp.ok) return false
    const data = await resp.json().catch(() => null)
    return data?.ok === true
  } catch {
    return false
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Detecta o sistema do aparelho para mostrar o passo a passo certo (RF-1107). */
export function detectPlatform(ua: string, maxTouchPoints = 0): Platform {
  const s = ua.toLowerCase()
  if (/android/.test(s)) return 'android'
  if (/iphone|ipad|ipod/.test(s)) return 'ios'
  // iPadOS se apresenta como Mac, mas tem tela de toque.
  if (/macintosh|mac os x/.test(s)) return maxTouchPoints > 1 ? 'ios' : 'macos'
  if (/cros/.test(s)) return 'chromeos'
  if (/windows/.test(s)) return 'windows'
  if (/linux|x11/.test(s)) return 'linux'
  return 'other'
}

export function isFirefox(ua: string): boolean {
  return /firefox|fxios/i.test(ua)
}
