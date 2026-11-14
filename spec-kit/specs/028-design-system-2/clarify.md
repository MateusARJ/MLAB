# Clarify: Design System 2.0 com Tema Claro e Escuro

Feature: `028-design-system-2`
Status: CLOSED

Decisões aprovadas pelo responsável entre 2026-11-13 e 2026-11-14, na conversa do redesenho e na issue #92.

## C-2801 — Base visual

- **Opções:** (A) continuar no padrão Carbon; (B) design system próprio, minimalista.
- **Resposta aprovada:** **B**, com tema claro e escuro. As telas seguem o protótipo HTML aprovado, não o layout
  antigo; valem só as funcionalidades e decisões das specs.
- **Impacto em spec:** RF-2801 a RF-2813.

## C-2802 — O que não pode mudar

- **Resposta aprovada:** só interface. Padrões mantidos: 1080p 60 fps selecionado, sem gravação, microfone e som do
  PC mudos, gravação só em `.webm`. O "link amigável" passa a se chamar "Link direto" e mostra `mlab.local:8080`.
- **Impacto em spec:** RF-2809, RF-2810, RNF-2801.

## C-2803 — Rótulos

- **Opções:** (A) manter os rótulos antigos; (B) usar os novos e anotar a spec 001.
- **Resposta aprovada:** **B**. "Tela Cheia" → "Tela inteira"; "Janela Específica" → "Janelas escolhidas";
  "Começar transmissão"; "Entrar na aula"; "Link direto"; "Link pelo IP".
- **Impacto em spec:** RF-2809 a RF-2812; nota na US-09 da 001.

## C-2804 — Marca no cabeçalho

- **Resposta aprovada:** a logo do MLab sem o nome (imagem fornecida pelo responsável), no lugar do símbolo de seta.
- **Impacto em spec:** RF-2806.

## C-2805 — Amarelo, mão levantada e pausa

- **Resposta aprovada:** sem amarelo em todo o MLab, exceto na barra flutuante quando o aluno levanta a mão. O
  destaque da mão levantada é azul no tema escuro (como o botão de mão do menu de tela cheia do aluno) e cinza no
  claro (como os campos de link). O ícone de aula pausada do aluno gira, como na versão anterior.
- **Impacto em spec:** RF-2807, RF-2813.

## C-2806 — Favicon da web

- **Resposta aprovada:** o favicon passa a ser a logo do cabeçalho, nos mesmos tamanhos dos arquivos atuais; o
  favicon antigo é excluído.
- **Interpretação registrada:** a logo é branca, então vai sobre o quadrado escuro arredondado já usado pela 025
  (`#0f172a`), para ter contraste em aba clara. Os PNGs 32×32 e 180×180 continuam; o `favicon.svg` sai porque a logo
  é uma imagem raster.
- **Impacto em spec:** RF-2814; nota na 025 (RF-2501, RF-2503, RF-2504, RNF-2502).

## C-2807 — Issue #89

- **Opções:** (A) corrigir na 028; (B) PR separado.
- **Resposta aprovada:** **A**. O layout novo deixa a prévia mais baixa e o corte aparece em 1366×768; a 028 não
  pode lançar essa regressão.
- **Impacto em spec:** RF-2815. É a única mudança de lógica da feature.

## C-2808 — ADR

- **Resposta:** não se aplica. A troca do design system e da biblioteca de ícones não está na lista da seção 9 do
  `AGENTS.md` (não troca framework, contrato, autenticação nem infraestrutura). A decisão fica no `plan.md`.

## C-2809 — Faixa de IDs, versão e entrada na `development`

- **Faixa de IDs:** `US-280x`, `RF-28xx`, `RNF-280x`, `C-280x`, `T28xx`.
- **Impacto de versão:** **MAJOR → 2.0.0**, escolhido pelo responsável: o fluxo do professor muda de organização e
  de rótulos.
- **Entrada:** o PR fica em rascunho. Só entra na `development` depois que a versão atual (1.15.0) for para a `main`.

## Resultado

CLOSED — C-2801 a C-2809 respondidas; nenhuma ambiguidade em aberto.
