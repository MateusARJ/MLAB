# Analyze: Status da Sala Acompanha a Sessão do Hub

Feature: `035-status-sala-pelo-hub`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma entre os artefatos da feature.

- Spec, clarify (C-3501 a C-3504) e plan concordam: o hub avisa `publishing`/`reconnecting`, o store registra com
  guarda contra sala encerrada, `/rooms/active` ordena `publishing > reconnecting > waiting`, PATCH.
- RF-18 (001) e RNF-SEC-05 (002) não mudam: a feature faz o código cumpri-las; a ordem do `reconnecting` estende a
  RNF-SEC-05 sem contradizê-la.
- O `closed` continua no caminho da 033 (`CloseRoomFromSession`); `TestCloseRoomFromSession` segue válido.
- O contrato do `/info` já declara `reconnecting`; só o `join` e o `/rooms/active` mudam (T3501).

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-3501 | T3502, T3503, T3504 |
| RF-3502 | T3501, T3503 |
| RF-3503 | T3501, T3502 |
| RF-3504 | T3501, T3505 |
| RNF-3501 | T3502, T3503 |
| RNF-3502 | T3504 |
| RNF-3503 | todas: nenhuma dependência nova |

## 3. Contratos

- `001/contracts/room-api.md`: enum do `room_status` do `join` e ordem do `/rooms/active` (T3501). Nenhum consumidor
  web/desktop lê esses campos.
- `packages/types`: `RoomStatus` ganha `'reconnecting'` (T3505); valor novo num union, sem remoção.
- Nenhum contrato WebSocket muda: o `session-state` continua igual.

## 4. Tarefas fora do Scope Lock

Nenhuma. T3502 toca só `model.go`, `store.go` e `room_test.go`; T3503 só `handler.go` e `room_test.go`; T3504 só
`hub.go`, `signaling/handler.go`, `hub_status_test.go` e `main.go`; T3505 só `packages/types/src/index.ts`; T3501 e
T3506 só documentos; T3507 só `package.json` via `npm run bump`.

## 5. Riscos

- Aviso tardio reabrindo sala encerrada: mitigado por RNF-3501 e coberto em teste (T3502, T3503).
- Deadlock/data race: mitigado por RNF-3502 e verificado com `go test -race` (T3504).

## 6. Resultado

- [ ] FAIL
- [x] PASS: próxima execução, T3501.
