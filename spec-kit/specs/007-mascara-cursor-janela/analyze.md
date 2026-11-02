# Analyze: Ocultação do Cursor na Transmissão de Janela Específica

Feature: `007-mascara-cursor-janela`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

- O US-20 / RF-310 da 003 exige ocultar o cursor sobre o MLab na tela cheia; a 007 decide o contrário (C-702). A
  emenda é feita na própria 003 (T704), antes da convergência, seguindo a direção spec → tasks.
- A T310 da 003 está `[x]`, mas o comportamento regrediu no `29c54d0`. A T704 registra a nota; a T705 revalida pelo
  smoke A12.

Nenhuma outra contradição: a regra de visibilidade (RN-701) e o contrato `CursorState` não mudam.

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-701 | T701, T702, T707 |
| RF-702 | T701, T702 |
| RF-703 | T703, T707 |
| RF-704 | T702, T705 |
| RF-705 | T704 |
| RF-706 | T707 |
| RNF-701 | T705 |
| RNF-702 | T703 (testes de `createCursorMaskedTrack` mantidos) |
| RNF-703 | T703 |

## 3. Contratos

Nenhum contrato alterado. As mensagens `mask-suspended`/`mask-resumed` são internas entre o worker e
`createCursorMaskedTrack.ts`, no mesmo módulo `renderer/media`, e não cruzam processos nem serviços.

## 4. Tarefas fora do Scope Lock

Nenhuma. T701–T703 alteram só `apps/desktop/src/renderer/media/**` listados; T704 só a spec/tasks da 003 e o
runbook; T705–T706 só documentação. `useScreenCapture.ts`, o processo principal e `packages/**` estão proibidos.

## 5. Riscos

- Desempenho só verificável no app real: a T705 é manual e bloqueia a convergência.
- Canvas sem GPU: mitigado pela proteção de FPS (RF-703).
- Alternância de resolução: mitigada por RF-704 e verificada por `keyFramesDecoded`.

## 5a. Revalidação após C-703 (2026-11-02)

RF-701, RF-702 e RF-703 emendados e RF-706 criado a partir do teste do professor; a T707 cobre as mudanças dentro
dos mesmos Allowed Paths. A T702 continua válida como base; a T707 substitui a regra dos 350 ms e a invalidação da
placa no repasse. Nenhum contrato ou path novo.

## 6. Resultado

- [ ] FAIL
- [x] PASS — próxima execução: T707.
