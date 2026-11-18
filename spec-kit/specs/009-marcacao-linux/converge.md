# Converge: Barra de Marcação no Linux

Feature: `009-marcacao-linux`
Mode: READ-ONLY sobre o código (só este arquivo é escrito)
Data: 2026-11-05; atualizado em 2026-11-17 (T910, T911) e 2026-11-18 (smoke no Windows)
Commit avaliado: `1f48d62`; atualização sobre `9f69048` (2.1.4)
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-901 a C-904), `plan.md`, `tasks.md` (T901–T911), `003/contracts/desktop-ipc.md`
- código em `apps/desktop/src/main/{annotationOverlayWindow,toolbarHitTest,x11InputShape,main,preload}.ts`,
  `apps/desktop/src/renderer/components/FloatingAnnotationOverlay.tsx`, `packages/types/src/index.ts`
- suítes: Windows — `npx vitest run` (desktop) 143/143, `npx turbo run test --force` 5/5, `npx tsc --noEmit` com os 14
  erros pré-existentes; WSL (Ubuntu 26.04) — suítes da 009 verdes (`toolbarHitTest` 16, `annotationOverlayWindow` 20,
  `x11InputShape` 7), suíte geral 141/143 por causa de `nativeWindowTracker.test.ts` (seção 5)
- verificação manual no WSLg: `evidencias/t905-wslg-hit-test.log`, `evidencias/t905-wslg-regiao-entrada.log`
- 2026-11-17, Ubuntu 26.04.1 real (GNOME Shell 50.1): `evidencias/t910-ubuntu-testes.log` (vitest, `tsc`, `turbo`,
  `go test`), `evidencias/t910-ubuntu-roteiro.md` (roteiro manual em GNOME Wayland, escala 200% e Openbox/X11),
  `evidencias/t911-xwayland-badwindow.log` (erro X da região de entrada)
- 2026-11-18, Windows 11 real: `evidencias/t910-windows-smoke.md` (smoke manual da barra)

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-901 | `x11InputShape.ts` + `applyInputRegion` em `annotationOverlayWindow.ts` (`10cc5bc`, `1f48d62`); `resolveInputRegion`/`toDevicePixels` (`1d2226c`); testes "região de entrada X11" (9) e "hit-test alternativo" (11); WSLg e Ubuntu real (GNOME Wayland, 200% e Openbox/X11): botões e popover respondem, clique fora da barra atravessa, desenho em toda a tela, arraste (T910); erro X tratado sem encerrar o app (T911, `9ba0212`) |
| RF-902 | `reportToolbarRect` em `FloatingAnnotationOverlay.tsx` (`1429cdd`); 5 testes no `FloatingAnnotationOverlay.test.tsx`; WSLg: retângulos `496×46`, `496×239` (popover), `54×54` (recolhida), `null`; Ubuntu real: recolher/expandir e arraste (T910) |
| RF-903 | `registerGlobalShortcuts` (`6780e13`); 3 testes; WSLg e Ubuntu real: nenhum atalho recusado no log; `Alt+…` e `Alt+H` funcionam (T910) |
| RF-904 | Ubuntu real (Wayland e X11): letras únicas trocam a ferramenta depois de clicar na barra (T910) |
| RNF-901 | Windows e macOS mantêm `setIgnoreMouseEvents(true, { forward: true })` (`annotationOverlayWindow.test.ts`); smoke manual no Windows 11 sem regressão: cliques, recolher/expandir, desenho, lupa, atalhos e duplo `Ctrl` (T910, `evidencias/t910-windows-smoke.md`) |
| RNF-902 | sem temporizador com a região X11 (`expect(vi.getTimerCount()).toBe(0)`); temporizador de 16 ms só na alternativa |
| RN-901 | regras da 003 intocadas; C-903 preservada (retângulo `null` → região vazia, teste dedicado); Ubuntu real: passagem do painel do MLab para o overlay funcionou (T910); Windows 11: barra interna com o MLab em foco e anotação sem regressão (T910) |

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta | Evidência |
|---|---|---|
| — | — | nenhum; o smoke no Windows foi feito em 2026-11-18 (seção 1) |

## 3. Divergências (código ≠ spec/plan/contrato)

| Item | Spec/contrato diz | Código faz | Encaminhamento (emenda, ADR, nova task) |
|---|---|---|---|
| — | — | — | nenhuma; a emenda do texto do canal `annotation-overlay:toolbar-rect` foi feita na T910 (`00c7614`) |

## 4. Código sem requisito (implementado fora de spec/task)

| Comportamento | Onde | Encaminhamento |
|---|---|---|
| — | — | nenhum |

## 5. Testes faltantes

- Nenhum na 009; o smoke no Windows foi feito em 2026-11-18.
- No Linux, `nativeWindowTracker.test.ts` derruba o worker (`BadWindow`): fora da 009, #139.

## 6. Novas tasks necessárias

- **009:** nenhuma.
- **Fora da 009:** #139 (`nativeWindowTracker.ts` sem `XSetErrorHandler`); #140 (`CursorPresenceTracker` sob
  XWayland — no roteiro da T910 a passagem do painel para o overlay funcionou no GNOME 50, então a #140 precisa de um
  cenário que a reproduza ou pode ser reavaliada); #138 (pacote Linux gerado no WSL sem o binário do `koffi`: o app
  instalado ainda reproduz a #30).

## Desvios registrados

- #138, #139, #140 (AGENTS.md §14), todos não bloqueantes para a 009.

## 7. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| MINOR | 1.8.0 | A 009 cria requisitos novos (RF-901 a RF-904, RNF-901, RNF-902) e um canal IPC novo e compatível (`annotation-overlay:toolbar-rect`, tipo `AnnotationToolbarRect`), sem quebrar contrato nem fluxo existente. O PR #31 entrou antes da regra do §13 do `AGENTS.md` chegar ao branch; o incremento foi feito em PR próprio logo depois. |
| PATCH | 2.1.4 | T911 (2026-11-17): correção de estabilidade em `x11InputShape.ts` (erro X tratado com handler temporário e `XSync`, sem `exit()` do Xlib). Sem capacidade nova e sem mudança de contrato. |

## 8. Resultado

- [ ] OPEN
- [x] CONVERGED — não há divergência, código sem requisito ou teste faltante na 009 (os desvios #138, #139 e #140 ficam fora dela).

Limitações do ambiente (não são gaps da feature):

- No WSLg, janelas Linux não ficam acima de apps nativos do Windows, então o overlay e os desenhos ficam atrás deles
  quando um app do Windows vem para a frente.
- No GNOME Wayland (XWayland), o atalho global só dispara com uma janela X11 em foco; com app Wayland nativo em foco,
  `Alt+…` não chega (comportamento previsto pela US-903).
- O GNOME 50 não tem sessão X11; o X11 puro foi verificado na sessão Openbox.
