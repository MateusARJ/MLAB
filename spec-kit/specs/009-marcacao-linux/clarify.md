# Clarify: Barra de Marcação no Linux

Feature: `009-marcacao-linux`
Status: CLOSED

Decisões tomadas com o responsável em 2026-11-03 e 2026-11-04 (issue #30).

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

## Resultado

CLOSED — C-901, C-902 e C-903 respondidas; nenhuma ambiguidade em aberto.
