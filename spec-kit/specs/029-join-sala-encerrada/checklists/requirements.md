# Checklist de Requisitos: Join em Sala Encerrada Responde 409

Feature: `029-join-sala-encerrada`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-2901 a RF-2903, RNF-2901, RNF-2902) tem task.
- [x] Ambiguidades fechadas (C-2901 a C-2903): direção, mensagem, ordem, desvios adjacentes, versão.
- [x] Evidência registrada: `room/handler.go`, RN-08, `room-api.md`, `RN008`, commit `15a8171`, consumidores web e
  E2E, na `development` @ `7bb2499` (issue #86).
- [x] Edge cases cobertos: sala removida pela REST `close`, dois `409` distintos no `join`.

## Coerência

- [x] RN-08, `room-api.md` e o espelho `RN008` já dizem `409`; nenhum artefato upstream muda (AGENTS §11).
- [x] A ordem das verificações do `join` não muda (027/RF-2702 continua valendo).
- [x] Sem dependência nova; versão PATCH coerente com `docs/versionamento.md` §2.
- [x] IDs da faixa `290x` não colidem (busca por `RF-290`, `C-290`, `T290` sem resultado; `RF-29` da 001 é outro ID).

## Viabilidade

- [x] `room_test.go` já monta o handler com store em memória e `httptest` (`TestJoinMatriculaConectada`).
- [x] `store.CreateRoom` aceita sala `closed` (usado em `TestGetActiveRoom_NoneActive`).

## Resultado

APPROVED
