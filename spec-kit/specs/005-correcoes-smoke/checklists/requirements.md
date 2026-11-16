# Checklist de Requisitos: Correções da Matriz de Smoke e Remoção de Legado

Feature: `005-correcoes-smoke`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-501 a RF-506, RNF-501) tem task.
- [x] Ambiguidades fechadas (C-501 a C-506).
- [x] Cada item de legado tem evidência de ausência de consumidor (plan §3).

## Coerência

- [x] Requisito novo de produto limitado a RF-506 (issue #20), aprovado pelo dono do produto em 2026-11-02 (C-506);
  os demais implementam RN-04 e §10b da 001.
- [x] Fluxo da matrícula fora do escopo (C-504).
- [x] Nenhuma dependência nova.

## Viabilidade

- [x] A19 e A20 têm teste automatizado existente (smoke e E2E) para validar a correção.
- [x] RF-506 tem validação por teste do hook e pelos E2E A14/A20 sem retry.

## Resultado

APPROVED
