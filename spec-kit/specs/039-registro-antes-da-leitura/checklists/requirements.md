# Checklist de Requisitos: Registro do Cliente antes da Leitura

Feature: `039-registro-antes-da-leitura`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-3901 a RF-3903, RNF-3901 a RNF-3903) tem task.
- [x] Ambiguidades fechadas (C-3901 e C-3902): onde corrigir e versão.
- [x] Evidência registrada: `signaling/client.go` (`newClient`), `signaling/handler.go` (`serveWS`),
  `signaling/hub.go` (`run`, `route`), run 43778784875 do PR #26 e medições do #114.
- [x] Edge cases cobertos: hub ocupado no registro, cliente recusado, ping antes da leitura.

## Coerência

- [x] A 037 (RF-3701) e a 038 (RF-3801) não mudam: o cliente recusado continua recebendo `room-closed` ou `4002` e o
  fechamento.
- [x] Nenhum contrato muda; versão PATCH coerente com `docs/versionamento.md` §2.
- [x] IDs da faixa `390x` não colidem (busca por `RF-39`, `C-39`, `T39` sem resultado).

## Viabilidade

- [x] `newClient` só é chamado pelo `serveWS`; os testes do hub montam o `Client` direto.
- [x] O listener de status roda na goroutine do hub e permite segurá-la no teste sem tocar no `hub.go`.

## Resultado

APPROVED
