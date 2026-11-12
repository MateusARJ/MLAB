# Plan: Versão e Informações do MLab no App Desktop

Feature: `021-sobre-versao-desktop`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-2101 a C-2107)

## 1. Summary

```text
apps/desktop/package.json ──(build do main: define __MLAB_APP_META__)──┐
app.getVersion() ──────────────────────────────────────────────────────┤
                                                                       ▼
main.ts: ipcMain.handle('get-app-info') → buildAppInfo(version, meta) : AppInfo
                                                                       │ contextBridge
preload.ts: electronAPI.getAppInfo() ◄─────────────────────────────────┘
        │
renderer: useAppInfo() → <AppInfoFooter/> (rodapé + diálogo "Sobre")
        └── ProfessorEntry.tsx, Dashboard.tsx
```

1. `packages/types`: novo `AppInfo { name, version, description, copyright }`.
2. `electron.vite.config.ts`: lê `apps/desktop/package.json` no build e injeta `__MLAB_APP_META__` no main, com
   `{ name: build.productName, description, copyright: build.copyright }`.
3. `src/main/appInfo.ts`: função pura `buildAppInfo(version, meta): AppInfo`, que junta a versão do app em execução
   aos metadados do build.
4. `main.ts`: handler `get-app-info`. `preload.ts`: `getAppInfo()`.
5. `hooks/useAppInfo.ts`: pede as informações uma vez e devolve `AppInfo | null`. Uma falha vira `null` (RF-2107).
6. `components/AppInfoFooter.tsx`: rodapé "MLab vX.Y.Z · Sobre" e diálogo acessível (Esc e "Fechar").
7. `package.json` do desktop: descrição única e `build.copyright` = `Copyright © 2026 Mateus de Araujo`.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Versão | `app.getVersion()` no main | RF-2104, C-2105 |
| Nome, descrição, copyright | `define` do electron-vite a partir do `package.json` do desktop (`build.productName`, `description`, `build.copyright`); lido com `fs` no config, sem `resolveJsonModule` | RF-2105, RF-2106, C-2104, C-2105 |
| Canal | `get-app-info`, Renderer → Main, sem parâmetros | RNF-2101, RNF-2102 |
| Tipo | `AppInfo` em `packages/types` | RNF-2102 |
| UI | componente único reutilizado nas duas telas; estilo inline com tokens de `@mlab/ui`, como nas páginas | RF-2101, RF-2102 |
| Diálogo | `role="dialog"`, `aria-modal`, `aria-labelledby`, foco no botão "Fechar" ao abrir, Esc fecha | RF-2103, RNF-2104 |
| Testes | vitest: `appInfo.test.ts` (main), `useAppInfo` e `AppInfoFooter` (renderer), mock `getAppInfo` em `src/test/setup.ts` | §11 da spec |
| Versão | MINOR via `npm run bump -- minor` | C-2107 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| `define` ausente no vitest | `ReferenceError` nos testes | `buildAppInfo` recebe `meta` por parâmetro; só o `main.ts` lê o global |
| `getByText('MLab')` exato em `ProfessorEntry.test.tsx` | teste quebra se o rodapé tiver um nó só "MLab" | rodapé usa o texto único "MLab vX.Y.Z"; o "MLab" do diálogo só existe com o diálogo aberto |
| IPC indisponível (preload antigo, erro) | tela quebrada | hook captura o erro e o rodapé não renderiza (RF-2107) |
| Copyright do app ≠ copyright do executável | informação divergente | os dois leem o mesmo `build.copyright` |
| `build.copyright` ausente ou vazio no futuro | "Sobre" sem copyright | `buildAppInfo` exige o campo no tipo; teste do config do metadado na T2101a |

## Scope Lock

### IN

- tipo `AppInfo`;
- canal IPC `get-app-info` (main, preload, mock de teste, contrato);
- `define` do metadado no build do main;
- rodapé e diálogo "Sobre" nas telas de identificação e de dashboard;
- descrição única e copyright sem ano fixo no `package.json` do desktop;
- incremento MINOR de versão.

### OUT

- `apps/web`, `apps/backend`, tela da sala (`Room.tsx`), `productName`, `appId`, verificação de atualização,
  painel nativo "Sobre", menu nativo.

### Allowed Paths

- `packages/types/src/index.ts`
- `apps/desktop/electron.vite.config.ts`
- `apps/desktop/src/main/appInfo.ts`, `apps/desktop/src/main/appInfo.test.ts`, `apps/desktop/src/main/main.ts`,
  `apps/desktop/src/main/preload.ts`
- `apps/desktop/src/test/setup.ts`
- `apps/desktop/src/renderer/hooks/useAppInfo.ts`, `apps/desktop/src/renderer/hooks/useAppInfo.test.ts`
- `apps/desktop/src/renderer/components/AppInfoFooter.tsx`, `apps/desktop/src/renderer/components/AppInfoFooter.test.tsx`
- `apps/desktop/src/renderer/pages/ProfessorEntry.tsx`, `apps/desktop/src/renderer/pages/ProfessorEntry.test.tsx`,
  `apps/desktop/src/renderer/pages/Dashboard.tsx`, `apps/desktop/src/renderer/pages/Dashboard.test.tsx`
- `apps/desktop/package.json` (`description`, `build.copyright`, `build.linux.description`)
- `spec-kit/specs/003-classroom-interaction/contracts/desktop-ipc.md`
- `spec-kit/specs/021-sobre-versao-desktop/**`
- `apps/desktop/src/main/appMeta.ts`, `apps/desktop/src/main/appMeta.test.ts` (T2101a: leitura do metadado do
  `package.json`, compartilhada pelo config e testável)
- só na T2105, via `npm run bump`: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`

### Prohibited Paths

- `apps/web/**`, `apps/backend/**`, `packages/ui/**`
- `apps/desktop/src/renderer/pages/Room.tsx`, `apps/desktop/src/renderer/services/**`
- `apps/desktop/tsconfig*.json`, `apps/desktop/vitest.config.ts`
- `.github/**`, `scripts/**`
- `tasks.md` de outras features

### Dependencies

- Nenhuma nova. Electron, electron-vite, React, Vitest e Testing Library já instalados.

### Non-Goals

- mostrar a versão para os alunos;
- mudar o `productName` para trocar o `FileDescription` do Windows;
- consultar a versão do backend;
- avisar sobre atualização.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: nenhuma operação protegida nova; canal só de leitura e sem dado sensível.
- [x] Princípio III: SFU intocada.
- [x] Princípio IV: nenhuma meta de desempenho declarada.
- [x] Princípio V: canal registrado em `desktop-ipc.md`; tipo em `packages/types`.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: o componente e o hook têm dois consumidores reais (identificação e dashboard).
- [ ] Princípio VIII: converge ao final.

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-12 | Rodapé + diálogo "Sobre" em identificação e dashboard | C-2101 |
| 2026-11-12 | Nome, versão, descrição e copyright | C-2102 |
| 2026-11-12 | Descrição única | C-2103 |
| 2026-11-12 | Copyright pelo ano do build; `FileDescription` continua "MLab" | C-2104 (substituída) |
| 2026-11-12 | Copyright fixo `Copyright © 2026 Mateus de Araujo` no `build.copyright`, lido pelo app; ajuste na T2101a | C-2104 (revista) |
| 2026-11-12 | Canal `get-app-info` + `define` do metadado | C-2105 |
| 2026-11-12 | Web fora | C-2106 |
| 2026-11-12 | IDs `210x`; versão MINOR | C-2107 |
