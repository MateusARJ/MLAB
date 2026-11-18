# Clarify: Uma Única Conexão de Sinalização por Entrada do Aluno

Feature: `044-conexao-unica-do-aluno`
Status: CLOSED

Decisões registradas em 2026-11-16 na correção da issue #127, pedida pelo responsável, que aprovou o plano de
correção. Nenhuma altera comportamento do produto, contrato ou arquitetura.

## C-4401 — Onde corrigir a conexão duplicada

- **Opções:**
  - (A) adiar a abertura do WebSocket no `useWebRTCSubscriber` para depois da montagem, cancelando-a no cleanup;
  - (B) mudar o hub para ignorar a conexão mais antiga que registra por último;
  - (C) ignorar o `4001` no web em certas condições;
  - (D) remover o `StrictMode` do `main.tsx`.
- **Resposta:** **A**. O hub não sabe qual conexão o navegador criou primeiro e a 027/RF-2704 está correta (B); (C)
  quebraria a 005/C-502 real; (D) esconde o problema e não cobre remontagens reais.
- **Impacto em spec:** RF-4401, RF-4402.

## C-4402 — Entrega, faixa de IDs e versão

- **Entrega:** uma feature e um PR para a `development`, branch `fix/conexao-unica-do-aluno`.
- **Faixa de IDs:** `US-440x`, `RF-440x`, `RNF-440x`, `C-440x` e `T440x`.
- **Impacto de versão:** **PATCH** (2.1.0 → 2.1.1). Correção no web, sem mudança de capacidade nem de contrato
  (`docs/versionamento.md` §2).

## Resultado

CLOSED: C-4401 e C-4402 respondidas, sem ambiguidade em aberto.
