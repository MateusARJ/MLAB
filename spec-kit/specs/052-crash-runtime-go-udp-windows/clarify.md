# Clarify: Crash do Runtime Go na Leitura UDP do Windows

Feature: `052-crash-runtime-go-udp-windows`
Status: CLOSED

Decisões registradas em 2026-11-19 com o responsável, a partir da análise dos logs da máquina do professor.

## C-5201 — Versão do Go

- **Opções:** (A) a mínima com a correção (1.26.2); (B) a última de patch da 1.26 (1.26.11); (C) a 1.27.4.
- **Resposta:** **B**. Inclui a correção e as demais correções de patch, sem trocar de versão menor (sem mudança de
  linguagem nem de comportamento da biblioteca padrão). A 1.27 fica para uma atualização própria.
- **Impacto em spec:** RF-5201.

## C-5202 — Escopo da correção

- **Opções:** (A) só a versão do Go; (B) versão do Go e crash no log do backend; (C) incluir também a reação do app
  à queda.
- **Resposta:** o responsável escolheu os três itens, em duas entregas. Esta feature cobre **B**. A reação do app é
  comportamento novo (MINOR) e vai para a feature `053`, com branch e PR próprios.
- **Impacto em spec:** RF-5202, RF-5203; §3 "Não incluído".

## C-5203 — Entrega, faixa de IDs e versão

- **Entrega:** uma feature e um PR, branch `fix/crash-runtime-go-udp-windows`. **Por decisão do responsável, a
  branch sai da `main` e o PR vai para a `main`.** A `development` não existe mais no remoto, então esta é uma
  exceção registrada ao AGENTS.md §15.
- **Faixa de IDs:** `US-520x`, `RF-520x`, `RNF-520x`, `C-520x` e `T520x` (busca por `RF-52`, `C-52`, `T52` sem
  resultado).
- **Impacto de versão:** **PATCH**. Correção de estabilidade e diagnóstico, sem capacidade nova nem contrato
  (`docs/versionamento.md` §2). 2.2.1 → 2.2.2.

## Resultado

CLOSED: C-5201 a C-5203 respondidas, sem ambiguidade em aberto.
