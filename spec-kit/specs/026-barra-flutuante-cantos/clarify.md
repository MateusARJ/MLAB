# Clarify: Barra Flutuante de Marcação nos Cantos da Tela

Feature: `026-barra-flutuante-cantos`
Status: CLOSED

Decisões aprovadas pelo responsável em 2026-11-12, junto com o plano de correção da issue #78.

## C-2601 — Onde a barra reabre

- **Contexto:** a issue pede posições independentes e, ao mesmo tempo, a barra aberta "ancorada no canto da
  bolinha". Se a barra aberta foi arrastada para B e minimizada, a bolinha volta para A; ao clicar de novo, a barra
  pode abrir em B ou ancorada em A.
- **Opções:** (A) volta para B se a bolinha não foi arrastada desde então; senão, ancorada à bolinha; (B) sempre
  ancorada à bolinha; (C) sempre em B.
- **Resposta aprovada:** **A**.
- **Impacto em spec:** RF-2602, RF-2603, RF-2606.

## C-2602 — Contrato

- **Resposta aprovada:** o cálculo fica só no renderer do overlay. `AnnotationSessionState.toolbarPos` continua
  sendo a posição visível atual; a posição da bolinha e a da barra aberta ficam em `sessionStorage` do overlay. O
  main e a `Room.tsx` não usam a posição para nada além de repassá-la, então não precisam mudar.
- **Impacto em spec:** RNF-2601, §10.

## C-2603 — Orientação após o ajuste

- **Contexto:** a orientação é derivada do canto superior esquerdo. Ancorar a barra vertical pela base pode levar esse
  canto para a faixa do topo, e a barra viraria horizontal.
- **Resposta aprovada:** a orientação da barra aberta é fixada no momento da expansão (zona da bolinha ou zona salva)
  e só é recalculada quando o professor arrasta a barra aberta ou quando chega uma posição diferente pela
  sincronização.
- **Impacto em spec:** RF-2603, RF-2604, §9.

## C-2604 — Faixa de IDs, ADR e impacto de versão

- **Faixa de IDs:** `US-260x`, `RF-260x`, `RNF-260x`, `C-260x` e `T260x`.
- **ADR:** não é necessária. Correção de layout no renderer, sem arquitetura, contrato ou autorização.
- **Impacto de versão:** **PATCH**. Correção sem capacidade nova nem mudança de contrato (`docs/versionamento.md` §2,
  AGENTS §13).

## Resultado

CLOSED — C-2601 a C-2604 respondidas; nenhuma ambiguidade em aberto.
