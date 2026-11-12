# Checklist de Requisitos: Remoção da Claim `email` do JWT do Professor

Feature: `015-remove-claim-email`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-151, RF-152, RNF-151) tem task.
- [x] Ambiguidades fechadas (C-151 a C-155), incluindo os dois fallbacks e o risco das chamadas de 2 argumentos.
- [x] Todos os pontos de emissão e leitura levantados com `git grep` na `development` @ `6795abb`.

## Coerência

- [x] ADR 0009 aprovada; item 5 da ADR 0006 anotado como substituído; AGENTS.md §9 atualizado.
- [x] Contrato `001/contracts/auth.md` emendado no mesmo commit da spec, antes do código.
- [x] RN-01, RN-06 e RF-12 sem mudança de regra; espelhos em `docs/requirements/` não citam as claims.
- [x] Versão PATCH, coerente com `docs/versionamento.md` §2.

## Viabilidade

- [x] Os testes de `signaling` estão em `package signaling` e alcançam `extractName`.
- [x] Nenhum consumidor fora do backend lê `email`.

## Resultado

APPROVED
