# Converge: Barra Flutuante de Marcação nos Cantos da Tela

Feature: `026-barra-flutuante-cantos`
Mode: READ-ONLY sobre o código (só este arquivo e o `tasks.md` são escritos)
Data: 2026-11-12
Commits avaliados: `3861bdd` (T2601), `94fb338` (T2602)
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-2601 a C-2604), `plan.md`, `tasks.md` (T2601 a T2604)
- código: `apps/desktop/src/renderer/components/FloatingAnnotationOverlay.tsx`; teste:
  `apps/desktop/src/renderer/components/FloatingAnnotationOverlay.test.tsx`; nota em
  `spec-kit/specs/003-classroom-interaction/spec.md`
- suítes: `npm run test -w apps/desktop` e `npm run lint`
- verificação manual (T2603): aprovada pelo responsável no Windows ("validei manualmente").

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-2601 | `bubblePosRef`/`expandedLayoutRef` com `mlab.floatingToolbarBubblePos` e `mlab.floatingToolbarExpanded` em `sessionStorage`; teste "minimizar devolve a bolinha ao ponto…" |
| RF-2602 | `applyCollapsedTransition` reabre na posição e zona salvas; mesmo teste (reexpandir volta a B, vertical) |
| RF-2603 | `computeExpandedToolbarPos` + âncora refeita com o tamanho medido no `useLayoutEffect`; unitários nos quatro cantos e bordas (1920×1080, 1366×768) e "canto inferior direito… rente ao canto"; manual (T2603) |
| RF-2604 | `clampToolbarPos` com margem 6px; `expandedZone` fixada; testes "mão levantada aumenta a barra…" e "barra vertical na direita… continua vertical"; popover para dentro nos dois testes; manual (T2603) |
| RF-2605 | transição única no botão, clique na bolinha, `toggle-collapse`, tecla `h` e `onAnnotationStateSync`; teste "minimizar e expandir pela sincronização do MLab e pelo atalho…"; `Alt+H` manual (T2603) |
| RF-2606 | `finishDrag` grava só a posição do modo atual e invalida a barra aberta quando a bolinha se move; teste da US-2602 |
| RNF-2601 | `toolbarPos` enviado ao main é a posição visível (asserções de `syncAnnotationState`); nenhum arquivo de `packages/`, `src/main/` ou `pages/` alterado |
| RNF-2602 | retângulo novo no `setAnnotationToolbarRect` (teste do canto inferior direito); testes da 009 e da 017 verdes |
| RNF-2603 | nenhuma dependência nova |

Totais: desktop com 29 arquivos e 308 testes verdes (10 novos da 026); `npm run lint` verde (5 tarefas).

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta | Evidência |
|---|---|---|
| — | — | nenhum |

## 3. Divergências (código ≠ spec/plan/contrato)

| Item | Spec/contrato diz | Código faz | Encaminhamento |
|---|---|---|---|
| — | — | — | nenhuma |

- O plan §1 item 7 cita o `ResizeObserver`; o ajuste ficou no `useLayoutEffect` com `raisedHands`, `collapsed`,
  `toolbarPos` e viewport nas dependências, que cobre o crescimento da barra pelo indicador (RF-2604). Sem efeito no
  comportamento especificado.

## 4. Código sem requisito (implementado fora de spec/task)

| Comportamento | Onde | Encaminhamento |
|---|---|---|
| — | — | nenhum |

## 5. Testes faltantes

- Nenhum automatizado. O comportamento real no Electron (tamanho medido e janela de overlay) foi coberto pela
  verificação manual.

## 6. Novas tasks necessárias

- Nenhuma na 026.

## 7. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| — | — | — | nenhum desvio novo |

- O risco do plan §3 (`Alt+H` recebido pelo overlay e pela `Room.tsx`) não se confirmou: o main envia o atalho ao
  overlay antes de repassar a sincronização da `Room.tsx`, e a transição só age quando `collapsed` muda.

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| PATCH | 1.14.4 | Correção de layout da barra flutuante, sem capacidade nova nem mudança de contrato (C-2604). |

## 9. Resultado

- [ ] OPEN
- [x] CONVERGED — a barra flutuante abre inteira na tela a partir da bolinha em qualquer canto, e a bolinha volta ao
  ponto dela ao minimizar.
