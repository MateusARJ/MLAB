# Checklist de Requisitos: Matriz de Smoke de Regressão

Feature: `004-smoke-regression`
Status: APPROVED

## Completude

- [x] Os 21 itens da matriz (A0–A20) têm dono: smoke de backend, E2E, roteiro manual ou N/E justificado.
- [x] Cada requisito (RF-401 a RF-404, RNF-401 a RNF-403) tem task.
- [x] Ambiguidades fechadas (C-401 a C-407).

## Coerência

- [x] Nenhuma task altera comportamento do produto; a única mudança em produção (C-402) é extração sem efeito.
- [x] Dependência nova aprovada no clarify (C-401) e restrita a devDependency.
- [x] Falhas conhecidas (A19) e itens N/E (A17) registrados antes da execução.

## Viabilidade

- [x] Roteiro manual usa só os recursos disponíveis (celular, Linux/WSL).
- [x] `npm run make:win` não incrementa a versão (o `premake` só roda antes de `npm run make`).

## Resultado

APPROVED
