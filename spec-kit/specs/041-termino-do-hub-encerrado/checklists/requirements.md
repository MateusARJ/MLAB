# Checklist de Requisitos: Término da Goroutine do Hub Encerrado

Feature: `041-termino-do-hub-encerrado`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-4101 a RF-4104, RNF-4101 a RNF-4103) tem task.
- [x] Ambiguidades fechadas (C-4101 a C-4103): término sem bloqueio, marcador, encerramento repetido e versão.
- [x] Evidência registrada: `signaling/hub.go` (`run`, `onRoomClose`, `onPublisherTimeout`, `Broadcast*`, timer),
  `signaling/client.go` (`readPump`), `signaling/handler.go` (`serveWS`, `getOrCreateHub`), medição de 20 goroutines a
  mais para 20 salas (issue #109).
- [x] Edge cases cobertos: REST close repetido, timer depois do término, registro tardio.

## Coerência

- [x] A 037 (RF-3701 a RF-3704) não muda: handshake de sala encerrada continua `410`; cliente tardio recebe
  `room-closed`.
- [x] A 039 (RF-3901) não muda: a leitura continua começando depois do registro.
- [x] Nenhum contrato muda; versão PATCH coerente com `docs/versionamento.md` §2.
- [x] IDs da faixa `410x` não colidem (busca por `RF-41`, `C-41`, `T41` sem resultado).

## Viabilidade

- [x] Todos os envios aos canais do hub estão em `hub.go`, `client.go` e `handler.go`.
- [x] Os encerramentos passam pela goroutine `run()`; testes que chamam `onRoomClose()` direto não acionam o término.

## Resultado

APPROVED
