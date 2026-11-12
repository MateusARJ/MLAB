import type { AppInfo } from '@mlab/types'

/**
 * Metadados do produto lidos do `apps/desktop/package.json` no build do main
 * (`define` `__MLAB_APP_META__` em `electron.vite.config.ts`, via `readAppMeta`; 021/C-2104, C-2105).
 */
export interface AppMeta {
  name: string
  description: string
  /** Texto de `build.copyright`, o mesmo gravado pelo electron-builder no executável (RF-2106). */
  copyright: string
}

/** Junta a versão do app em execução aos metadados do build (021, RF-2104). */
export function buildAppInfo(version: string, meta: AppMeta): AppInfo {
  return {
    name: meta.name,
    version,
    description: meta.description,
    copyright: meta.copyright
  }
}
