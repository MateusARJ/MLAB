# Spec: Aviso de Mão Levantada Responsivo

Status: READY-FOR-PLAN
Feature ID: `006-banner-mao-levantada`
Origem: issue #5 ("o aviso fica desformatado e não segue o padrão do Design System").

## 1. Objetivo

Corrigir a exibição do aviso "Sua mão está levantada" no web do aluno. No celular, fora da tela cheia, o aviso ocupa
só metade da largura do vídeo: o texto quebra em quatro ou cinco linhas, o botão "Abaixar Mão" quebra em duas e o
ícone da mão encolhe até virar um ponto. O aviso também usa cores e botão próprios, fora dos componentes e tokens de
`@mlab/ui` (`docs/design-system.md`).

O comportamento de levantar e abaixar a mão (003, US-11, RF-301, RN-301) **não muda**: só a apresentação do aviso.

## 2. Escopo

### Incluído

- largura do aviso adequada à área do vídeo em qualquer largura de tela (celular, tablet, desktop, tela cheia);
- ícone da mão com tamanho fixo, sem encolher;
- botão "Abaixar mão" com o `Button` de `@mlab/ui`;
- cores, bordas e raios do aviso a partir dos tokens de `@mlab/ui`.

### Não incluído

- mudança no protocolo (`raise-hand`, `hand-updated`), na fila do professor ou no app desktop;
- mudança no botão "Levantar Mão" da barra de controles e da barra lateral de tela cheia;
- alterações em `packages/ui`.

## 3. Atores

Aluno (web, desktop e celular).

## 4. User Stories

### US-601 — Aviso legível no celular
**Como** aluno no celular, **quero** ver o aviso de mão levantada inteiro e legível, **para** saber que o professor
foi notificado e conseguir abaixar a mão.
- Com a mão levantada, na tela normal do celular, o aviso ocupa a largura disponível sobre o vídeo, com margem lateral.
- O texto ocupa no máximo duas linhas numa tela de 360 px de largura; o botão "Abaixar mão" não quebra linha.
- O ícone da mão aparece no tamanho padrão de ícones do Design System.

### US-602 — Aviso no padrão do Design System
**Como** responsável pelo produto, **quero** que o aviso use os componentes e tokens do Design System, **para** manter
a interface consistente.

## 5. Requisitos

- RF-601: o aviso de mão levantada ocupa até a largura da área do vídeo menos 16 px de cada lado, centralizado, em
  qualquer largura de tela; no desktop ele continua com a largura do conteúdo, sem esticar (C-601).
- RF-602: o ícone da mão não encolhe (tamanho fixo de 16 px) e o rótulo do botão não quebra linha.
- RF-603: o botão "Abaixar mão" usa o `Button` de `@mlab/ui`, e as cores, a borda e o raio do aviso vêm de `colors` e
  `radii` de `@mlab/ui` (C-602).
- RNF-601: o aviso mantém `role="status"`, o texto "Sua mão está levantada. O professor foi notificado." e a ação de
  abaixar a mão (`toggleHand(false)`) sem propagar o clique para o vídeo.

## 6. Regras de Negócio

- RN-601: as regras de mão levantada da 003 (RN-301 e US-11) valem como estão.

## 7. Critérios de Sucesso

- Teste de `Room` cobre a largura máxima, o ícone sem encolher e a ação do botão.
- E2E mobile do A15 confirma o aviso com largura maior que metade da área do vídeo.
- Suítes normais e builds continuam verdes.
