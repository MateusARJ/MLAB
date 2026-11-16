import { describe, it, expect, vi } from 'vitest'
import { isAppUrl, isExternalWebUrl, hardenWebContents, defaultAppIndexUrl } from './navigationGuard'

const WIN_INDEX = 'file:///C:/Program%20Files/MLab/resources/app.asar/out/renderer/index.html'
const LINUX_INDEX = 'file:///opt/MLab/resources/app.asar/out/renderer/index.html'

describe('isAppUrl', () => {
  it('aceita o index.html empacotado do app, com e sem query ou hash', () => {
    expect(isAppUrl(WIN_INDEX, undefined, WIN_INDEX, true)).toBe(true)
    expect(isAppUrl(`${WIN_INDEX}?overlay=annotation`, undefined, WIN_INDEX, true)).toBe(true)
    expect(isAppUrl(`${WIN_INDEX}#/sala`, undefined, WIN_INDEX, true)).toBe(true)
  })

  it('compara o caminho decodificado e, no Windows, sem diferenciar maiúsculas', () => {
    const variant = 'file:///c:/program files/mlab/RESOURCES/app.asar/out/renderer/INDEX.html'
    expect(isAppUrl(variant, undefined, WIN_INDEX, true)).toBe(true)
    expect(isAppUrl(LINUX_INDEX.replace('index.html', 'INDEX.html'), undefined, LINUX_INDEX, false)).toBe(false)
    expect(isAppUrl(LINUX_INDEX, undefined, LINUX_INDEX, false)).toBe(true)
  })

  it('recusa outros arquivos file://, como um arquivo solto na janela (018/RNF-181)', () => {
    expect(isAppUrl('file:///C:/Users/x/Documents/doc.pdf', undefined, WIN_INDEX, true)).toBe(false)
    expect(isAppUrl('file:///C:/Program%20Files/MLab/resources/app.asar/out/renderer/outra.html', undefined, WIN_INDEX, true)).toBe(false)
    expect(isAppUrl('file://servidor/C:/Program%20Files/MLab/resources/app.asar/out/renderer/index.html', undefined, WIN_INDEX, true)).toBe(false)
    expect(isAppUrl('file:///etc/passwd', 'http://localhost:5173', LINUX_INDEX, false)).toBe(false)
  })

  it('recusa file:// quando o index.html do app não é informado', () => {
    expect(isAppUrl(WIN_INDEX)).toBe(false)
    expect(isAppUrl(WIN_INDEX, undefined, 'não é url')).toBe(false)
    expect(isAppUrl(WIN_INDEX, undefined, 'http://localhost:5173/index.html')).toBe(false)
  })

  it('o index.html padrão é um file:// do renderer empacotado', () => {
    const url = defaultAppIndexUrl()
    expect(url.startsWith('file://')).toBe(true)
    expect(url.endsWith('/renderer/index.html')).toBe(true)
  })

  it('aceita a origem do servidor de desenvolvimento', () => {
    expect(isAppUrl('http://localhost:5173/?overlay=annotation', 'http://localhost:5173')).toBe(true)
  })

  it('recusa outras origens', () => {
    expect(isAppUrl('https://site-externo.example', 'http://localhost:5173')).toBe(false)
    expect(isAppUrl('http://localhost:8080/', 'http://localhost:5173')).toBe(false)
    expect(isAppUrl('https://site-externo.example')).toBe(false)
  })

  it('recusa URLs inválidas', () => {
    expect(isAppUrl('não é url')).toBe(false)
  })
})

describe('isExternalWebUrl', () => {
  it('identifica http e https', () => {
    expect(isExternalWebUrl('https://mlab.example')).toBe(true)
    expect(isExternalWebUrl('http://mlab.example')).toBe(true)
    expect(isExternalWebUrl('file:///etc/passwd')).toBe(false)
    expect(isExternalWebUrl('javascript:alert(1)')).toBe(false)
  })
})

describe('hardenWebContents', () => {
  function fakeContents() {
    const handlers: Record<string, (...args: any[]) => void> = {}
    let windowOpenHandler: (details: { url: string }) => { action: string } = () => ({ action: 'allow' })
    return {
      contents: {
        setWindowOpenHandler: (fn: any) => {
          windowOpenHandler = fn
        },
        on: (event: string, fn: any) => {
          handlers[event] = fn
        },
      } as any,
      openWindow: (url: string) => windowOpenHandler({ url }),
      navigate: (url: string) => {
        const event = { preventDefault: vi.fn() }
        handlers['will-navigate'](event, url)
        return event
      },
    }
  }

  it('nega novas janelas e abre links web no navegador do sistema', () => {
    const openExternal = vi.fn()
    const f = fakeContents()
    hardenWebContents(f.contents, openExternal, 'http://localhost:5173')

    expect(f.openWindow('https://docs.example')).toEqual({ action: 'deny' })
    expect(openExternal).toHaveBeenCalledWith('https://docs.example')

    openExternal.mockClear()
    expect(f.openWindow('file:///tmp/x.html')).toEqual({ action: 'deny' })
    expect(openExternal).not.toHaveBeenCalled()
  })

  it('bloqueia navegação para fora do app e permite navegação interna', () => {
    const openExternal = vi.fn()
    const f = fakeContents()
    hardenWebContents(f.contents, openExternal, 'http://localhost:5173')

    const internal = f.navigate('http://localhost:5173/sala')
    expect(internal.preventDefault).not.toHaveBeenCalled()

    const external = f.navigate('https://site-externo.example')
    expect(external.preventDefault).toHaveBeenCalled()
    expect(openExternal).toHaveBeenCalledWith('https://site-externo.example')
  })

  it('em produção, navega só para o index.html do app e bloqueia arquivos soltos sem abri-los fora', () => {
    const openExternal = vi.fn()
    const f = fakeContents()
    hardenWebContents(f.contents, openExternal, undefined, WIN_INDEX)

    const app = f.navigate(`${WIN_INDEX}?overlay=annotation`)
    expect(app.preventDefault).not.toHaveBeenCalled()

    const dropped = f.navigate('file:///C:/Users/x/Documents/doc.pdf')
    expect(dropped.preventDefault).toHaveBeenCalled()
    expect(openExternal).not.toHaveBeenCalled()

    const web = f.navigate('https://docs.example')
    expect(web.preventDefault).toHaveBeenCalled()
    expect(openExternal).toHaveBeenCalledWith('https://docs.example')
  })
})
