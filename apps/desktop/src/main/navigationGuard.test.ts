import { describe, it, expect, vi } from 'vitest'
import { isAppUrl, isExternalWebUrl, hardenWebContents } from './navigationGuard'

describe('isAppUrl', () => {
  it('aceita páginas file:// empacotadas', () => {
    expect(isAppUrl('file:///C:/Program%20Files/MLab/resources/app.asar/out/renderer/index.html')).toBe(true)
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
})
