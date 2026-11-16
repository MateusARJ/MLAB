# Checklist de Requisitos: Adulteração Determinística do JWT no Teste de Segurança

Feature: `040-adulteracao-deterministica-do-jwt`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-4001, RF-4002, RNF-4001, RNF-4002) tem task.
- [x] Ambiguidades fechadas (C-4001 e C-4002): como adulterar e versão.
- [x] Evidência registrada: `auth_security_test.go` (troca do caractere `len-5`), run 43735279050 do PR #26 (issue #116).
- [x] Edge case coberto: ordem das claims no JSON recodificado.

## Coerência

- [x] ADR 0004 §2.2.1 continua coberta, agora com a elevação de claim de fato.
- [x] Nenhum contrato muda; sem incremento coerente com `docs/versionamento.md` §2.
- [x] IDs da faixa `400x` não colidem (busca por `RF-40`, `C-40`, `T40` sem resultado).

## Viabilidade

- [x] `StudentMapClaims` gera `role = aluno`; `RoleProfessor` existe em `model.go`.

## Resultado

APPROVED
