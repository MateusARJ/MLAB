# Clarify: Formato Exato da Matrícula do Aluno

Feature: `046-formato-matricula`
Status: CLOSED

Decisões registradas em 2026-11-16 pelo responsável, que aprovou o plano.

## C-4601 — Estrutura da matrícula

- **Opções:** (A) exatamente 7 dígitos + 4 letras + 4 dígitos; (B) 11 dígitos e 4 letras em qualquer posição.
- **Resposta aprovada:** **A**, `^[0-9]{7}[A-Za-z]{4}[0-9]{4}$` (ano e período, sigla do curso, sequencial).
  Substitui a resposta da 003/C-303.
- **Impacto em spec:** RF-4601; nota de emenda na RN-306 da 003.

## C-4602 — Letras minúsculas

- **Opções:** (A) aceitar e normalizar para maiúsculas; (B) aceitar como digitado; (C) só maiúsculas.
- **Resposta aprovada:** **A**. Exibição e token sempre em maiúsculas; a sessão única já ignora a caixa.
- **Impacto em spec:** RF-4602; contratos `room-api.md` e `auth.md`.

## C-4603 — Entrega, faixa de IDs e versão

- **Entrega:** uma feature e um PR para a `development`, branch `feat/formato-matricula`.
- **Faixa de IDs:** `US-460x`, `RF-460x`, `RNF-460x`, `C-460x` e `T460x`.
- **Impacto de versão:** **PATCH** (2.1.2 → 2.1.3). Correção da regra de validação; backend e web saem juntos no mesmo
  instalador e o contrato não ganha nem perde campo (`docs/versionamento.md` §2).

## Resultado

CLOSED: C-4601 a C-4603 respondidas, sem ambiguidade em aberto.
