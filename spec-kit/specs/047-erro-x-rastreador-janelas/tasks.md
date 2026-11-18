# Tasks: Erro X no Rastreador de Janelas Não Encerra o App no Linux

Feature: `047-erro-x-rastreador-janelas`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: DONE

Regras:
- um commit atômico por task, com `Ref: T470x` e `Refs #139`.

### T4701 — Testes do erro X no rastreador Linux
[x] T4701
Allowed Paths: `apps/desktop/src/main/nativeWindowTracker.test.ts`, `apps/desktop/src/main/nativeWindowTracker.ts`
(somente o `export` de `createLinuxX11Tracker`), `spec-kit/specs/047-erro-x-rastreador-janelas/tasks.md`
Prohibited Paths: `apps/desktop/src/main/cursorPresence.ts`, `apps/desktop/src/main/x11InputShape.ts`,
`apps/desktop/src/main/x11InputShape.test.ts`, `apps/desktop/src/renderer/**`, `apps/web/**`, `apps/backend/**`,
`packages/**`
Checks:
- [x] `koffi` simulado em que um erro X sem handler próprio instalado faz o papel do `exit()` do Xlib.
- [x] `BadWindow` em `queryWindow`: não lança, `targetBounds` nulo, sem aviso, handler anterior restaurado (RF-4701,
  RF-4702).
- [x] Outro erro X: não lança e gera um único aviso por código (RF-4702).
- [x] `dispose` fecha o display e libera o callback.
- [x] Os testes novos falham antes da T4703: 5 falhas (`BadWindow` lança "handler padrão do Xlib: exit()", sem
  `XSync`, rastreador criado sem `koffi.register`, sem `unregister`); os 2 testes existentes seguem verdes.

### T4702 — Módulo único de captura de erro X
[x] T4702
Depends On: T4701
Allowed Paths: `apps/desktop/src/main/x11ErrorTrap.ts`, `apps/desktop/src/main/x11ErrorTrap.test.ts`,
`apps/desktop/src/main/x11InputShape.ts`, `spec-kit/specs/047-erro-x-rastreador-janelas/tasks.md`
Prohibited Paths: `apps/desktop/src/main/x11InputShape.test.ts`, `apps/desktop/src/main/nativeWindowTracker.ts`,
`apps/desktop/src/main/cursorPresence.ts`, `apps/desktop/src/main/annotationOverlayWindow.ts`,
`apps/desktop/src/renderer/**`, `apps/web/**`, `apps/backend/**`, `packages/**`
Checks:
- [x] `createX11ErrorTrap` instala o handler só durante `run`, chama `XSync`, restaura o anterior também quando `fn`
  lança, guarda só o primeiro erro e zera o erro pendente a cada `run`; `dispose` libera o callback.
- [x] `x11InputShape.ts` usa o trap; `x11InputShape.test.ts` 12/12 sem alteração (RF-4703). Se o trap não puder ser
  criado, o display aberto é fechado antes de devolver `null`.
- [x] `x11ErrorTrap.test.ts` 7/7; `annotationOverlayWindow.test.ts` 24/24; `tsc --noEmit` sem erros.

### T4703 — Captura de erro X no rastreador Linux
[x] T4703
Depends On: T4702
Allowed Paths: `apps/desktop/src/main/nativeWindowTracker.ts` (somente o trecho Linux),
`apps/desktop/src/main/nativeWindowTracker.test.ts`, `spec-kit/specs/047-erro-x-rastreador-janelas/tasks.md`
Prohibited Paths: `apps/desktop/src/main/x11ErrorTrap.ts`, `apps/desktop/src/main/x11InputShape.ts`,
`apps/desktop/src/main/x11InputShape.test.ts`, `apps/desktop/src/main/cursorPresence.ts`,
`apps/desktop/src/renderer/**`, `apps/web/**`, `apps/backend/**`, `packages/**`
Checks:
- [x] `queryWindow` e `queryTopWindowAtCursor` rodam dentro de `trap.run`; `BadWindow` sem log; outro erro com aviso
  único por código; trap indisponível → rastreador `null`, com o display fechado (RF-4701, RF-4702).
- [x] Testes da T4701 verdes (7/7 no arquivo); diff só no import e no trecho de `createLinuxX11Tracker`, rastreadores
  do Windows e do macOS sem mudança (RNF-4702).
- [x] `npx vitest run` no desktop (Windows): 34 arquivos, 393 testes verdes; `npx tsc --noEmit` sem erros.

### T4704 — Verificação num servidor X real
[x] T4704
Depends On: T4703
Allowed Paths: `spec-kit/specs/047-erro-x-rastreador-janelas/**`
Prohibited Paths: `apps/**`, `packages/**`
Checks:
- [x] WSLg (XWayland): `nativeWindowTracker.test.ts` derruba o worker na `development` (`BadWindow` em
  `X_QueryTree`) e passa 7/7 nesta branch (RNF-4701); evidência em `evidencias/t4704-wslg-badwindow.log`.
- [x] Suíte do desktop no Linux sem a falha da #139: 34 arquivos, 393 testes verdes; `tsc --noEmit` sem erros.

### T4705 — Converge
[x] T4705
Depends On: T4704
Allowed Paths: `spec-kit/specs/047-erro-x-rastreador-janelas/**`
Prohibited Paths: `apps/**`, `packages/**`, `.github/**`, `spec-kit/docs/adrs/**`
Checks:
- [x] `converge.md` com evidências, desvios e impacto de versão (PATCH, C-4703).
- [x] `npm run spec:check -- spec-kit/specs/047-erro-x-rastreador-janelas` com PASS.
