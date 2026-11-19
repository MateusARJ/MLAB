# Analyze: Reação do App à Queda do Backend

Feature: `053-reacao-queda-backend`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma entre os artefatos da feature.

- Spec, clarify (C-5301 a C-5304), plan e contrato concordam: detecção por saída e por `/health` (3 s × 3), até 3
  reinícios em 60 s, estados `down`/`restarting`/`up`/`failed`, retomada automática no renderer, MINOR.
- O `useWebRTCPublisher` e os services ficam proibidos: a retomada usa as funções existentes (`startProfessorSession`,
  `createRoom`, `getRoomLink`, `startPublishing`) sem alterá-las.

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-5301 a RF-5303 | T5301 |
| RF-5304 | T5302 |
| RF-5305 | T5303 |
| RF-5306, RF-5307 | T5304 (aviso), T5303 (estado) |
| RNF-5301, RNF-5302 | T5301 |
| RNF-5303 | T5302 |
| RNF-5304 | todas |
| RNF-5305 | T5301 (encerramento), T5304 (testes do `Room`) |

## 3. Contratos

- Novo `contracts/ipc-backend-status.md`, adição compatível. O contrato da 034 (`backend-embarcado.md`) não muda: o
  processo é iniciado com o mesmo ambiente.

## 4. Tarefas fora do Scope Lock

Nenhuma. Cada task lista só paths do Allowed Paths do plan.

## 5. Riscos

- Falso positivo do `/health`, reinício no fechamento, loop de quedas, closure antiga do `roomId` e mudança de slug:
  mitigados no plan §3.

## 6. Resultado

- [ ] FAIL
- [x] PASS: a próxima execução é a T5301.
