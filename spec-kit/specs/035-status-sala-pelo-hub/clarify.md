# Clarify: Status da Sala Acompanha a Sessão do Hub

Feature: `035-status-sala-pelo-hub`
Status: CLOSED

Decisões aprovadas pelo responsável em 2026-11-15, na análise da issue #101.

## C-3501 — O hub propaga o status ou o campo vira informativo?

- **Opções:** (A) o hub registra `publishing`/`reconnecting` no store, como a 033 faz com `closed`; (B) o contrato
  declara o status REST sempre `waiting` até o encerramento.
- **Resposta aprovada:** **A**. O contrato do `/info`, a RF-18 e a RNF-SEC-05 já pressupõem o status real; a feature
  faz o código cumpri-los.
- **Impacto em spec:** RF-3501, RF-3502.

## C-3502 — Prioridade da sala em `reconnecting` no `/rooms/active`

- **Opções:** (A) `publishing > reconnecting > waiting`; (B) `reconnecting` igual a `publishing`; (C) `reconnecting`
  igual a `waiting`.
- **Resposta aprovada:** **A**. A sala que estava no ar e só caiu fica à frente de uma sala apenas criada; desempate
  pela mais recente, como hoje. Estende a RNF-SEC-05 (`publishing > waiting`) sem contradizê-la.
- **Impacto em spec:** RF-3503.

## C-3503 — Semântica de `publishing`

- **Contexto:** o hub entra em `publishing` quando o professor conecta o WebSocket, antes de a trilha de vídeo chegar.
- **Resposta aprovada:** o store espelha o hub como ele é. Mudar o momento da transição é non-goal: afetaria o
  `session-state` do WebSocket, que web e desktop consomem.
- **Impacto em spec:** RF-3501, seção 3.

## C-3504 — Entrega, faixa de IDs e versão

- **Entrega:** uma feature e um PR, com commits atômicos por tarefa.
- **Faixa de IDs:** `US-350x`, `RF-350x`, `RNF-350x`, `C-350x` e `T350x`.
- **Impacto de versão:** **PATCH**. O código passa a cumprir requisitos e contrato já existentes (RF-18, RNF-SEC-05,
  `/info`); o valor `reconnecting` no `join` e no tipo alinha ao enum que o contrato do `/info` já declara, sem
  capacidade nova (`docs/versionamento.md` §2).

## Resultado

CLOSED — C-3501 a C-3504 respondidas; nenhuma ambiguidade em aberto.
