# Checklist de Requisitos: Interação em Sala de Aula

Feature: `003-classroom-interaction`
Status: APPROVED

## Completude

- [x] Objetivo explícito (registrar funcionalidades entregues sem spec).
- [x] Atores definidos (professor no desktop, aluno no navegador).
- [x] User stories US-11 a US-22 com critérios de aceitação verificáveis.
- [x] Erros e estados registrados (spec §8).
- [x] Ambiguidades fechadas (C-301 a C-306).

## Coerência com a 001 e com as ADRs

- [x] RN-18 da 001 movida para RN-304 sem contradição.
- [x] "Upload de arquivos" removido do "Não incluído" da 001 e coberto por US-16.
- [x] Nada é persistido (ADR 0005).
- [x] Nenhuma interação depende de login (ADR 0006).

## Contratos

- [x] `contracts/signaling-classroom.md` — READY.
- [x] `contracts/files.md` — READY (mudanças futuras da 002/S4 marcadas com vigência).
- [x] `contracts/desktop-ipc.md` — READY (canais futuros da 002 marcados com vigência).

## Segurança

- [x] Autorização no servidor para mão, fixação e upload.
- [x] Chat privado nunca chega a outro aluno.
- [x] Lacunas de segurança de arquivos encaminhadas à `002-security-hardening`/S4.

## Testes

- [x] Cada RF aponta evidência de teste ou validação manual.
- [x] Lacunas de teste viraram tasks (T313, T314).

## Resultado

APPROVED
