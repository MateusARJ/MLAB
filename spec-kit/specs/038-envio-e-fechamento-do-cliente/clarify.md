# Clarify: Envio e Fechamento do Cliente sem Corrida

Feature: `038-envio-e-fechamento-do-cliente`
Status: CLOSED

Decisões registradas em 2026-11-15 na correção da issue #111, pedida pelo responsável. Nenhuma altera comportamento
visível, contrato ou arquitetura.

## C-3801 — Onde corrigir

- **Opções:**
  - (A) mover o envio de `ice-servers` para antes do `hub.register` no `serveWS`;
  - (B) serializar envio e fechamento dentro do `Client`, com um lock e uma flag de fechado.
- **Resposta:** **B**. A opção A só cobre o handler. O `readPump` (`INVALID_MESSAGE`) continua concorrendo com o
  fechamento, e a ordem das mensagens do registro mudaria. A opção B cobre todos os remetentes num ponto só e mantém a
  ordem atual.
- **Impacto em spec:** RF-3801, seção 3.

## C-3802 — Entrega, faixa de IDs e versão

- **Entrega:** uma feature e um PR, com commits atômicos por tarefa.
- **Faixa de IDs:** `US-380x`, `RF-380x`, `RNF-380x`, `C-380x` e `T380x`.
- **Impacto de versão:** **PATCH**. Correção de concorrência, sem capacidade nova nem mudança de contrato
  (`docs/versionamento.md` §2).

## Resultado

CLOSED: C-3801 e C-3802 respondidas, sem ambiguidade em aberto.
