import { randomBytes } from 'crypto'

/** Variável de ambiente compartilhada com o backend embarcado (ADR 0006). */
export const HOST_KEY_ENV = 'MLAB_HOST_KEY'

/** Tamanho da chave de host gerada (bytes). */
export const HOST_KEY_BYTES = 32

/**
 * Resolve a chave de host desta execução.
 *
 * - Se `MLAB_HOST_KEY` já vier do ambiente (ex.: `npm run dev` via `scripts/dev.js`), reutiliza o valor
 *   para que o app e o backend gerenciado pelo Turborepo compartilhem a mesma chave.
 * - Caso contrário, gera 32 bytes aleatórios.
 *
 * Em ambos os casos grava o valor em `env`, de onde o backend embarcado herda a chave ao ser iniciado.
 * A chave nunca deve ser registrada em log.
 */
export function resolveHostKey(env: NodeJS.ProcessEnv = process.env): string {
  const existing = env[HOST_KEY_ENV]
  if (existing && existing.trim() !== '') {
    return existing
  }
  const generated = randomBytes(HOST_KEY_BYTES).toString('hex')
  env[HOST_KEY_ENV] = generated
  return generated
}
