import type { AppMeta } from './appInfo'

/**
 * Extrai do `apps/desktop/package.json` os metadados do "Sobre" (021/C-2104 revista, C-2105).
 * Usado no build do main (`electron.vite.config.ts`). Falha o build se faltar algum campo, para o app nunca
 * mostrar um "Sobre" incompleto ou divergente do executável.
 */
export function readAppMeta(pkg: unknown): AppMeta {
  const p = (pkg ?? {}) as { description?: unknown; build?: { productName?: unknown; copyright?: unknown } }
  const name = p.build?.productName
  const description = p.description
  const copyright = p.build?.copyright
  for (const [field, value] of [
    ['build.productName', name],
    ['description', description],
    ['build.copyright', copyright]
  ] as const) {
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`apps/desktop/package.json: campo ${field} ausente ou vazio (021/RF-2105, RF-2106)`)
    }
  }
  return { name: name as string, description: description as string, copyright: copyright as string }
}
