# Clarify: Controles do Aluno no Celular

Feature: `043-controles-aluno-celular`
Status: CLOSED

Decisões registradas em 2026-11-16 na correção da issue #98, pedida pelo responsável.

## C-4301 — Qual X manter no menu em tela cheia

- **Opções:** (A) manter o X do cabeçalho da sidebar e esconder o gatilho com o menu aberto; (B) manter o gatilho
  flutuante e remover o X do cabeçalho.
- **Resposta:** **B**, como sugerido na issue: abre e fecha no mesmo ponto (☰ → X), tem 44 px (o do cabeçalho tem 40),
  já indica o estado em azul e os testes existentes usam `fullscreen-menu-trigger`.
- **Impacto em spec:** RF-4305 a RF-4307.

## C-4302 — Como evitar a sobreposição sem perder a centralização

- **Opções:** (A) aumentar a reserva do `maxWidth`; (B) uma linha flexível com espaçador à esquerda da largura do
  grupo, que some em telas de até 600 px, e pílula que encolhe com reticências.
- **Resposta:** **B**. (A) continua dependendo de números fixos e corta a pílula cedo no desktop. Em (B) o espaçador
  centraliza a pílula quando há espaço; até 600 px ele some por CSS, pois um espaçador que só encolhe tira frações
  de pixel da pílula e corta o texto (visto em 360 px na verificação visual). O `gap` garante os 8 px.
- **Texto ativo em tela estreita:** rótulo curto "Abaixar mão" até 480 px (o rótulo longo
  não cabe sem espaçador abaixo disso), por CSS (`@media`) em `apps/web/src/index.css`,
  pois estilo inline não tem media query. O nome acessível já é "Abaixar mão".
- **Impacto em spec:** RF-4301 a RF-4304.

## C-4303 — Entrega, faixa de IDs e versão

- **Entrega:** uma feature e um PR para a `development`, branch `fix/controles-aluno-celular`.
- **Faixa de IDs:** `US-430x`, `RF-430x`, `RNF-430x`, `C-430x` e `T430x`.
- **Impacto de versão:** **PATCH**. Correção visual e de acessibilidade, sem capacidade nova nem contrato
  (`docs/versionamento.md` §2).

## Resultado

CLOSED: C-4301 a C-4303 respondidas, sem ambiguidade em aberto.
