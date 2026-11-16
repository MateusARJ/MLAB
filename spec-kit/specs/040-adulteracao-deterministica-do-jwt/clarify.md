# Clarify: Adulteração Determinística do JWT no Teste de Segurança

Feature: `040-adulteracao-deterministica-do-jwt`
Status: CLOSED

Decisões registradas em 2026-11-15 na correção da issue #116, pedida pelo responsável. Nenhuma altera comportamento,
contrato ou arquitetura.

## C-4001 — Como adulterar o token

- **Opções:**
  - (A) trocar um caractere da assinatura por outro garantidamente diferente;
  - (B) trocar a claim `role` no payload e manter a assinatura original.
- **Resposta:** **B**. Cobre o que o teste declara (elevação de aluno a professor, ADR 0004 §2.2.1) e é determinística.
  A opção A só testaria uma assinatura corrompida, já coberta por `TestAuthSecurity_ForgedSecret`.
- **Impacto em spec:** RF-4001 e RF-4002.

## C-4002 — Entrega, faixa de IDs e versão

- **Entrega:** uma feature e um PR, com commits atômicos por tarefa.
- **Faixa de IDs:** `US-400x`, `RF-400x`, `RNF-400x`, `C-400x` e `T400x`.
- **Impacto de versão:** **sem incremento**. Só teste (`docs/versionamento.md` §2); nada do que é entregue muda.

## Resultado

CLOSED: C-4001 e C-4002 respondidas, sem ambiguidade em aberto.
