# Checklist de Requisitos: Teste do Join Independente da Rede

Feature: `013-teste-ice-offline`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-131, RF-132, RNF-131) tem task.
- [x] Ambiguidades fechadas (C-131, C-132), incluindo as duas correções sugeridas na issue #35.
- [x] Causa registrada com evidência: `handler.go` só preenche `ice_servers` com `STUN_URL` ou internet; o teste não
  define `STUN_URL` e exige lista não vazia. Reproduzido em 2026-11-10 (`room_test.go:406`, "esperava IceServers
  configurados").

## Coerência

- [x] O ramo offline (`[]`) segue a ADR 0005; o teste passa a protegê-lo, sem mudar a regra.
- [x] Nenhum contrato muda (`001/contracts/room-api.md` intocado).
- [x] Sem dependência nova e sem ADR.

## Viabilidade

- [x] Os testes estão em `package room` e alcançam o cache de conectividade.
- [x] Nenhum teste do pacote usa `t.Parallel()`.
- [x] Verificação possível com e sem rede na mesma máquina.

## Resultado

APPROVED
