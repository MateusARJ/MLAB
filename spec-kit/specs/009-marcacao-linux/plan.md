# Plan: Barra de Marcação no Linux

Feature: `009-marcacao-linux`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-901 a C-903; C-904 aprovada em 2026-11-05 após spike no WSLg)

## 1. Summary

1. **Retângulo da barra (RF-902)** — o overlay (`FloatingAnnotationOverlay.tsx`) mede a barra e o popover de cores com
   `getBoundingClientRect` e envia ao main pelo novo canal `annotation-overlay:toolbar-rect` quando o retângulo muda
   (posição, recolhida, orientação, popover, barra oculta → `null`). Envio com deduplicação: só quando os valores mudam.
   Com o MLab em foco e sem arraste, envia `null` (C-903): o renderer já força click-through nesse estado e o hit-test
   do Linux não pode desfazer isso.
2. **Hit-test no main (RF-901, RNF-901, RNF-902)** — novo módulo puro `toolbarHitTest.ts` com
   `isPointerOverToolbar(cursorDip, overlayBounds, rect)` e `resolveIgnoreMouse(requestedIgnore, pointerOverToolbar)`.
   O `AnnotationOverlayManager` guarda o pedido do renderer (`requestedIgnore`) e, **só no Linux**, roda um
   temporizador de 16 ms enquanto o overlay existe e há retângulo: lê `screen.getCursorScreenPoint()`, testa contra o
   retângulo (convertido para tela com `overlayWin.getBounds()`) e aplica `setIgnoreMouseEvents(efetivo)` só quando o
   valor efetivo muda. Efetivo = `requestedIgnore && !pointerOverToolbar`. No Windows/macOS o caminho atual fica igual.
   **Desde a C-904, este hit-test é só a alternativa** para quando a região de entrada X11 (item 5) não puder ser usada.
3. **Atalhos (RF-903, RF-904)** — `registerGlobalShortcuts` registra em log (`console.warn` com o acelerador) quando
   `globalShortcut.register` devolve `false` ou lança. Os atalhos locais passam a funcionar porque, com o clique
   aceito (item 2), o overlay `focusable` recebe o foco no clique.
4. **Contrato** — canal novo registrado em `003/contracts/desktop-ipc.md` e em `ElectronAPI` (`preload.ts`); tipo
   `AnnotationToolbarRect` em `packages/types`. O handler em `main.ts` só aceita mensagens do webContents do overlay e
   o manager valida o retângulo (números finitos, largura e altura > 0 e no máximo 2× o display; senão trata como `null`).
5. **Região de entrada X11 (C-904, RF-901, RNF-902)** — no WSLg o `getCursorScreenPoint()` congela fora de janelas
   X11 (`evidencias/t905-wslg-hit-test.log`), então o caminho principal no Linux passa a ser recortar a região de
   entrada do overlay. Função pura `resolveInputRegion(requestedIgnore, toolbarRect, overlaySize)` em
   `toolbarHitTest.ts` (tela inteira / barra / vazia) e `toDevicePixels(rects, scale)`. Módulo novo
   `x11InputShape.ts` carrega `libX11.so.6` e `libXext.so.6` via `koffi` (já é dependência) e chama
   `XShapeCombineRectangles(dpy, xid, ShapeInput, 0, 0, rects, n, ShapeSet, Unsorted)` + `XFlush` no XID de
   `getNativeWindowHandle()`; devolve `null` se não carregar (ex.: sem `DISPLAY` ou sem `libXext`). O manager, no
   Linux com o módulo disponível, chama `setIgnoreMouseEvents(false)` uma vez e passa a ser o único dono da região:
   reaplica ao mudar o pedido, o retângulo ou os limites do overlay (`setBounds` em `forwardCursorState`) e ao
   exibir a janela; sem temporizador. Se o módulo for `null` ou a chamada lançar, volta ao hit-test do item 2.
   Validado por spike no WSLg (2026-11-05): botões da barra respondem com o ponteiro vindo de janelas do Windows, o
   resto da tela atravessa e a ferramenta de desenho captura a tela inteira.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Plataforma | `process.platform === 'linux'` liga a região de entrada (ou o hit-test alternativo); demais plataformas sem mudança | RNF-901 |
| Região de entrada | `XShapeCombineRectangles` (`ShapeInput`=2, `ShapeSet`=0) via `koffi`, em px físicos (DIP × `scaleFactor` do display do overlay) | RF-901, C-904 |
| XID do overlay | `getNativeWindowHandle()` lido como inteiro de 64 bits (LE) ou 32 bits | C-904 |
| Coordenadas | retângulo em px CSS do overlay (= DIP); soma `overlayWin.getBounds().x/y` para tela | RF-901 |
| Margem | 4 px de folga em volta do retângulo, para a borda não piscar | RF-901 |
| Temporizador | só na alternativa: `setInterval` 16 ms, parado em `stop()` e quando o retângulo é `null` | RNF-902 |
| Log de atalho | `console.warn('[AnnotationOverlay] atalho recusado: <acc>')` | RF-903 |
| Foco | sem `focus()` explícito; o clique no overlay `focusable` dá o foco | C-902 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Escala de DPI no Linux diferente de DIP | hit-test deslocado | `getCursorScreenPoint` e `getBounds` são DIP; verificação manual com escala 100% e 200% se disponível |
| Clique atravessar no primeiro quadro | 1º clique perdido | folga de 4 px e ciclo de 16 ms (o ponteiro chega à barra antes do clique) |
| Foco preso no overlay após clicar | teclas do app do professor vão ao overlay | só letras sem modificador são tratadas pelo overlay; registrar no teste manual |
| Wayland nativo sem XWayland | sem X11, não há região de entrada nem cursor global | Electron 31 usa XWayland por padrão; fora do escopo (C-901, C-904) |
| Electron reaplicar a forma de entrada | região de entrada perdida | manager não chama `setIgnoreMouseEvents` depois da 1ª vez no Linux e reaplica a região após `setBounds` e ao exibir |
| `BadWindow` no Xlib encerra o processo | app fecha | só chama com a janela viva (`!isDestroyed()`); XID lido a cada chamada |
| WSLg: janela Linux abaixo de apps do Windows | desenhos somem atrás deles | limitação do ambiente, registrada no converge; validar em Ubuntu/GNOME real |

## Scope Lock

### IN

- click-through da barra de marcação no Linux; retângulo da barra; log de atalhos recusados;
- contrato IPC do novo canal; tipo compartilhado do retângulo;
- testes unitários e teste manual no Linux (GNOME/X11 e WSLg).

### OUT

- duplo toque em `Ctrl` no Linux (003 define como exclusivo do Windows);
- atalhos globais via portal do Wayland e upgrade do Electron;
- comportamento no Windows e no macOS; máscara de cursor, captura, backend e web.

### Allowed Paths

- `apps/desktop/src/main/annotationOverlayWindow.ts`
- `apps/desktop/src/main/toolbarHitTest.ts`, `apps/desktop/src/main/toolbarHitTest.test.ts`
- `apps/desktop/src/main/x11InputShape.ts`, `apps/desktop/src/main/x11InputShape.test.ts` (C-904)
- `apps/desktop/src/main/annotationOverlayWindow.test.ts`
- `apps/desktop/src/main/main.ts` (só o handler do canal novo)
- `apps/desktop/src/main/preload.ts`
- `apps/desktop/src/renderer/components/FloatingAnnotationOverlay.tsx`
- `apps/desktop/src/renderer/components/FloatingAnnotationOverlay.test.tsx`
- `apps/desktop/src/test/setup.ts` (mock do método novo)
- `packages/types/src/index.ts` (tipo `AnnotationToolbarRect`)
- `spec-kit/specs/003-classroom-interaction/contracts/desktop-ipc.md`
- `spec-kit/specs/009-marcacao-linux/**`

### Prohibited Paths

- `apps/backend/**`, `apps/web/**`, `packages/ui/**`
- `apps/desktop/src/main/nativeWindowTracker.ts`, `apps/desktop/src/main/cursorPresence.ts`,
  `apps/desktop/src/main/doubleCtrlDetector.ts`
- `apps/desktop/src/renderer/media/**`, `apps/desktop/src/renderer/pages/**`, `apps/desktop/package.json`

### Dependencies

- Nenhuma nova no `package.json`. Existentes: `electron` (`screen`, `globalShortcut`, `BrowserWindow`), `koffi`
  (já usado por `nativeWindowTracker.ts`), `vitest`, `@testing-library/react`.
- Bibliotecas do sistema carregadas em tempo de execução (C-904): `libX11.so.6` e `libXext.so.6`, já exigidas pelo
  Electron no Linux.

### Non-Goals

- redesenhar a barra; mudar atalhos ou ferramentas;
- suportar Wayland nativo (`--ozone-platform=wayland`);
- devolver o foco à janela anterior depois de clicar na barra.

## 4. Constitution Check

- [x] Princípio I — spec aprovada.
- [x] Princípio II — sem regra de autorização; o canal novo só aceita um retângulo numérico validado no main.
- [x] Princípio III — SFU intocada.
- [x] Princípio IV — nenhuma meta de desempenho declarada; custo do temporizador limitado ao Linux.
- [x] Princípio V — contrato IPC atualizado (canal novo).
- [x] Princípio VI — Scope Lock e paths por task.
- [x] Princípio VII — um módulo puro pequeno, testável sem Electron.
- [ ] Princípio VIII — converge ao final (T906).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-03 | Hit-test da barra no main só no Linux, com temporizador próprio | C-901, RNF-902 |
| 2026-11-03 | Atalhos globais via portal do Wayland fora do escopo; foco pelo clique | C-902 |
| 2026-11-04 | Feature renumerada de 008 para 009 (colisão com `008-dev-entrada-unica-web`); IDs 8xx → 9xx | — |
| 2026-11-04 | Retângulo `null` com o MLab em foco, para manter paridade com o Windows | C-903 |
| 2026-11-05 | Região de entrada X11 via `koffi` como caminho principal no Linux; hit-test vira alternativa | C-904 |
