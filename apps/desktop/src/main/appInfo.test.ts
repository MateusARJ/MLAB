import { describe, it, expect } from 'vitest'
import { buildAppInfo, type AppMeta } from './appInfo'

const meta: AppMeta = {
  name: 'MLab',
  description: 'Plataforma de transmissão de tela e interação para aulas ao vivo',
  copyright: 'Copyright © 2026 Mateus de Araujo'
}

describe('buildAppInfo', () => {
  it('usa a versão recebida do app em execução (RF-2104)', () => {
    expect(buildAppInfo('1.13.0', meta).version).toBe('1.13.0')
  })

  it('repassa nome, descrição e copyright do metadado do build (RF-2105, RF-2106)', () => {
    expect(buildAppInfo('1.13.0', meta)).toEqual({ ...meta, version: '1.13.0' })
  })
})
