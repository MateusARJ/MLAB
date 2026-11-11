# Plan: Lint de Tipos do App Desktop sem Erros

Feature: `020-lint-tipos-desktop`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-2001 a C-2006)

## 1. Summary

Remover o código morto apontado pelo `tsc` no main, no worker do cursor e na sala; fazer `ensureOutCanvas` devolver o
canvas e o contexto para o TypeScript enxergar o tipo; completar dois mocks de teste; e rodar `npm run lint` no CI.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| `main.ts` | tirar `systemPreferences` do import de `electron` | RF-2001 |
| Worker | remover `lastCursorRect`, `cursorStationarySince`, `rectsOverlap`, canvases `plate`/`patch`/`blur`, `plateInitialized`, `lastPlateUpdateAt`, `degraded`, `avgProcessMs`, `ensureCursorMaskCanvases`, `toPixelRect`, `updatePlatePreservingCursor`, `inpaintFromNeighborhood`; `updateCursorState` vira só `currentState = next` | RF-2001, C-2003 |
| Tipo do canvas | `ensureOutCanvas(w, h)` devolve `{ canvas, ctx } \| null`; o laço usa o retorno | RF-2001, RNF-2001 |
| Sala | remover estado, setters e assinatura de `onActiveWindowUnauthorized` | RF-2002, C-2001 |
| Teste da sala | completar `stopPublishing: vi.fn()`; no teste de múltiplas janelas, tirar o callback `unauthorized` e manter a asserção de que o selo não aparece | RF-2001, RF-2002 |
| CI | etapa `npm run lint` no `build-all.yml`, entre o build de `@mlab/types` e os testes | RF-2003, C-2004 |
| Versão | PATCH 1.12.1 via `npm run bump -- patch` | C-2006 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Remover algo que o caminho atual do worker usa | quadro sem traço/lupa ou travado | só sai o que o `tsc` aponta e o que só essas peças usam; `state.rect` (lupa) fica; smoke manual com lupa em zoom e traços |
| Mudar a ordem de checagem do canvas no laço | quadro perdido sem `close()` | o ramo de falha continua repassando o quadro original e fechando-o |
| Teste de múltiplas janelas perder cobertura | regressão do selo sem aviso | a asserção negativa do selo fica; as asserções de troca de janela ficam |
| Lint no CI falhar em plataforma específica | PR para a `main` bloqueado | `tsc` não depende do SO; o lint roda depois do build de `@mlab/types`, como os testes |
| Conflito com a `fix/mascara-cursor-janela` (007) | rebase da 007 mais trabalhoso | a 007 já diverge muito da `development` (base no PR #27); registrado, sem ação aqui |

## Scope Lock

### IN

- código morto de `main.ts`, `cursorMask.worker.ts` e `Room.tsx`;
- tipo do canvas de saída do worker;
- mocks e teste de múltiplas janelas em `Room.test.tsx`;
- etapa de lint no `build-all.yml`;
- incremento PATCH de versão.

### OUT

- `tsconfig*.json`; ESLint; canal IPC `active-window-unauthorized`; ocultação do cursor da 007; `apps/web`;
  `apps/backend`; `packages/**`.

### Allowed Paths

- `apps/desktop/src/main/main.ts`
- `apps/desktop/src/renderer/media/cursorMask.worker.ts`
- `apps/desktop/src/renderer/pages/Room.tsx`
- `apps/desktop/src/renderer/pages/Room.test.tsx`
- `.github/workflows/build-all.yml`
- `spec-kit/specs/020-lint-tipos-desktop/**`
- só na T2006, via `npm run bump`: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`

### Prohibited Paths

- `apps/desktop/src/main/preload.ts`, `apps/desktop/src/main/cursorPresence.ts`
- `apps/desktop/src/renderer/hooks/**`, `apps/desktop/src/test/setup.ts`
- `apps/desktop/tsconfig*.json`, `apps/desktop/package.json` (fora da T2006)
- `apps/web/**`, `apps/backend/**`, `packages/**` (fora da T2006)
- `spec-kit/specs/*/contracts/**`, `tasks.md` de outras features

### Dependencies

- Nenhuma nova. TypeScript e Vitest já instalados no desktop.

### Non-Goals

- afrouxar regras do compilador;
- remover ou mudar o canal IPC `active-window-unauthorized`;
- retomar o inpainting do cursor;
- adotar ESLint ou mudar os gatilhos do workflow.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: autorização intocada.
- [x] Princípio III: SFU intocada; o worker continua só compondo sobreposição no lado do professor.
- [x] Princípio IV: o caminho sem cópia do worker não muda.
- [x] Princípio V: nenhum contrato muda (C-2002).
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: só remoção; nenhuma abstração nova.
- [ ] Princípio VIII: converge ao final.

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-11 | Selo de privacidade fora da UI; remover estado e assinatura | C-2001 |
| 2026-11-11 | Canal IPC intocado | C-2002 |
| 2026-11-11 | Remover o inpainting morto do worker | C-2003 |
| 2026-11-11 | Lint no CI nesta feature | C-2004 |
| 2026-11-11 | IDs `T200x` (faixa `T20x` é da 002) | C-2005 |
| 2026-11-11 | Versão PATCH | C-2006, AGENTS §13 |
