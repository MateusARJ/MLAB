# Clarify: Join em Sala Encerrada Responde 409

Feature: `029-join-sala-encerrada`
Status: CLOSED

Decisões aprovadas pelo responsável em 2026-11-14, na análise da issue #86.

## C-2901 — Quem está certo: contrato (`409`) ou código (`404`)

- **Contexto:** a RN-08, o contrato `room-api.md` e o espelho `RN008` dizem `409`; o código responde `404` desde o
  commit `15a8171`, que mudou o status sem alterar a spec. O web não depende do status.
- **Opções:** (A) o código volta ao `409`; (B) spec, contrato e espelho passam a dizer `404`.
- **Resposta aprovada:** **A**. Pela hierarquia do AGENTS.md §1, a spec vale sobre o código; o `404` foi deriva.
- **Impacto em spec:** RF-2901.

## C-2902 — Mensagem e ordem das verificações

- **Resposta aprovada:** a mensagem atual ("esta transmissão já foi encerrada e o link não está mais disponível") é
  mantida, pois o web a exibe e o E2E procura "encerrada". A verificação de sala encerrada continua antes do `409` de
  matrícula conectada e do `429`. Sala inexistente ou removida segue com `404`.
- **Impacto em spec:** RF-2901, RF-2902, RF-2903.

## C-2903 — Desvios adjacentes, faixa de IDs e versão

- **Desvios adjacentes:** o encerramento só pelo hub que não marca a sala no store e o `404` do `/info` para sala
  encerrada viram issues separadas (AGENTS.md §14), fora desta feature.
- **Faixa de IDs:** `US-290x`, `RF-290x`, `RNF-290x`, `C-290x` e `T290x`. O número 028 está reservado pela
  `028-design-system-2`, ainda fora da `development`.
- **Impacto de versão:** **PATCH**: correção que alinha o código ao contrato, sem mudança de capacidade nem de
  contrato (`docs/versionamento.md` §2).

## Resultado

CLOSED — C-2901 a C-2903 respondidas; nenhuma ambiguidade em aberto.
