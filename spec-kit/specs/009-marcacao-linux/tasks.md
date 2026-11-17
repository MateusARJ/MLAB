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
[x] T902
Depends On: T901
Allowed Paths: `apps/desktop/src/main/toolbarHitTest.ts`, `apps/desktop/src/main/toolbarHitTest.test.ts`
Prohibited Paths: `apps/desktop/src/main/annotationOverlayWindow.ts`, `apps/desktop/src/renderer/**`,
`apps/backend/**`, `apps/web/**`, `packages/**`
Checks:
- [x] `isPointerOverToolbar(cursor, overlayBounds, rect, margin = 4)`: dentro, fora, borda com folga, overlay
  deslocado, `rect` nulo (RF-901).
- [x] `resolveIgnoreMouse(requested, over)` = `requested && !over`.
- [x] `sanitizeToolbarRect(input, maxW, maxH)`: rejeita não finitos, ≤ 0 e acima do limite.
- [x] `toolbarHitTest.test.ts` 10/10; `tsc` sem erro novo.

### T903 — Manager: hit-test no Linux e log de atalhos recusados
[x] T903
Depends On: T902
Allowed Paths: `apps/desktop/src/main/annotationOverlayWindow.ts`, `apps/desktop/src/main/annotationOverlayWindow.test.ts`
Prohibited Paths: `apps/desktop/src/main/nativeWindowTracker.ts`, `apps/desktop/src/main/cursorPresence.ts`,
`apps/desktop/src/main/doubleCtrlDetector.ts`, `apps/desktop/src/renderer/**`, `apps/backend/**`, `apps/web/**`,
`packages/**`
Checks:
- [x] `requestedIgnore` separado do valor aplicado; Windows/macOS chamam `setIgnoreMouseEvents` como hoje (RNF-901).
- [x] No Linux: temporizador de 16 ms só com overlay vivo e retângulo; aplica só quando o valor efetivo muda;
  parado em `stop()`, `closed` e retângulo `null` (RF-901, RNF-902).
- [x] `console.warn('[AnnotationOverlay] atalho recusado: <acc>')` para `false` e exceção (RF-903).
- [x] Testes com `electron` mockado e `process.platform` = `linux`/`win32`.
- [x] `annotationOverlayWindow.test.ts` 11/11; vitest desktop 116/116, `turbo test` 5/5; `tsc` sem erro novo.

### T904 — Overlay envia o retângulo da barra
[x] T904
Depends On: T901
Allowed Paths: `apps/desktop/src/renderer/components/FloatingAnnotationOverlay.tsx`,
`apps/desktop/src/renderer/components/FloatingAnnotationOverlay.test.tsx`
Prohibited Paths: `apps/desktop/src/renderer/media/**`, `apps/desktop/src/renderer/pages/**`, `apps/desktop/src/main/**`,
`apps/backend/**`, `apps/web/**`, `packages/**`
Checks:
- [x] União de barra + popover de cores enviada ao mudar posição, recolhida, orientação ou popover, com dedupe (RF-902).
- [x] `null` com o MLab em foco sem arraste (C-903) e ao desmontar.
- [x] Testes: envio inicial, recolher, popover, dedupe, `null` com MLab em foco.
- [x] `FloatingAnnotationOverlay.test.tsx` 14/14; vitest desktop 121/121, `turbo test` 5/5; `tsc` sem erro novo.

### T907 — Região de entrada pura da barra (C-904)
[x] T907
Depends On: T902
Allowed Paths: `apps/desktop/src/main/toolbarHitTest.ts`, `apps/desktop/src/main/toolbarHitTest.test.ts`
Prohibited Paths: `apps/desktop/src/main/annotationOverlayWindow.ts`, `apps/desktop/src/renderer/**`,
`apps/backend/**`, `apps/web/**`, `packages/**`
Checks:
- [x] `resolveInputRegion(requestedIgnore, rect, overlaySize)`: tela inteira com `requestedIgnore=false`; `[rect]`
  com `true` e retângulo; `[]` com `true` e `null` (RF-901, C-903).
- [x] `toDevicePixels(rects, scale)`: arredonda e multiplica pela escala; escala inválida vira 1.
- [x] `toolbarHitTest.test.ts` 16/16; vitest desktop 127/127, `turbo test` 5/5; `tsc` sem erro novo (14 pré-existentes).

### T908 — Módulo nativo da região de entrada X11 (C-904)
[x] T908
Depends On: T907
Allowed Paths: `apps/desktop/src/main/x11InputShape.ts`, `apps/desktop/src/main/x11InputShape.test.ts`
Prohibited Paths: `apps/desktop/src/main/nativeWindowTracker.ts`, `apps/desktop/src/main/annotationOverlayWindow.ts`,
`apps/desktop/src/renderer/**`, `apps/desktop/package.json`, `apps/backend/**`, `apps/web/**`, `packages/**`
Checks:
- [x] `createX11InputShaper()` carrega `libX11.so.6`/`libXext.so.6` via `koffi`, abre o display e devolve
  `{ apply(handle, rects), dispose() }`; devolve `null` sem `koffi`, sem biblioteca ou sem display.
- [x] `apply` lê o XID do `Buffer` (64 ou 32 bits), chama `XShapeCombineRectangles` com `ShapeInput`/`ShapeSet` e
  `XFlush`; XID 0 não chama nada.
- [x] Testes com `koffi` mockado: carregamento, falha → `null`, argumentos da chamada, XID 32/64 bits, `dispose`.
- [x] `x11InputShape.test.ts` 7/7; vitest desktop 134/134, `turbo test` 5/5; `tsc` sem erro novo.

### T909 — Manager usa a região de entrada no Linux (C-904)
[x] T909
Depends On: T907, T908
Allowed Paths: `apps/desktop/src/main/annotationOverlayWindow.ts`, `apps/desktop/src/main/annotationOverlayWindow.test.ts`
Prohibited Paths: `apps/desktop/src/main/nativeWindowTracker.ts`, `apps/desktop/src/main/cursorPresence.ts`,
`apps/desktop/src/main/doubleCtrlDetector.ts`, `apps/desktop/src/renderer/**`, `apps/backend/**`, `apps/web/**`,
`packages/**`
Checks:
- [x] No Linux com o módulo disponível: `setIgnoreMouseEvents(false)` uma vez; região reaplicada ao mudar o pedido, o
  retângulo, os limites (`setBounds`) e ao exibir; sem temporizador (RF-901, RNF-902).
- [x] Módulo `null` ou chamada que lança → hit-test da T903 (alternativa), com aviso único no log.
- [x] Windows/macOS sem mudança (RNF-901); `dispose` do módulo em `stop()`.
- [x] Testes com `electron` e `./x11InputShape` mockados; vitest desktop e `turbo test` verdes; `tsc` sem erro novo.
- [x] `annotationOverlayWindow.test.ts` 20/20 (11 da alternativa + 9 da região X11); vitest desktop 143/143,
  `turbo test` 5/5; `tsc` sem erro novo (14 pré-existentes).

### T911 — Erro X da região de entrada não encerra o processo (#32)
[ ] T911
Depends On: T908
Allowed Paths: `apps/desktop/src/main/x11InputShape.ts`, `apps/desktop/src/main/x11InputShape.test.ts`
Prohibited Paths: `apps/desktop/src/main/nativeWindowTracker.ts`, `apps/desktop/src/main/annotationOverlayWindow.ts`,
`apps/desktop/src/renderer/**`, `apps/desktop/package.json`, `apps/backend/**`, `apps/web/**`, `packages/**`
Checks:
- [ ] `apply` instala um `XSetErrorHandler` próprio só durante a chamada, troca `XFlush` por `XSync` (o erro chega ali
  mesmo) e devolve o handler anterior, também quando a chamada lança.
- [ ] `BadWindow` (código 3) é ignorado com `console.warn` (o overlay fechou); qualquer outro erro X lança, e o manager
  volta ao hit-test (RF-901).
- [ ] Testes com `koffi` mockado: handler instalado e restaurado, `XSync`, `BadWindow` ignorado, outro erro lança,
  restauração após exceção.
- [ ] Verificação no X real (XWayland): região aplicada a um XID destruído não encerra o processo.
- [ ] `x11InputShape.test.ts` e suítes da 009 verdes; `tsc --noEmit` sem erro novo.

### T905 — Verificação manual no Linux (WSLg) e smoke no Windows
[x] T905
Depends On: T903, T904, T909
Allowed Paths: `spec-kit/specs/009-marcacao-linux/**`
Prohibited Paths: `apps/**`, `packages/**`
Checks:
- [x] Testes do desktop rodados também no WSL (Linux): suítes da 009 verdes (16 + 20 + 7); única falha é a
  pré-existente de `nativeWindowTracker.test.ts` (abaixo).
- [x] App no WSLg: clique nos botões, recolher/expandir, ferramenta de desenho na tela inteira e atalhos `Alt+…`
  confirmados pelo responsável; nenhum atalho recusado no log (US-901 a US-903). Evidências em
  `evidencias/t905-wslg-hit-test.log` (falha antes da C-904) e `evidencias/t905-wslg-regiao-entrada.log` (depois).
  Letras únicas após clicar na barra não foram verificadas separadamente — pendência no converge.
- [x] Windows sem regressão nos testes: `annotationOverlayWindow.test.ts` cobre o caminho Windows (RNF-901) e as suítes
  passam no Windows (143/143, `turbo test` 5/5). **Smoke manual no Windows não executado nesta rodada** —
  pendência registrada no converge.

Achados de 2026-11-05 (WSL):
- vitest desktop no Linux: 119/121, 15/16 arquivos; `nativeWindowTracker.test.ts` derruba o worker com
  `X Error of failed request: BadWindow`. Causa: `createLinuxX11Tracker` não instala `XSetErrorHandler`, e o handler
  padrão do Xlib chama `exit()` diante de um XID inválido (no app real, pode encerrar o processo principal se a janela
  capturada fechar). Fora da 009 (`nativeWindowTracker.ts` é path proibido): exige tarefa/feature própria.
- `tsc --noEmit`: os mesmos 14 erros pré-existentes; nenhum novo.
- App no WSLg: atalhos `Alt+…` funcionam e nenhum foi recusado; botões da barra fora da janela do MLab só respondem às
  vezes — `getCursorScreenPoint()` congela sob XWayland (`evidencias/t905-wslg-hit-test.log`). Resolvido pela C-904
  (T907–T909, commit `1f48d62`).
- Com o MLab em foco a barra flutuante some (C-903) e o painel usa a barra interna; a passagem painel → overlay ao
  sair da janela do MLab depende do `CursorPresenceTracker` (fora da 009) e não foi comprovada no WSLg.

### T906 — Converge
[x] T906
Depends On: T905
Allowed Paths: `spec-kit/specs/009-marcacao-linux/**`
Prohibited Paths: `apps/**`, `packages/**`
Checks:
- [x] `converge.md` criado comparando código com spec/plan/tasks, com pendências (ex.: Ubuntu/GNOME real).
  Resultado: OPEN — pendências com encaminhamento (contrato, RF-904, Ubuntu real, smoke Windows, `nativeWindowTracker`
  e `CursorPresenceTracker` sob XWayland).
