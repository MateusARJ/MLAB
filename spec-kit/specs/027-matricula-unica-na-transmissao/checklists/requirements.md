# Checklist de Requisitos: Matrícula Conectada Recusa Nova Entrada

Feature: `027-matricula-unica-na-transmissao`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-2701 a RF-2706, RNF-2701 a RNF-2704, RN-2701) tem task.
- [x] Ambiguidades fechadas (C-2701 a C-2705): regra, definição de "conectada", resposta, ordem com sala cheia, versão.
- [x] Evidência registrada: leitura de `room/handler.go`, `room/store.go`, `signaling/hub.go`, `useWebRTCSubscriber.ts`
  e `Room.tsx` na `development` @ `1355660` (issue #85).
- [x] Edge cases cobertos: WS zumbi, nova aba, quem entra primeiro, professor, salas diferentes.

## Coerência

- [x] A ADR 0010 está aprovada e a ADR 0004 §2.1.C aponta para ela.
- [x] A RN-04 da 001 e o espelho `RN004` mudam na T2701, antes do código (AGENTS §11).
- [x] Contratos: `409` novo no `join` e close `4002` são adições; nada é removido (RNF-2703).
- [x] O `4001` do mesmo participante continua igual (RF-2704); o web já o trata.
- [x] `Join.tsx` não muda: o `409` chega pelo `error` da resposta, já exibido.
- [x] Sem dependência nova; versão MINOR coerente com `docs/versionamento.md` §2.
- [x] IDs da faixa `270x` não colidem com outras features.

## Viabilidade

- [x] O hub já é testado chamando `onRegister`/`onUnregister` direto (`hub_session_test.go`).
- [x] O smoke `A19` sobe o servidor real e abre WebSockets (`smoke_helpers_test.go`).
- [x] Os mocks de WebSocket do hook aceitam `onclose` com código (teste do `4001`).

## Resultado

APPROVED
