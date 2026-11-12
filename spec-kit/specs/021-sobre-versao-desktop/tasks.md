# Tasks: Versão e Informações do MLab no App Desktop

Feature: `021-sobre-versao-desktop`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: READY

Regras:
- `npm run test -w apps/desktop` e `npm run lint` verdes antes de marcar `[x]`;
- um commit atômico por task, com `Ref: T210x` e `Refs #52`.

### T2101 — Tipo `AppInfo` e canal IPC `get-app-info`
[x] T2101
Allowed Paths: `packages/types/src/index.ts`, `apps/desktop/electron.vite.config.ts`,
`apps/desktop/src/main/appInfo.ts`, `apps/desktop/src/main/appInfo.test.ts`, `apps/desktop/src/main/main.ts`,
`apps/desktop/src/main/preload.ts`, `apps/desktop/src/test/setup.ts`,
`spec-kit/specs/003-classroom-interaction/contracts/desktop-ipc.md`
Prohibited Paths: `apps/desktop/src/renderer/**`, `apps/desktop/package.json`, `apps/web/**`, `apps/backend/**`,
`packages/ui/**`, `package.json`
Checks:
- [x] `AppInfo { name, version, description, copyright }` exportado de `@mlab/types` (RNF-2102).
- [x] `define` `__MLAB_APP_META__` no build do main, lido do `apps/desktop/package.json` (C-2105).
- [x] `buildAppInfo(version, meta)` monta `Copyright © <ano> MLab`, com teste vitest (RF-2104, RF-2106).
- [x] `ipcMain.handle('get-app-info')` e `electronAPI.getAppInfo()`, sem parâmetros (RNF-2101).
- [x] Mock `getAppInfo` em `src/test/setup.ts`.
- [x] Canal na tabela Renderer → Main de `desktop-ipc.md`, "em vigor desde 021 (T2101)" (RNF-2102).

### T2102 — Hook `useAppInfo` e componente `AppInfoFooter`
[ ] T2102
Depends On: T2101
Allowed Paths: `apps/desktop/src/renderer/hooks/useAppInfo.ts`, `apps/desktop/src/renderer/hooks/useAppInfo.test.ts`,
`apps/desktop/src/renderer/components/AppInfoFooter.tsx`,
`apps/desktop/src/renderer/components/AppInfoFooter.test.tsx`
Prohibited Paths: `apps/desktop/src/main/**`, `apps/desktop/src/renderer/pages/**`,
`apps/desktop/src/renderer/services/**`, `apps/desktop/package.json`, `packages/**`, `package.json`
Checks:
- [ ] Hook devolve o `AppInfo` e vira `null` quando o IPC falha (RF-2107).
- [ ] Rodapé "MLab vX.Y.Z" com o botão "Sobre" (RF-2101, RF-2102).
- [ ] Diálogo com nome, versão, descrição e copyright; fecha por "Fechar" e por Esc (RF-2102, RF-2103).
- [ ] `role="dialog"`, `aria-modal`, `aria-labelledby` (RNF-2104).
- [ ] Sem `AppInfo`, nada é renderizado (RF-2107).

### T2103 — Rodapé nas telas de identificação e dashboard
[ ] T2103
Depends On: T2102
Allowed Paths: `apps/desktop/src/renderer/pages/ProfessorEntry.tsx`,
`apps/desktop/src/renderer/pages/ProfessorEntry.test.tsx`, `apps/desktop/src/renderer/pages/Dashboard.tsx`,
`apps/desktop/src/renderer/pages/Dashboard.test.tsx`
Prohibited Paths: `apps/desktop/src/renderer/pages/Room.tsx`, `apps/desktop/src/main/**`,
`apps/desktop/src/renderer/services/**`, `apps/desktop/package.json`, `packages/**`, `package.json`
Checks:
- [ ] `AppInfoFooter` abaixo do card da identificação e ao fim do dashboard (RF-2101).
- [ ] Testes das duas telas afirmam a versão do mock no rodapé; testes existentes continuam verdes.

### T2104 — Metadados do pacote
[ ] T2104
Depends On: T2103
Allowed Paths: `apps/desktop/package.json`
Prohibited Paths: `apps/desktop/src/**`, `apps/web/**`, `apps/backend/**`, `packages/**`, `package.json`
Checks:
- [ ] `description` e `build.linux.description` com o texto de C-2103 (RF-2105).
- [ ] `build.copyright` removido (RF-2106, C-2104).
- [ ] Campo `version` intocado (RN-2101).

### T2105 — Verificação, converge e versão
[ ] T2105
Depends On: T2104
Allowed Paths: `spec-kit/specs/021-sobre-versao-desktop/**`, `package.json`, `package-lock.json`,
`apps/*/package.json`, `packages/*/package.json`
Prohibited Paths: `apps/**/src/**`, `packages/**/src/**`, `.github/**`
Checks:
- [ ] Build Windows (`electron-builder --win --dir`): `VersionInfo` do `MLab.exe` com a versão e
  `Copyright © <ano> MLab`.
- [ ] Smoke manual em dev: rodapé e "Sobre" nas duas telas.
- [ ] `converge.md` com evidências, desvios e impacto de versão (MINOR, C-2107).
- [ ] `npm run bump -- minor` e `npm run version:check`; commit `chore(release): versao X.Y.Z`.
- [ ] `npm run spec:check -- spec-kit/specs/021-sobre-versao-desktop` com PASS.
