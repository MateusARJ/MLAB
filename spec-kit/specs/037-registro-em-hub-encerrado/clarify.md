# Clarify: Conexão Recusada em Sala Encerrada pelo Hub

Feature: `037-registro-em-hub-encerrado`
Status: CLOSED

Decisões aprovadas pelo responsável em 2026-11-15, na análise da issue #107.

## C-3701 — Como recusar a conexão

- **Opções:** (A) `410` no handshake e, depois do upgrade, `room-closed` com fechamento sem código; (B) código de
  fechamento novo `4004 Room Closed`.
- **Resposta aprovada:** **A**. `room-closed` e `410` já existem no código e nos clientes; o `4004` seria adição de
  contrato (MINOR) sem ganho para o web, que já encerra a sessão com `room-closed`.
- **Impacto em spec:** RF-3701, RF-3704, RNF-3702.

## C-3702 — Relação com a 036

- **Contexto:** a US-3601 da 036 diz que, depois do encerramento, `getOrCreateHub` entrega um hub novo em `waiting`.
- **Resposta aprovada:** esta feature substitui a US-3601: hub encerrado é marcador permanente, porque IDs de sala não
  se repetem. O teste `TestHandler_GetOrCreateHubConcorrenteAoEncerramento` é ajustado na T3703. A leitura sincronizada
  do status (RF-3601) continua valendo.
- **Impacto em spec:** RF-3702.

## C-3703 — Desktop

- **Resposta aprovada:** fora do escopo. Com a recusa no backend, o professor recebe `410` ou o fechamento da conexão,
  que o desktop já trata como `closed`. Tratar `session-state`/`room-closed` no desktop exige spec própria.
- **Impacto em spec:** seção 3.

## C-3704 — Entrega, faixa de IDs e versão

- **Entrega:** uma feature e um PR, com commits atômicos por tarefa.
- **Faixa de IDs:** `US-370x`, `RF-370x`, `RNF-370x`, `C-370x` e `T370x`.
- **Impacto de versão:** **PATCH**. Correção de comportamento, sem capacidade nova nem mudança de contrato
  (`docs/versionamento.md` §2).

## Resultado

CLOSED — C-3701 a C-3704 respondidas; nenhuma ambiguidade em aberto.
