# Clarify: Aviso de Mão Levantada Clicável e Sincronizado com a Fila

Feature: `031-aviso-mao-levantada`
Status: CLOSED

Decisões aprovadas pelo responsável em 2026-11-14, na análise da issue #90.

## C-3101 — Mão do aviso abaixada com outras mãos na fila

- **Contexto:** o aviso mostra a última mão levantada. Quando ela é abaixada, pode haver outras mãos na fila.
- **Opções:** (A) o aviso some; (B) o aviso passa a mostrar a próxima mão da fila.
- **Resposta aprovada:** **A**. É o menor comportamento, não inventa regra de "próxima mão" e a fila completa continua
  na aba de alunos.
- **Impacto em spec:** RF-3106.

## C-3102 — Abrir o painel dispensa o aviso?

- **Opções:** (A) não: o aviso só fica oculto enquanto o painel está aberto (como hoje); (B) sim.
- **Resposta aprovada:** **A**. Com RF-3103 a RF-3105, o aviso que volta ao fechar o painel corresponde a uma mão ainda
  levantada.
- **Impacto em spec:** escopo "Não incluído".

## C-3103 — Camada do aviso

- **Contexto:** canvas de marcação `zIndex: 15`; barra de marcação `25`; popover de cores `30`.
- **Opções:** (A) `zIndex: 20` no aviso; (B) escala de camadas nova para toda a prévia; (C) `pointerEvents: 'none'`
  no canvas com a ferramenta Cursor.
- **Resposta aprovada:** **A**. Resolve o empilhamento com uma linha, mantém barra e popover por cima. (B) é
  refatoração maior que o bug; (C) quebra a lupa/foco, tratada pelo canvas com a ferramenta Cursor.
- **Impacto em spec:** RF-3101.

## C-3104 — Testes, faixa de IDs e versão

- **Testes:** o desktop não tem Playwright e adicioná-lo seria dependência nova; o empilhamento é verificado por teste
  de componente comparando o `zIndex` inline do aviso com o do canvas e o da barra, e a limpeza por função pura com
  testes unitários. O clique real é verificado manualmente no app.
- **Faixa de IDs:** `US-310x`, `RF-310x`, `RNF-310x`, `C-310x` e `T310x` (com quatro dígitos; não colidem com o
  `RF-310`/`T310` da 003).
- **Impacto de versão:** **PATCH**: correção sem mudança de capacidade nem de contrato (`docs/versionamento.md` §2).

## Resultado

CLOSED — C-3101 a C-3104 respondidas; nenhuma ambiguidade em aberto.
