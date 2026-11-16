# Checklist de Requisitos: Limite do RNF-121 Medido Só na Sondagem

Feature: `030-teste-mdns-sondagem`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-3001, RF-3002, RNF-3001) tem task.
- [x] Ambiguidades fechadas (C-3001 a C-3003), incluindo as três correções sugeridas na issue #87.
- [x] Causa registrada com evidência: o teste mede `ClaimMDNSName` inteiro e o RNF-121 limita só a sondagem; falha de
  2,21 s registrada na issue #87, com passagem 3 de 3 ao repetir isolado.

## Coerência

- [x] O RNF-121 da 012 não muda; o teste passa a medir o intervalo que ele define.
- [x] Nenhum contrato muda.
- [x] Sem dependência nova e sem ADR.

## Viabilidade

- [x] Os testes estão em `package room` e alcançam `newMDNSProber`.
- [x] Nenhum teste do pacote usa `t.Parallel()`, então trocar `newMDNSProber` no teste não afeta outro teste.
- [x] Verificação possível na máquina da issue (Windows 11, Wi-Fi real).

## Resultado

APPROVED
