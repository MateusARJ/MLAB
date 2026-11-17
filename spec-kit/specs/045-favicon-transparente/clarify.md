# Clarify: Favicon do Aluno Igual ao Ícone do Header do Desktop

Feature: `045-favicon-transparente`
Status: CLOSED

Decisões registradas em 2026-11-16 na correção da issue #131, pedida pelo responsável, que aprovou o plano.

## C-4501 — Fundo do apple-touch-icon

- **Opções:** (A) branco `#FFFFFF`; (B) manter `#0f172a`; (C) `#14171C`, o `theme-color` do `index.html`.
- **Resposta aprovada:** **A**. O iOS não aceita alfa no apple-touch-icon; o contorno escuro do mark contrasta com o
  branco, e o ícone fica igual ao header do desktop no tema claro.
- **Impacto em spec:** RF-4502.

## C-4502 — Premissa do 028/C-2806

- **Fato:** o 028/C-2806 pôs a logo sobre o quadrado escuro porque "a logo é branca". O `mlab-logo-mark.png` tem
  preenchimento branco e azul e contorno azul-marinho; sem fundo, fica legível em aba clara e escura.
- **Resposta:** o favicon fica sem fundo (pedido da issue #131). O RF-2814 da 028 e o RF-2502 da 025 deixam de valer
  para o favicon; ambas as specs recebem nota de emenda.
- **Impacto em spec:** RF-4501; notas na 025 e na 028.

## C-4503 — Entrega, faixa de IDs e versão

- **Entrega:** uma feature e um PR para a `development`, branch `feat/favicon-transparente`.
- **Faixa de IDs:** `US-450x`, `RF-450x`, `RNF-450x`, `C-450x` e `T450x`.
- **Impacto de versão:** **PATCH** (2.1.1 → 2.1.2). Troca de asset visual, sem capacidade nova nem contrato
  (`docs/versionamento.md` §2), como a issue #131 pede.

## Resultado

CLOSED: C-4501 a C-4503 respondidas, sem ambiguidade em aberto.
