# Checklist de Requisitos: Conexão Recusada em Sala Encerrada pelo Hub

Feature: `037-registro-em-hub-encerrado`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-3701 a RF-3704, RNF-3701 a RNF-3703) tem task.
- [x] Ambiguidades fechadas (C-3701 a C-3704): forma da recusa, relação com a 036, desktop, versão.
- [x] Evidência registrada: `signaling/handler.go` (`serveWS`, `getOrCreateHub`), `signaling/hub.go` (`onRegister`,
  `onPublishRequest`), `room/store.go` (`newID`), `useWebRTCSubscriber.ts` e `useWebRTCPublisher.ts`, na
  `development` @ `f9dec97` (issue #107).
- [x] Edge cases cobertos: encerramento e registro simultâneos, REST `close` sem hub, upgrade que falha.

## Coerência

- [x] RN-13 e RF-18 da 001 não mudam; a feature faz o WebSocket cumpri-las.
- [x] A substituição da US-3601 da 036 está registrada (C-3702); RF-3601 segue válido.
- [x] Nenhum contrato muda de formato; versão PATCH coerente com `docs/versionamento.md` §2.
- [x] IDs da faixa `370x` não colidem (busca por `RF-37`, `C-37`, `T37` sem resultado).

## Viabilidade

- [x] O `run()` serializa encerramento e registro; uma guarda no `onRegister` basta para a janela A.
- [x] O handler já tem `roomStore` e `h.mu`; a consulta na criação fecha a janela B.
- [x] Ordem de locks verificada: o store não chama o handler; o join chama `HasConnectedStudent` fora do lock do store.

## Resultado

APPROVED
