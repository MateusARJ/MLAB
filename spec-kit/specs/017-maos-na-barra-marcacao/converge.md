# Converge: Mãos Levantadas na Barra de Marcação

Feature: `017-maos-na-barra-marcacao`
Mode: READ-ONLY sobre o código (só este arquivo e o `tasks.md` são escritos)
Data: 2026-11-10
Commit avaliado: `1bb67f6`
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-171 a C-179), `plan.md`, `tasks.md` (T171–T175), contrato
  `003/contracts/desktop-ipc.md`
- código: `apps/desktop/src/main/{annotationOverlayWindow.ts,main.ts,preload.ts}`, `apps/desktop/src/test/setup.ts`,
  `apps/desktop/src/renderer/{pages/Room.tsx,components/FloatingAnnotationOverlay.tsx}`
- suítes: desktop `vitest run` (18 arquivos, 165 testes verdes; eram 151, +14 da 017); `tsc --noEmit` com os mesmos
  14 erros da #51 antes e depois, nenhum nos trechos da 017; `npm run spec:check` (PASS)
- smoke manual A15b (2026-11-10): roteiro `docs/metrics/smoke-runbook.md` (A15b) executado pelo responsável a partir
  da branch `feat/maos-levantadas-barra-marcacao`, que relatou todos os passos verificados e a feature aprovada

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-171 | `RaisedHandsIndicator` em `FloatingAnnotationOverlay.tsx`; testes "barra expandida horizontal/vertical" e "barra recolhida" (`e026863`); A15b passos 2 e 4 |
| RF-172 | borda `#facc15` + anel no `boxShadow`, sem `animation`; testes de orientação e recolhida (`e026863`); A15b passo 2 |
| RF-173 | badge `1`–`9` e `9+`; teste "mostra o número até 9 e 9+ a partir de 10" (`e026863`) |
| RF-174 | `role="img"`, `aria-label`/`title` "Mãos levantadas: N" com N real; nenhum texto visível sobre mãos (mesmo teste); A15b passo 2 |
| RF-175 | indicador só com `raisedHands > 0`; teste "sem mãos levantadas, a barra fica igual à atual"; A15b passo 6 |
| RF-176 | `Room.tsx` usa a contagem de `raisedHandsStudents`; teste do `Room` com levantar, abaixar e saída (`59a06ac`); main reenvia só na mudança (`08a2548`); A15b passos 3, 5 e 6 |
| RF-177 | indicador é `span` sem handlers; teste "clicar no indicador não troca ferramenta…" (`e026863`); A15b passo 3 |
| RF-178 | indicador dentro de `toolbarRef`, sujeito a `showFloatingToolbar`; teste "segue a visibilidade da barra…" (`e026863`) |
| RF-179 | canal `annotation-overlay:raised-hands` só com número; teste do `Room` confirma chamadas `[[2], [1], [0]]` (`59a06ac`); `preload.ts` repassa só números (`08a2548`) |
| RF-180 | badges e fila do `Room` intocados; 27 testes anteriores do `Room` verdes (`59a06ac`) |
| RNF-171 | contagem fora de `AnnotationSessionState`; teste do `Room` confirma que `syncAnnotationState` não é chamado nas mudanças de mão; nenhum arquivo de `media/**` alterado |
| RNF-172 | `setRaisedHands` descarta o overlay e não inteiros ≥ 0; testes do main (`08a2548`) e da barra (`e026863`) |
| RNF-173 | badge dentro da caixa do indicador; `reportToolbarRect` depende de `raisedHands`; teste "reenvia o retângulo da barra…" (`e026863`) |
| RNF-174 | A15b: número legível nas barras expandida e recolhida (relato do responsável) |
| RNF-175 | `Touch_1Filled` de `@mlab/ui`; nenhum `package.json` alterado fora do bump |
| RN-171 | nota na US-19 da 003 (`1bb67f6`); A15b passo 7 aprovado no relato do responsável |
| RN-172 | fila e ação de abaixar continuam só no `Room`; indicador sem ação |
| Estados §7 (overlay recriado, antes do `start()`, `stop()`) | testes do main "valor recebido antes do start()…" e "stop() volta a contagem para 0" (`08a2548`) |

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta | Evidência |
|---|---|---|
| — | — | nenhum |

## 3. Divergências (código ≠ spec/plan/contrato)

| Item | Spec/contrato diz | Código faz | Encaminhamento |
|---|---|---|---|
| — | — | — | nenhuma; canais e métodos iguais ao `desktop-ipc.md` |

## 4. Código sem requisito (implementado fora de spec/task)

| Comportamento | Onde | Encaminhamento |
|---|---|---|
| — | — | nenhum; o fake de `BrowserWindow` do teste do main passou a registrar `send`/`on` do `webContents`, só para os testes da T171 |

## 5. Testes faltantes

- Nenhum automatizado. Limite registrado: o passo 9 do A15b (regressão da barra no Linux) é condicional, e o relato
  não detalha se houve ambiente Linux; a área clicável no Linux fica coberta pelo teste do retângulo (RNF-173) e
  segue sem validação em Ubuntu real, como toda a 009 (#32).

## 6. Novas tasks necessárias

- Nenhuma.

## 7. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| #62 — comentário do preload diz que o overlay é invisível na captura | documentation, desvio, area:desktop | não | aberta; a 017 registra o comportamento real (RN-171) |
| #51 — `tsc --noEmit` do desktop falha com 14 erros na `development` | bug, desvio, area:desktop | não | aberta; mesma contagem antes e depois, nenhum erro nos trechos da 017 |
| #50 — validador ignora tarefas com ID de 4 dígitos | bug, desvio, area:spec-kit | não | aberta; a 017 usa IDs de 3 dígitos (C-179) |

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| MINOR | 1.11.0 | Funcionalidade nova compatível: US-171/US-172 e RF-171 a RF-180 (indicador de mãos levantadas na barra de marcação). O contrato IPC do desktop recebe só adição compatível; HTTP e WebSocket não mudam. |

## 9. Resultado

- [ ] OPEN — há gaps registrados acima com encaminhamento definido.
- [x] CONVERGED — código, testes automatizados e smoke manual A15b convergem com spec/plan/tasks; o limite da
  validação no Linux está registrado na §5.
