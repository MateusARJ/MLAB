# Checklist de Requisitos: Encerramento da Sala pelo Hub Reflete no Store

Feature: `033-encerramento-sala-pelo-hub`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-3301 a RF-3303, RNF-3301 a RNF-3303) tem task.
- [x] Ambiguidades fechadas (C-3301 a C-3305): timeout definitivo, status do `join`, direção do contrato, mDNS, versão.
- [x] Evidência registrada: `signaling/hub.go`, `cmd/server/main.go`, `room/handler.go`, `room-api.md`, consumidor web,
  na `development` @ `e380ddb` (issues #94 e #95).
- [x] Edge cases cobertos: REST `close` + `end-session`, sala nova logo após encerrar, sala `closed` ainda no store.

## Coerência

- [x] RN-13/RF-18 já definem o encerramento após 30 s; nenhum artefato da 001 muda além do contrato do `/info`
  (AGENTS §11).
- [x] O `409` da RN-08 (029) segue valendo para sala `closed` presente no store.
- [x] Sem dependência nova; versão PATCH coerente com `docs/versionamento.md` §2.
- [x] IDs da faixa `330x` não colidem (busca por `RF-330`, `C-330`, `T330` sem resultado).

## Viabilidade

- [x] O hub já chama `onClosed` nos dois caminhos (`onPublisherTimeout`, `onRoomClose`); basta trocar o listener.
- [x] `room_test.go` monta o handler com store em memória e `httptest` (`TestJoinSalaEncerrada`).
- [x] O smoke sobe o servidor real por `newServer`, que contém o wiring do listener; `e.join` devolve o status.

## Resultado

APPROVED
