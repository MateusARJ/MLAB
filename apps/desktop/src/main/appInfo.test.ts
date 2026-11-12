import { describe, it, expect } from 'vitest'
import { buildAppInfo, type AppMeta } from './appInfo'

const meta: AppMeta = {
  name: 'MLab',
  description: 'Plataforma de transmissão de tela e interação para aulas ao vivo',
  copyrightHolder: 'MLab',
  buildYear: 2026
}

describe('buildAppInfo', () => {
  it('usa a versão recebida do app em execução', () => {
    expect(buildAppInfo('1.13.0', meta).version).toBe('1.13.0')
  })

  it('repassa nome e descrição do metadado do build', () => {
    const info = buildAppInfo('1.13.0', meta)
    expect(info.name).toBe('MLab')
    expect(info.description).toBe(meta.description)
  })

  it('monta o copyright com o ano do build, no formato do electron-builder', () => {
    expect(buildAppInfo('1.13.0', meta).copyright).toBe('Copyright © 2026 MLab')
    expect(buildAppInfo('1.13.0', { ...meta, buildYear: 2027 }).copyright).toBe('Copyright © 2027 MLab')
  })
})
