# Checklist de Requisitos: Formato Exato da Matrícula do Aluno

Feature: `046-formato-matricula`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-4601 a RF-4603, RNF-4601, RNF-4602) tem task.
- [x] Ambiguidades fechadas (C-4601 a C-4603): estrutura, caixa, entrega e versão.
- [x] Evidência registrada: regex atual no `handler.go` e no `Join.tsx`, RN-306 e C-303 da 003.
- [x] Casos válidos e inválidos listados (spec §8).

## Coerência

- [x] A emenda à RN-306/C-303 da 003 está registrada (C-4601) e será anotada.
- [x] Contratos `room-api.md` e `auth.md` anotados na mesma feature; nenhum campo novo ou removido.
- [x] IDs da faixa `460x` não colidem (busca por `RF-46`, `C-46`, `T46` sem resultado).
- [x] Espelho `docs/requirements/` (RF011) atualizado na mesma feature.

## Viabilidade

- [x] Fixtures de backend, web e e2e já seguem o formato novo; nenhuma dependência nova.

## Resultado

APPROVED
