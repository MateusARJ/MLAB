# Checklist de Requisitos: Lint de Tipos do App Desktop sem Erros

Feature: `020-lint-tipos-desktop`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-2001 a RF-2003, RNF-2001, RNF-2002) tem task.
- [x] Ambiguidades fechadas (C-2001 a C-2006), incluindo o selo de privacidade e o lint no CI.
- [x] Evidência registrada: os 14 erros reproduzidos na `development` @ `1514dc1`, com a causa de cada um.

## Coerência

- [x] Nenhum contrato muda; o canal `active-window-unauthorized` fica (C-2002).
- [x] Nenhuma spec exige o selo de privacidade na UI (busca em `spec-kit/specs` e `docs/requirements`).
- [x] Sem dependência nova e sem ADR.
- [x] Versão PATCH, coerente com `docs/versionamento.md` §2.
- [x] IDs da faixa `200x` não colidem com outras features.

## Viabilidade

- [x] `tsc` e `vitest` rodam localmente no desktop.
- [x] Demais `lint` do monorepo já passam, então o lint no CI depende só desta feature.

## Resultado

APPROVED
