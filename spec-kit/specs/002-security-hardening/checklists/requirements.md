# Checklist de Requisitos: Endurecimento de Segurança

Feature: `002-security-hardening`
Status: APPROVED

## Completude

- [x] Cada falha da análise tem uma task (S1–S9 = T201–T209; S9 por emenda de 2026-11-01).
- [x] Critérios de aceite verificáveis por teste automatizado e por item da matriz de smoke.
- [x] Ambiguidades fechadas (C-201 a C-205).

## Coerência

- [x] ADR 0006 aprovada antes de alterar autenticação (AGENTS.md §9).
- [x] Contratos alvo já registrados com vigência: `001/contracts/auth.md`, `001/contracts/room-api.md`, `003/contracts/files.md`, `003/contracts/desktop-ipc.md`.
- [x] Nenhuma task altera UX ou remove funcionalidade além do login descontinuado.

## Segurança

- [x] Fail-closed em S2 sem quebrar o fluxo legítimo (geração automática da chave).
- [x] Nenhum segredo versionado ou registrado em log.
- [x] S9 preserva o uso legítimo de `request-keyframe` pelo web app (verificado em `useWebRTCSubscriber.ts` e `Room.tsx`).

## Resultado

APPROVED
