# Converge: Barra de Marcação no Linux

Feature: `009-marcacao-linux`
Mode: READ-ONLY sobre o código (só este arquivo é escrito)
Data: 2026-11-05
Commit avaliado: `1f48d62`
Status: OPEN

## Entradas

- `spec.md`, `clarify.md` (C-901 a C-904), `plan.md`, `tasks.md` (T901–T909), `003/contracts/desktop-ipc.md`
- código em `apps/desktop/src/main/{annotationOverlayWindow,toolbarHitTest,x11InputShape,main,preload}.ts`,
  `apps/desktop/src/renderer/components/FloatingAnnotationOverlay.tsx`, `packages/types/src/index.ts`
- suítes: Windows — `npx vitest run` (desktop) 143/143, `npx turbo run test --force` 5/5, `npx tsc --noEmit` com os 14
  erros pré-existentes; WSL (Ubuntu 26.04) — suítes da 009 verdes (`toolbarHitTest` 16, `annotationOverlayWindow` 20,
  `x11InputShape` 7), suíte geral 141/143 por causa de `nativeWindowTracker.test.ts` (seção 5)
- verificação manual no WSLg: `evidencias/t905-wslg-hit-test.log`, `evidencias/t905-wslg-regiao-entrada.log`

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-901 | `x11InputShape.ts` + `applyInputRegion` em `annotationOverlayWindow.ts` (`10cc5bc`, `1f48d62`); `resolveInputRegion`/`toDevicePixels` (`1d2226c`); testes "região de entrada X11" (9) e "hit-test alternativo" (11); WSLg: região alterna barra ↔ tela inteira ↔ botão recolhido e o responsável confirmou cliques na barra e desenho em toda a tela |
| RF-902 | `reportToolbarRect` em `FloatingAnnotationOverlay.tsx` (`1429cdd`); 5 testes no `FloatingAnnotationOverlay.test.tsx`; WSLg: retângulos `496×46`, `496×239` (popover), `54×54` (recolhida), `null` |
| RF-903 | `registerGlobalShortcuts` (`6780e13`); 3 testes; WSLg: nenhum atalho recusado no log |
| RNF-901 | caminho Windows/macOS inalterado; teste "Windows (009/RNF-901)"; suítes verdes no Windows |
| RNF-902 | sem temporizador com a região X11 (`expect(vi.getTimerCount()).toBe(0)`); temporizador de 16 ms só na alternativa |
| RN-901 | regras da 003 intocadas; C-903 preservada (retângulo `null` → região vazia, teste dedicado) |

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta | Evidência |
|---|---|---|
| RF-904 | letras únicas do overlay depois de clicar na barra não foram verificadas separadamente no WSLg | T905; o responsável confirmou atalhos `Alt+…` |
| Critérios de sucesso | teste em Ubuntu/GNOME real (X11 e Wayland) e smoke manual da barra no Windows não executados | T905 |

## 3. Divergências (código ≠ spec/plan/contrato)

| Item | Spec/contrato diz | Código faz | Encaminhamento (emenda, ADR, nova task) |
|---|---|---|---|
| Texto do canal `annotation-overlay:toolbar-rect` em `003/contracts/desktop-ipc.md` | retângulo "para o hit-test do Linux" | o retângulo alimenta a região de entrada X11 e, na falta dela, o hit-test | emenda textual no contrato (sem mudança de formato) |

## 4. Código sem requisito (implementado fora de spec/task)

| Comportamento | Onde | Encaminhamento |
|---|---|---|
| — | — | nenhum |

## 5. Testes faltantes

- Teste manual em Ubuntu/GNOME real, sessões X11 e Wayland (XWayland), incluindo escala de 200%.
- Smoke manual da barra no Windows.
- No WSL, `nativeWindowTracker.test.ts` derruba o worker (`X Error of failed request: BadWindow`): fora da 009, ver
  seção 6.

## 6. Novas tasks necessárias

- **Fora da 009 — Xlib sem `XSetErrorHandler` em `nativeWindowTracker.ts`:** um XID inválido aciona o handler padrão
  do Xlib, que chama `exit()`; no app real, pode encerrar o processo principal se a janela capturada fechar. Exige
  feature/tarefa própria (o arquivo é path proibido aqui).
- **Fora da 009 — `CursorPresenceTracker` sob XWayland:** `mlabFocused` e a posição do cursor vêm de
  `getCursorScreenPoint()`/`XQueryPointer`, que congelam fora de janelas X11 (mesma causa da C-904). A passagem do
  painel do MLab para o overlay ao sair da janela do MLab não foi comprovada no WSLg. Investigar em feature própria.
- **009 — emenda do contrato** da seção 3.
- **009 — verificação pendente:** RF-904 (letras únicas), Ubuntu/GNOME real e smoke Windows.

## 7. Resultado

- [x] OPEN — há gaps registrados acima com encaminhamento definido.
- [ ] CONVERGED — não há divergência, código sem requisito ou teste faltante.

Limitação do ambiente (não é gap da feature): no WSLg, janelas Linux não ficam acima de apps nativos do Windows, então
o overlay e os desenhos ficam atrás deles quando um app do Windows vem para a frente.
