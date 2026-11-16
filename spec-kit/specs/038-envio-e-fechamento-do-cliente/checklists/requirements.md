# Checklist de Requisitos: Envio e Fechamento do Cliente sem Corrida

Feature: `038-envio-e-fechamento-do-cliente`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-3801 a RF-3803, RNF-3801 a RNF-3803) tem task.
- [x] Ambiguidades fechadas (C-3801 e C-3802): onde corrigir e versão.
- [x] Evidência registrada: `signaling/client.go` (`safeSend`, `closeWithCode`, `readPump`), `signaling/handler.go:131`,
  `signaling/hub.go:278` e `:292`, run 43769408583 da CI Linux, na `development` @ `a0b9243` (issue #111).
- [x] Edge cases cobertos: `ice-servers` depois da recusa, `INVALID_MESSAGE` durante o fechamento, buffer cheio.

## Coerência

- [x] A 037 (RF-3701) não muda: o cliente recusado continua recebendo `room-closed` e o fechamento.
- [x] RN-04 e ADR 0010 não mudam: o close `4002` continua sendo enviado.
- [x] Nenhum contrato muda; versão PATCH coerente com `docs/versionamento.md` §2.
- [x] IDs da faixa `380x` não colidem (busca por `RF-38`, `C-38`, `T38` sem resultado).

## Viabilidade

- [x] Todos os envios passam por `safeSend` e todos os fechamentos por `closeWithCode`; o lock nos dois basta.
- [x] Nenhuma operação bloqueante sob o lock.

## Resultado

APPROVED
