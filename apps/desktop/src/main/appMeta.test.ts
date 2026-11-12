import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { readAppMeta } from './appMeta'

const pkg = {
  description: 'Plataforma de transmissão de tela e interação para aulas ao vivo',
  build: { productName: 'MLab', copyright: 'Copyright © 2026 Mateus de Araujo' }
}

describe('readAppMeta', () => {
  it('lê nome, descrição e copyright do package.json', () => {
    expect(readAppMeta(pkg)).toEqual({
      name: 'MLab',
      description: pkg.description,
      copyright: 'Copyright © 2026 Mateus de Araujo'
    })
  })

  it.each([
    ['build.copyright', { ...pkg, build: { productName: 'MLab' } }],
    ['build.productName', { ...pkg, build: { copyright: pkg.build.copyright } }],
    ['description', { build: pkg.build }],
    ['build.copyright', { ...pkg, build: { ...pkg.build, copyright: '  ' } }]
  ])('falha quando falta %s', (field, broken) => {
    expect(() => readAppMeta(broken)).toThrow(field)
  })

  it('aceita o package.json real do desktop', () => {
    const real = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'))
    expect(() => readAppMeta(real)).not.toThrow()
  })
})
