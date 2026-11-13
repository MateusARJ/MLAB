# Clarify: Matrícula Conectada Recusa Nova Entrada

Feature: `027-matricula-unica-na-transmissao`
Status: CLOSED

Decisões aprovadas pelo responsável em 2026-11-13, junto com a ADR 0010 e a issue #85.

## C-2701 — Quem fica quando a matrícula se repete

- **Contexto:** a RN-04 original e a ADR 0004 §2.1.C deixavam a última entrada derrubar a anterior.
- **Opções:** (A) manter "a última vence"; (B) recusar a nova entrada enquanto a matrícula estiver conectada;
  (C) exigir segredo extra por aluno.
- **Resposta aprovada:** **B** (ADR 0010). O segundo aluno não pode roubar a matrícula de quem já está na transmissão.
- **Impacto em spec:** RF-2701, RF-2703, RN-2701.

## C-2702 — O que é "matrícula conectada"

- **Contexto:** o store guarda participantes mesmo depois de saírem; usar o store bloquearia para sempre quem caiu.
- **Resposta aprovada:** WebSocket ativo no hub da sala. Comparação sem diferenciar maiúsculas, após trim (mesma regra
  da C-501). A reconexão do mesmo `participant_id` continua valendo (`4001`).
- **Impacto em spec:** RF-2701, RF-2704, RF-2705.

## C-2703 — Resposta ao aluno recusado

- **Resposta aprovada:** `join` → `409` com `{"error": "Esta matrícula já está conectada nesta transmissão."}`. Na
  corrida que chega ao WebSocket → close `4002 Student ID In Use`, e o web mostra a mesma frase na tela de entrada.
  O `Join.tsx` já exibe o campo `error` da resposta, sem mudança de código.
- **Impacto em spec:** RF-2701, RF-2703, RF-2706.

## C-2704 — Ordem com a sala cheia

- **Resposta aprovada:** a recusa por matrícula conectada vem antes do `429`: com a matrícula conectada, a resposta é
  sempre `409`, o motivo real da recusa.
- **Impacto em spec:** RF-2702.

## C-2705 — Faixa de IDs, ADR e impacto de versão

- **Faixa de IDs:** `US-270x`, `RF-270x`, `RNF-270x`, `RN-270x`, `C-270x` e `T270x`.
- **ADR:** 0010, aprovada em 2026-11-13.
- **Impacto de versão:** **MINOR**, escolhido pelo responsável: adição compatível em contrato (`409` novo no `join`,
  close `4002`), sem remover campo, rota ou evento (`docs/versionamento.md` §2).

## Resultado

CLOSED — C-2701 a C-2705 respondidas; nenhuma ambiguidade em aberto.
