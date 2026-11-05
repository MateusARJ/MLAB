# Clarify: Barra de Marcação no Linux

Feature: `009-marcacao-linux`
Status: CLOSED

Decisões tomadas com o responsável em 2026-11-03, 2026-11-04 e 2026-11-05 (issue #30).

## C-901 — Como o overlay sabe que o ponteiro está sobre a barra no Linux

- **Contexto:** o overlay fica em click-through com `setIgnoreMouseEvents(true, { forward: true })`. A opção `forward`
  só existe no Windows e no macOS; no Linux o renderer não recebe `mousemove`/`mouseenter`, então
  `handleToolbarMouseEnter` nunca roda e `updateIgnoreMouse` nunca pede `ignore=false` (confirmado em
  `annotationOverlayWindow.ts` e `FloatingAnnotationOverlay.tsx`).
- **Alternativas consideradas:** forma de entrada X11 (`XShape`) recortada na barra — exige código nativo e não vale
  no Wayland; janela separada só para a barra — muda a arquitetura do overlay da 003.
- **Resposta aprovada:** o renderer informa o retângulo da barra ao main; no Linux o main testa a posição do ponteiro
  (`screen.getCursorScreenPoint()`) contra esse retângulo a cada 16 ms e tira o overlay do click-through enquanto o
  ponteiro estiver sobre a barra. Vale em X11 e em Wayland com XWayland (padrão do Electron 31); Wayland nativo
  (`--ozone-platform=wayland`) fica fora.

## C-902 — Atalhos no Linux

- **Contexto:** `globalShortcut` não funciona em Wayland sem o portal de atalhos globais, e o ambiente gráfico pode
  reservar combinações com `Alt`. Hoje a recusa é engolida em silêncio. O overlay abre com `showInactive()`, sem foco.
- **Alternativas consideradas:** portal `GlobalShortcuts` do Wayland — exige upgrade do Electron; chamar `focus()` no
  overlay ao entrar na barra — rouba o foco da janela do professor sem clique.
- **Resposta aprovada:** sem portal e sem `focus()` explícito. O main registra em log cada atalho recusado; os atalhos
  de letra única do overlay passam a funcionar porque o clique aceito na barra (C-901) dá o foco ao overlay
  `focusable`. O duplo `Ctrl` continua exclusivo do Windows (003, RF-309).

## C-903 — Paridade com o Windows quando o MLab está em foco

- **Contexto:** quando `mlabFocused` é verdadeiro e não há arraste, `updateIgnoreMouse` força click-through para a
  janela do MLab receber todos os cliques, mesmo com o ponteiro sobre a barra. Um hit-test no main que só olhasse o
  retângulo desfaria isso no Linux.
- **Resposta aprovada:** nesse estado o renderer envia retângulo `null`; o hit-test fica desligado e o comportamento
  é o mesmo do Windows.

## C-904 — Hit-test por posição do ponteiro falha sob XWayland (reabre C-901)

- **Contexto:** na T905 (WSLg 1.0.79, Ubuntu 26.04, Electron 31 via XWayland, 2026-11-05) o app abriu, a barra
  recebeu o retângulo (RF-902) e o hit-test rodou, mas os botões da barra só respondiam às vezes. O log
  (`evidencias/t905-wslg-hit-test.log`) mostra `screen.getCursorScreenPoint()` **parado** por dezenas de segundos
  (ex.: 140 amostras em `797,633`, 80 em `828,746`) enquanto o professor movia o mouse, e depois **saltando** para
  perto da barra. O XWayland só conhece o ponteiro quando ele está sobre uma janela X11; o overlay em click-through
  não tem região de entrada, então sobre janelas do Windows (WSLg) ou de apps Wayland nativos (GNOME-Wayland) a
  posição congela e o hit-test nunca vê o ponteiro chegar à barra. Só funciona quando há uma janela X do MLab
  embaixo da barra. A premissa de C-901 ("vale em Wayland com XWayland") não se confirmou; em X11 puro
  (`XQueryPointer` global) continua válida, mas ainda não foi testada em Ubuntu/GNOME X11 real.
- **Alternativas:**
  - **A — Região de entrada X11 recortada na barra (recomendada).** No Linux o main deixa de alternar
    `setIgnoreMouseEvents` por polling e define a região de entrada do overlay com `XShapeCombineRectangles`
    (`ShapeInput`, `libXext.so.6`) via `koffi` (dependência já existente, usada em `nativeWindowTracker.ts`) no XID de
    `getNativeWindowHandle()`: retângulo da barra com a ferramenta cursor; tela inteira com ferramenta de desenho;
    vazia com o MLab em foco sem arraste (C-903). É o mesmo mecanismo que o Electron usa no X11 para o click-through, e
    o XWayland repassa a região ao compositor, então vale em X11, XWayland e WSLg. Remove o temporizador de 16 ms
    (muda RNF-902) e reaproveita o retângulo de RF-902. Riscos: o Electron pode reaplicar a forma ao mudar
    `setIgnoreMouseEvents`, ao redimensionar ou ao reexibir a janela (o main passa a ser o único dono da região no
    Linux); exige `libXext.so.6` (já presente nas dependências do Chromium no Linux); código nativo novo e isolado,
    validado primeiro por um spike no WSLg. Wayland nativo (`--ozone-platform=wayland`) continua fora.
  - **B — Janela própria para a barra no Linux.** Uma `BrowserWindow` pequena, sem click-through, só com a barra;
    o overlay de tela inteira fica sempre em click-through com a ferramenta cursor. Funciona em qualquer ambiente,
    mas muda a arquitetura do overlay da 003 (duas janelas, sincronização de estado, posição, captura da barra e
    foco), com escopo bem maior.
  - **C — Limitar o suporte a X11.** Mantém o código da T903/T904, documenta que a barra fora do app só funciona em
    sessão X11 e usa o WSLg só para testes. Não resolve a issue #30 para quem usa GNOME-Wayland (padrão do Ubuntu).
- **Impacto em artefatos se aprovada A:** spec (RF-901 e RNF-902), plan (Technical Context, riscos, Allowed Paths
  com um módulo novo `apps/desktop/src/main/x11InputShape.ts` + teste), tasks (novas T907+; T903 parcialmente
  substituída) e analyze (nova rodada até `PASS`).
- **Resposta aprovada (2026-11-05):** alternativa **A**, condicionada a um spike no WSLg que comprove que a região de
  entrada recortada recebe os cliques na barra e deixa o resto da tela atravessar. Se o spike falhar, a C-904 volta
  ao responsável antes de qualquer mudança em spec/plan/tasks. **Spike aprovado no mesmo dia** (região de entrada
  alternando entre barra e tela inteira, sem erro do X; botões respondem com o ponteiro vindo de janelas do Windows).

## Resultado

CLOSED — C-901 a C-904 respondidas. A C-904 (2026-11-05) reabriu a C-901 após a T905 e foi aprovada com a
alternativa A, validada por spike no WSLg (botões da barra respondem e o resto da tela atravessa); nenhuma
ambiguidade em aberto.
