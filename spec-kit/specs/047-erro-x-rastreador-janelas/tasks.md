# Tasks: Erro X no Rastreador de Janelas Não Encerra o App no Linux

Feature: `047-erro-x-rastreador-janelas`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: IN PROGRESS

Regras:
- um commit atômico por task, com `Ref: T470x` e `Refs #139`.

### T4701 — Testes do erro X no rastreador Linux
[ ] T4701
Allowed Paths: `apps/desktop/src/main/nativeWindowTracker.test.ts`, `apps/desktop/src/main/nativeWindowTracker.ts`
(somente o `export` de `createLinuxX11Tracker`), `spec-kit/specs/047-erro-x-rastreador-janelas/tasks.md`
Prohibited Paths: `apps/desktop/src/main/cursorPresence.ts`, `apps/desktop/src/main/x11InputShape.ts`,
`apps/desktop/src/main/x11InputShape.test.ts`, `apps/desktop/src/renderer/**`, `apps/web/**`, `apps/backend/**`,
`packages/**`
Checks:
- [ ] `koffi` simulado em que um erro X sem handler próprio instalado faz o papel do `exit()` do Xlib.
- [ ] `BadWindow` em `queryWindow`: não lança, `targetBounds` nulo, sem aviso, handler anterior restaurado (RF-4701,
  RF-4702).
- [ ] Outro erro X: não lança e gera um único aviso por código (RF-4702).
- [ ] `dispose` fecha o display e libera o callback.
- [ ] Os testes novos falham antes da T4703; os demais seguem verdes.

### T4702 — Módulo único de captura de erro X
[ ] T4702
Depends On: T4701
Allowed Paths: `apps/desktop/src/main/x11ErrorTrap.ts`, `apps/desktop/src/main/x11ErrorTrap.test.ts`,
`apps/desktop/src/main/x11InputShape.ts`, `spec-kit/specs/047-erro-x-rastreador-janelas/tasks.md`
Prohibited Paths: `apps/desktop/src/main/x11InputShape.test.ts`, `apps/desktop/src/main/nativeWindowTracker.ts`,
`apps/desktop/src/main/cursorPresence.ts`, `apps/desktop/src/main/annotationOverlayWindow.ts`,
`apps/desktop/src/renderer/**`, `apps/web/**`, `apps/backend/**`, `packages/**`
Checks:
- [ ] `createX11ErrorTrap` instala o handler só durante `run`, chama `XSync`, restaura o anterior também quando `fn`
  lança, guarda só o primeiro erro e zera o erro pendente a cada `run`; `dispose` libera o callback.
- [ ] `x11InputShape.ts` usa o trap; `x11InputShape.test.ts` verde sem alteração (RF-4703).
- [ ] `x11ErrorTrap.test.ts` verde.

### T4703 — Captura de erro X no rastreador Linux
[ ] T4703
Depends On: T4702
Allowed Paths: `apps/desktop/src/main/nativeWindowTracker.ts` (somente o trecho Linux),
`apps/desktop/src/main/nativeWindowTracker.test.ts`, `spec-kit/specs/047-erro-x-rastreador-janelas/tasks.md`
Prohibited Paths: `apps/desktop/src/main/x11ErrorTrap.ts`, `apps/desktop/src/main/x11InputShape.ts`,
`apps/desktop/src/main/x11InputShape.test.ts`, `apps/desktop/src/main/cursorPresence.ts`,
`apps/desktop/src/renderer/**`, `apps/web/**`, `apps/backend/**`, `packages/**`
Checks:
- [ ] `queryWindow` e `queryTopWindowAtCursor` rodam dentro de `trap.run`; `BadWindow` sem log; outro erro com aviso
  único por código; trap indisponível → rastreador `null` (RF-4701, RF-4702).
- [ ] Testes da T4701 verdes; rastreadores do Windows e do macOS sem mudança (RNF-4702).
- [ ] `npx vitest run` no desktop (Windows) verde; `npx tsc --noEmit` sem erros.

### T4704 — Verificação num servidor X real
[ ] T4704
Depends On: T4703
Allowed Paths: `spec-kit/specs/047-erro-x-rastreador-janelas/**`
Prohibited Paths: `apps/**`, `packages/**`
Checks:
- [ ] WSLg (XWayland): `nativeWindowTracker.test.ts` derruba o worker na `development` e passa nesta branch
  (RNF-4701); evidência em `evidencias/`.
- [ ] Suíte do desktop no Linux sem a falha da #139.

### T4705 — Converge
[ ] T4705
Depends On: T4704
Allowed Paths: `spec-kit/specs/047-erro-x-rastreador-janelas/**`
Prohibited Paths: `apps/**`, `packages/**`, `.github/**`, `spec-kit/docs/adrs/**`
Checks:
- [ ] `converge.md` com evidências, desvios e impacto de versão (PATCH, C-4703).
- [ ] `npm run spec:check -- spec-kit/specs/047-erro-x-rastreador-janelas` com PASS.
