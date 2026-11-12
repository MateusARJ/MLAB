# Clarify: Favicon Próprio do Web App dos Alunos

Feature: `025-favicon-web`
Status: CLOSED

Decisões aprovadas pelo responsável em 2026-11-12, junto com o plano de correção das issues #65 e #68.

## C-2501 — Desenho do ícone

- **Opções:** (A) SVG redesenhado e simplificado só com o símbolo; (B) recorte raster do símbolo da logo atual;
  (C) monograma "M".
- **Resposta aprovada:** **A**. Vetorial e nítido em 16/32px. Do símbolo ficam a tela com o cursor e as ondas de
  sinal; o painel de participantes e o texto saem, porque somem em tamanho pequeno.
- **Impacto em spec:** RF-2501, RF-2502.

## C-2502 — App desktop

- **Contexto:** a issue pede avaliar se o desktop usa o novo ícone.
- **Resposta aprovada:** fora do escopo. A janela e a barra de tarefas usam `apps/desktop/resources/icon*`, e o
  `<link rel="icon">` do renderer Electron não aparece para o usuário.
- **Impacto em spec:** §3 (Não incluído).

## C-2503 — Geração dos PNGs

- **Resposta aprovada:** os PNGs são gerados uma vez a partir do SVG, por um script descartável fora do repositório,
  com o Chromium do `@playwright/test` que já é dependência de desenvolvimento do `apps/web`. Nenhuma dependência nova
  e nenhum script versionado.
- **Impacto em spec:** RF-2503, RNF-2501.

## C-2504 — Faixa de IDs, ADR e impacto de versão

- **Faixa de IDs:** `US-250x`, `RF-250x`, `RNF-250x`, `C-250x` e `T250x`.
- **ADR:** não é necessária. Troca de asset visual, sem arquitetura, contrato ou autorização.
- **Impacto de versão:** **PATCH**. Ajuste visual sem capacidade nova nem mudança de contrato
  (`docs/versionamento.md` §2, AGENTS §13).

## Resultado

CLOSED — C-2501 a C-2504 respondidas; nenhuma ambiguidade em aberto.
