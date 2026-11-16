import { describe, it, expect } from 'vitest'
import { resolveHostKey, HOST_KEY_ENV, HOST_KEY_BYTES } from './hostKey'

describe('resolveHostKey', () => {
  it('gera uma chave aleatória quando o ambiente não define MLAB_HOST_KEY', () => {
    const env: NodeJS.ProcessEnv = {}
    const key = resolveHostKey(env)

    expect(key).toMatch(/^[0-9a-f]+$/)
    expect(key).toHaveLength(HOST_KEY_BYTES * 2)
    expect(env[HOST_KEY_ENV]).toBe(key)
  })

  it('gera chaves diferentes a cada execução', () => {
    expect(resolveHostKey({})).not.toBe(resolveHostKey({}))
  })

  it('reutiliza a chave recebida do ambiente (modo npm run dev)', () => {
    const env: NodeJS.ProcessEnv = { [HOST_KEY_ENV]: 'chave-compartilhada-pelo-dev-js' }
    expect(resolveHostKey(env)).toBe('chave-compartilhada-pelo-dev-js')
    expect(env[HOST_KEY_ENV]).toBe('chave-compartilhada-pelo-dev-js')
  })

  it('ignora valor vazio no ambiente e gera uma nova chave', () => {
    const env: NodeJS.ProcessEnv = { [HOST_KEY_ENV]: '   ' }
    const key = resolveHostKey(env)
    expect(key).toHaveLength(HOST_KEY_BYTES * 2)
    expect(env[HOST_KEY_ENV]).toBe(key)
  })
})
