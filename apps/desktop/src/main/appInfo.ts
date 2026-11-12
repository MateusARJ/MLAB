import type { AppInfo } from '@mlab/types'

/**
 * Metadados do produto lidos do `apps/desktop/package.json` no build do main
 * (`define` `__MLAB_APP_META__` em `electron.vite.config.ts`, 021/C-2105).
 */
export interface AppMeta {
  name: string
  description: string
  copyrightHolder: string
  buildYear: number
}

/**
 * Monta as informações exibidas no app. O copyright segue o formato que o electron-builder grava no executável
 * quando `build.copyright` não é definido, com o mesmo ano do build (021/C-2104, RF-2106).
 */
export function buildAppInfo(version: string, meta: AppMeta): AppInfo {
  return {
    name: meta.name,
    version,
    description: meta.description,
    copyright: `Copyright © ${meta.buildYear} ${meta.copyrightHolder}`
  }
}
