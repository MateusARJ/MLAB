import { describe, it, expect, vi, afterEach } from 'vitest'
import { detectPlatform, fetchTlsInfo, httpsUrlFor, isFirefox, probeHttps } from './tls'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('tls service (011)', () => {
  it('httpsUrlFor mantém caminho, query e hash na porta TLS', () => {
    expect(
      httpsUrlFor({ hostname: '192.168.1.108', pathname: '/sala/x/entrar', search: '?a=1', hash: '#h' }, '8443'),
    ).toBe('https://192.168.1.108:8443/sala/x/entrar?a=1#h')
    expect(httpsUrlFor({ hostname: 'mlab.local', pathname: '/', search: '', hash: '' }, '443')).toBe(
      'https://mlab.local/',
    )
    expect(httpsUrlFor({ hostname: 'fe80::1', pathname: '/', search: '', hash: '' }, '8443')).toBe(
      'https://[fe80::1]:8443/',
    )
  })

  it('fetchTlsInfo devolve a resposta válida e null em erro', async () => {
    const info = { enabled: true, port: '8443', fingerprint: 'A1B2 C3D4 E5F6 0718', ca_url: '/mlab-ca.crt' }
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response(JSON.stringify(info), { status: 200 }))
    await expect(fetchTlsInfo()).resolves.toEqual(info)

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('nao', { status: 404 }))
    await expect(fetchTlsInfo()).resolves.toBeNull()

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('rede'))
    await expect(fetchTlsInfo()).resolves.toBeNull()
  })

  it('probeHttps só é verdadeiro com {"ok":true} em https', async () => {
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }))
    await expect(probeHttps('10.0.0.5', '8443')).resolves.toBe(true)
    expect(spy.mock.calls[0][0]).toBe('https://10.0.0.5:8443/tls/ok')

    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new TypeError('certificado não confiável'))
    await expect(probeHttps('10.0.0.5', '8443')).resolves.toBe(false)
  })

  it('detectPlatform reconhece os sistemas', () => {
    expect(detectPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130')).toBe('windows')
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/130 Mobile')).toBe('android')
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari')).toBe('ios')
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari', 5)).toBe('ios')
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari', 0)).toBe('macos')
    expect(detectPlatform('Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) Chrome/130')).toBe('chromeos')
    expect(detectPlatform('Mozilla/5.0 (X11; Linux x86_64) Chrome/130')).toBe('linux')
    expect(isFirefox('Mozilla/5.0 (Windows NT 10.0; rv:131.0) Gecko/20100101 Firefox/131.0')).toBe(true)
  })
})
