# Clarify: Encerramento da Sala pelo Hub Reflete no Store

Feature: `033-encerramento-sala-pelo-hub`
Status: CLOSED

Decisões aprovadas pelo responsável em 2026-11-15, na análise das issues #94 e #95.

## C-3301 — O timeout de reconexão encerra a sala de vez?

- **Contexto:** a issue #94 pede decidir se o professor pode retomar a sala depois do timeout.
- **Resposta aprovada:** **sim, encerra de vez**. A RN-13 e a RF-18 da 001 já dizem "30 segundos antes do encerramento
  da sala". Não há decisão nova; a feature só faz o store refletir o que a spec já define.
- **Impacto em spec:** RF-3301.

## C-3302 — Status do `join` depois do encerramento pelo hub

- **Opções:** (A) `404 "sala não encontrada"`, removendo a sala do store como a REST `close`; (B) manter a sala
  `closed` no store para responder `409`.
- **Resposta aprovada:** **A**. Mesmo comportamento da REST `close` para o mesmo estado; a 029 já deixou "mudar o `404`
  de sala removida" como non-goal. O `409` da RN-08 segue valendo para sala `closed` ainda no store.
- **Impacto em spec:** RF-3302.

## C-3303 — Contrato do `/info`: quem muda?

- **Opções:** (A) o contrato segue o código (sem `closed` no `200`, com o `404` documentado); (B) o código passa a
  responder `200` com `status: closed`.
- **Resposta aprovada:** **A**. O único consumidor (web) não lê `status` e trata erro como `null`; com o RF-3301 a sala
  encerrada sai do store em todos os caminhos, então um `200 closed` nunca seria emitido.
- **Impacto em spec:** RF-3303.

## C-3304 — mDNS no encerramento pelo hub

- **Contexto:** o hub chama `onClosed` de forma assíncrona, inclusive depois de uma REST `close`. Parar o mDNS sempre
  poderia derrubar o anúncio de uma sala criada logo depois.
- **Resposta aprovada:** o listener só para o mDNS quando encontra a sala aberta no store e a encerra. Sala ausente ou
  já `closed`: só libera arquivos.
- **Impacto em spec:** RNF-3301, RNF-3302.

## C-3305 — Entrega, faixa de IDs e versão

- **Entrega:** uma feature e um PR para as duas issues, com commits atômicos por tarefa.
- **Faixa de IDs:** `US-330x`, `RF-330x`, `RNF-330x`, `C-330x` e `T330x`.
- **Impacto de versão:** **PATCH**: correção que alinha o código à spec, sem mudança de capacidade; a mudança de
  contrato é só documental (`docs/versionamento.md` §2).

## Resultado

CLOSED — C-3301 a C-3305 respondidas; nenhuma ambiguidade em aberto.
