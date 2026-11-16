# Analyze: Encerramento da Sala pelo Hub Reflete no Store

Feature: `033-encerramento-sala-pelo-hub`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma entre os artefatos da feature.

- Spec, clarify (C-3301 a C-3305) e plan concordam: o listener do hub encerra a sala no store como a REST `close`;
  `join` responde `404`; o mDNS só para quando o listener encerra a sala; o contrato do `/info` segue o código; PATCH.
- RN-13/RF-18 da 001 já determinam o encerramento após 30 s: nada upstream muda além do contrato do `/info`.
- O `409` da RN-08 (029) continua coberto por `TestJoinSalaEncerrada` e não é afetado.
- Observado, fora do escopo (non-goal): o store nunca grava `publishing`/`reconnecting`; a leitura de `hub.status` em
  `getOrCreateHub` acontece fora da goroutine do hub. A implementação verifica e registra como desvio se confirmado.

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-3301 | T3302, T3303 |
| RF-3302 | T3302, T3303 |
| RF-3303 | T3301 |
| RNF-3301 | T3302 |
| RNF-3302 | T3302 |
| RNF-3303 | todas: nenhuma dependência nova |

## 3. Contratos

- `001/contracts/room-api.md`, `GET /rooms/{roomId}/info`: documental (T3301). Nenhum consumidor lê `status`.
- Nenhum contrato WebSocket muda: `room-closed` continua sendo enviado pelo hub.

## 4. Tarefas fora do Scope Lock

Nenhuma. T3302 toca `room/handler.go`, `room_test.go` e `main.go`; T3303 só `smoke_test.go`; T3301 e T3304 só
documentos; T3305 só `package.json` via `npm run bump`.

## 5. Riscos

- Aviso atrasado do hub após REST `close` parar o mDNS de sala nova: mitigado por RNF-3301 e coberto em teste.

## 6. Resultado

- [ ] FAIL
- [x] PASS: próxima execução, T3301.
