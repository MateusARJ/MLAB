# Tasks: Barra de Marcação no Linux

Feature: `009-marcacao-linux`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: READY-FOR-IMPLEMENTATION

Regra de cada task: `npx vitest run` e `npx tsc --noEmit` em `apps/desktop` verdes e `npx turbo run test --force`
verde antes do `[x]`.

### T901 — Tipo, contrato e canal IPC do retângulo da barra
[x] T901
Allowed Paths: `packages/types/src/index.ts`, `apps/desktop/src/main/preload.ts`, `apps/desktop/src/main/main.ts`,
`apps/desktop/src/main/annotationOverlayWindow.ts`, `apps/desktop/src/test/setup.ts`,
`spec-kit/specs/003-classroom-interaction/contracts/desktop-ipc.md`
Prohibited Paths: `apps/backend/**`, `apps/web/**`, `packages/ui/**`, `apps/desktop/src/renderer/**`,
`apps/desktop/package.json`
Checks:
- [x] `AnnotationToolbarRect { x, y, width, height }` em `packages/types` (RF-902).
- [x] `ElectronAPI.setAnnotationToolbarRect(rect | null)` em `preload.ts` → `annotation-overlay:toolbar-rect`.
- [x] Handler em `main.ts` aceita só o webContents do overlay e repassa ao manager (stub `setToolbarRect`).
- [x] Canal registrado em `003/contracts/desktop-ipc.md`; mock em `test/setup.ts`.
- [x] vitest desktop 95/95, `turbo test` 5/5; `tsc --noEmit` sem erro novo (14 erros já existentes em `main.ts:9`,
  `Room.tsx`, `Room.test.tsx` e `media/cursorMask.worker.ts`, fora do escopo).

### T902 — Hit-test puro da barra
[ ] T902
Depends On: T901
Allowed Paths: `apps/desktop/src/main/toolbarHitTest.ts`, `apps/desktop/src/main/toolbarHitTest.test.ts`
Prohibited Paths: `apps/desktop/src/main/annotationOverlayWindow.ts`, `apps/desktop/src/renderer/**`,
`apps/backend/**`, `apps/web/**`, `packages/**`
Checks:
- [ ] `isPointerOverToolbar(cursor, overlayBounds, rect, margin = 4)`: dentro, fora, borda com folga, overlay
  deslocado, `rect` nulo (RF-901).
- [ ] `resolveIgnoreMouse(requested, over)` = `requested && !over`.
- [ ] `sanitizeToolbarRect(input, maxW, maxH)`: rejeita não finitos, ≤ 0 e acima do limite.

### T903 — Manager: hit-test no Linux e log de atalhos recusados
[ ] T903
Depends On: T902
Allowed Paths: `apps/desktop/src/main/annotationOverlayWindow.ts`, `apps/desktop/src/main/annotationOverlayWindow.test.ts`
Prohibited Paths: `apps/desktop/src/main/nativeWindowTracker.ts`, `apps/desktop/src/main/cursorPresence.ts`,
`apps/desktop/src/main/doubleCtrlDetector.ts`, `apps/desktop/src/renderer/**`, `apps/backend/**`, `apps/web/**`,
`packages/**`
Checks:
- [ ] `requestedIgnore` separado do valor aplicado; Windows/macOS chamam `setIgnoreMouseEvents` como hoje (RNF-901).
- [ ] No Linux: temporizador de 16 ms só com overlay vivo e retângulo; aplica só quando o valor efetivo muda;
  parado em `stop()`, `closed` e retângulo `null` (RF-901, RNF-902).
- [ ] `console.warn('[AnnotationOverlay] atalho recusado: <acc>')` para `false` e exceção (RF-903).
- [ ] Testes com `electron` mockado e `process.platform` = `linux`/`win32`.

### T904 — Overlay envia o retângulo da barra
[ ] T904
Depends On: T901
Allowed Paths: `apps/desktop/src/renderer/components/FloatingAnnotationOverlay.tsx`,
`apps/desktop/src/renderer/components/FloatingAnnotationOverlay.test.tsx`
Prohibited Paths: `apps/desktop/src/renderer/media/**`, `apps/desktop/src/renderer/pages/**`, `apps/desktop/src/main/**`,
`apps/backend/**`, `apps/web/**`, `packages/**`
Checks:
- [ ] União de barra + popover de cores enviada ao mudar posição, recolhida, orientação ou popover, com dedupe (RF-902).
- [ ] `null` com o MLab em foco sem arraste (C-903) e ao desmontar.
- [ ] Testes: envio inicial, recolher, popover, dedupe, `null` com MLab em foco.

### T905 — Verificação manual no Linux (WSLg) e smoke no Windows
[ ] T905
Depends On: T903, T904
Allowed Paths: `spec-kit/specs/009-marcacao-linux/**`
Prohibited Paths: `apps/**`, `packages/**`
Checks:
- [ ] Testes do desktop rodados também no WSL (Linux).
- [ ] App no WSLg: clique nos botões, recolher/expandir por botão e `Alt+H`, ferramenta de desenho, letras únicas
  após clicar na barra, log de atalhos recusados (US-901 a US-903). Evidências em `evidencias/`.
- [ ] Smoke da barra no Windows sem regressão.

### T906 — Converge
[ ] T906
Depends On: T905
Allowed Paths: `spec-kit/specs/009-marcacao-linux/**`
Prohibited Paths: `apps/**`, `packages/**`
Checks:
- [ ] `converge.md` criado comparando código com spec/plan/tasks, com pendências (ex.: Ubuntu/GNOME real).
