# Clarify: Aviso de Mão Levantada Responsivo

Feature: `006-banner-mao-levantada`
Status: CLOSED

Decisões tomadas com o dono do produto em 2026-11-02.

## C-601 — Onde e com que largura o aviso aparece

- **Contexto:** no celular, fora da tela cheia, o aviso fica compactado (evidência: captura em Pixel 7 e em 360 px de
  largura, 2026-11-02). Causa: posição absoluta com `left: 50%` e `translateX(-50%)` sem largura definida, o que limita
  o aviso a metade da área do vídeo e espreme o ícone.
- **Alternativas consideradas:** faixa fixa abaixo do cabeçalho no celular; `Alert` de `@mlab/ui` com o X para
  abaixar a mão.
- **Resposta aprovada:** o aviso continua sobre o vídeo, no topo, ocupando a largura disponível com margem de 16 px de
  cada lado; o ícone tem tamanho fixo e o texto fica em uma ou duas linhas. Desktop e tela cheia usam o mesmo
  componente.

## C-602 — Padrão visual

- **Resposta aprovada:** botão "Abaixar mão" com o `Button` de `@mlab/ui`; cores, borda e raio a partir dos tokens
  `colors` e `radii` de `@mlab/ui`. O `Alert` não é usado: ele tem `role="alert"` e não tem botão de ação com texto.

## Resultado

CLOSED — C-601 e C-602 respondidas; nenhuma ambiguidade em aberto.
