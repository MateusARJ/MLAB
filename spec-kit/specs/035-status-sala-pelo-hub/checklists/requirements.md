# Checklist de Requisitos: Status da Sala Acompanha a Sessão do Hub

Feature: `035-status-sala-pelo-hub`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-3501 a RF-3504, RNF-3501 a RNF-3503) tem task.
- [x] Ambiguidades fechadas (C-3501 a C-3504): direção, prioridade do `reconnecting`, semântica de `publishing`,
  versão.
- [x] Evidência registrada: `signaling/hub.go`, `room/store.go`, `room/handler.go`, `room/model.go`, `room-api.md`,
  `packages/types`, consumidores web/desktop, na `development` @ `44c525f` (issue #101).
- [x] Edge cases cobertos: REST `close` com hub ativo, sala nova após `createRoom`, aviso repetido.

## Coerência

- [x] RF-18 da 001 e RNF-SEC-05 da 002 não mudam; a ordem `publishing > reconnecting > waiting` estende a RNF-SEC-05
  sem contradizê-la (AGENTS §11).
- [x] O `closed` continua pelo caminho da 033; nada da 033 muda.
- [x] Sem dependência nova; versão PATCH coerente com `docs/versionamento.md` §2.
- [x] IDs da faixa `350x` não colidem (busca por `RF-35`, `C-35`, `T35` sem resultado).

## Viabilidade

- [x] O hub já concentra as transições em quatro pontos da goroutine `run()`; um helper cobre todos.
- [x] O `signaling.Handler` já tem o padrão `SetRoomClosedListener`/`notifyRoomClosed` para copiar.
- [x] `room_test.go` monta handler e store em memória com `httptest`; os testes do hub chamam `onRegister`/
  `onUnregister` direto (`hub_session_test.go`).

## Resultado

APPROVED
