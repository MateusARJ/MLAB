# Clarify: E2E A19 com a Recusa da Matrícula Já Conectada

Feature: `042-e2e-a19-sessao-unica`
Status: CLOSED

Decisões registradas em 2026-11-16 na correção da issue #126, pedida pelo responsável. Nenhuma altera comportamento
do produto, contrato ou arquitetura.

## C-4201 — Sinal de que a aba 1 está registrada no hub

- **Opções:**
  - (A) esperar o vídeo tocar na aba 1 (`expectVideoPlaying`);
  - (B) esperar o `participant-joined` com a matrícula da aba 1 no WebSocket do professor (`prof.waitFor`).
- **Resposta:** **B**. É o evento que o hub envia depois de registrar o aluno, o mesmo estado que o `handleJoin`
  consulta para responder `409`. (A) depende de mídia e é mais lento sem ganho.
- **Impacto em spec:** RF-4201.

## C-4202 — Entrega, faixa de IDs e versão

- **Entrega:** uma feature e um PR para a `development`, branch `test/e2e-a19-sessao-unica`.
- **Faixa de IDs:** `US-420x`, `RF-420x`, `RNF-420x`, `C-420x` e `T420x`.
- **Impacto de versão:** **sem incremento**. Só teste e artefatos do Spec Kit (`docs/versionamento.md` §2).

## Resultado

CLOSED: C-4201 e C-4202 respondidas, sem ambiguidade em aberto.
