# Spec: Barra Flutuante de Marcação nos Cantos da Tela

Status: READY
Feature ID: `026-barra-flutuante-cantos`
Origem: issue #78. Correção da barra flutuante de marcação do professor (fora da janela do MLab), da US de marcação
da `003-classroom-interaction`; não cria capacidade nova.

## 1. Objetivo

Manter a barra flutuante de marcação sempre inteira na tela ao expandir a partir da bolinha (barra minimizada) e fazer
a bolinha voltar ao ponto onde o professor a deixou ao minimizar.

## 2. Contexto

Verificado em 2026-11-12 na `development` @ `e997fc8`, em
`apps/desktop/src/renderer/components/FloatingAnnotationOverlay.tsx`:

- Bolinha (~52×52) e barra aberta (~440×54 na horizontal, ~54×440 na vertical) compartilham uma única posição
  `toolbarPos` (canto superior esquerdo), salva em `sessionStorage` (`mlab.floatingToolbarPos`) e enviada ao main em
  `AnnotationSessionState.toolbarPos`.
- O limite à borda da tela só existe durante o arraste. Expandir e minimizar só trocam `collapsed`: com a bolinha perto
  da direita ou da base, a barra aberta cresce para fora da tela; ao minimizar, a bolinha fica onde a barra aberta
  estava.
- A orientação (horizontal no topo/base, vertical nas laterais) é derivada do canto superior esquerdo a cada render
  (`computeToolbarDockZone`).
- `collapsed` muda pelo botão, por `Alt+H`/`Alt+Shift+H`, pela tecla `h` com o overlay em foco e pela sincronização
  com a janela do MLab.

## 3. Escopo

### Incluído

- Posições independentes para a bolinha e para a barra aberta, só na sessão.
- Cálculo da posição da barra aberta ao expandir, ancorada à bolinha e limitada à tela.
- Restauração da posição da bolinha ao minimizar, por qualquer caminho.

### Não incluído

- Barra interna da janela do MLab (`Room.tsx`).
- Contrato `AnnotationSessionState` (`packages/types`) e processo main.
- Persistência entre sessões.
- Comportamento dos atalhos em si (quem recebe `Alt+H`).

## 4. Atores

- **Professor:** transmite a tela e usa a barra flutuante de marcação fora da janela do MLab.

## 5. User Stories

### US-2601 — Expandir a bolinha no canto sem sair da tela

Como professor, quero abrir a barra a partir da bolinha em qualquer canto e ver todas as ferramentas.

- Dado que a bolinha está no canto inferior direito, quando clico nela, então a barra aberta termina rente a esse canto
  e fica inteira na tela.
- Dado que a bolinha está em qualquer um dos quatro cantos ou bordas, quando expando, então a barra cresce para dentro
  da tela, com a orientação da borda onde a bolinha está.
- Dado que há mão levantada (017) ou o popover de cores está aberto, então a barra e o popover continuam inteiros na
  tela.

### US-2602 — Minimizar e a bolinha volta ao ponto

Como professor, quero que a bolinha volte ao ponto onde eu a deixei, mesmo depois de mover a barra aberta.

- Dado que deixei a bolinha no ponto A, expandi e arrastei a barra aberta para B, quando minimizo, então a bolinha
  volta para A.
- Dado que não movi a bolinha desde que minimizei, quando expando de novo, então a barra volta para B.
- Dado que movi a bolinha para A', quando expando, então a barra abre ancorada a A'.

## 6. Requisitos Funcionais

- RF-2601: a bolinha e a barra aberta têm posições independentes, lembradas só durante a sessão (`sessionStorage`).
- RF-2602: ao expandir, se existe posição salva da barra aberta e a bolinha não foi arrastada desde então, a barra
  abre nessa posição e com a orientação que tinha, limitada à tela.
- RF-2603: senão, a barra abre ancorada à bolinha, com a orientação da zona da bolinha (`computeToolbarDockZone`):
  - horizontal (topo/base): alinha à borda direita da bolinha se o centro dela está na metade direita da tela, senão à
    esquerda; na base alinha à borda inferior da bolinha, no topo à superior;
  - vertical (esquerda/direita): na direita alinha à borda direita da bolinha, na esquerda à esquerda; alinha à borda
    inferior se o centro da bolinha está na metade de baixo da tela, senão à superior.
- RF-2604: a barra aberta fica inteira na tela, com margem de 6px, usando o tamanho real medido (inclui o indicador de
  mãos da 017); se ela crescer depois de aberta, é limitada de novo. A orientação não muda por esse ajuste.
- RF-2605: ao minimizar, por botão, atalho ou sincronização com a janela do MLab, a bolinha volta à posição dela,
  limitada à tela.
- RF-2606: arrastar a barra aberta só muda a posição da barra aberta; arrastar a bolinha só muda a da bolinha e faz a
  próxima expansão seguir a RF-2603.

## 7. Requisitos Não Funcionais

- RNF-2601 — contrato: `AnnotationSessionState.toolbarPos` continua sendo a posição visível atual; sem campo novo,
  sem mudança no main nem em `packages/types`.
- RNF-2602 — compatibilidade: o hit-test do Linux (009, RF-902) recebe o retângulo da barra na posição nova; o
  indicador de mãos (017) e a orientação adaptativa continuam como estão.
- RNF-2603 — dependências: nenhuma nova.

## 8. Estados e Erros

| Situação | Resultado |
|---|---|
| Primeira expansão da sessão | ancorada à bolinha (RF-2603) |
| Reexpandir sem mover a bolinha | posição e orientação anteriores da barra aberta (RF-2602) |
| Reexpandir depois de mover a bolinha | ancorada à nova posição da bolinha (RF-2603) |
| Minimizar | bolinha na posição dela (RF-2605) |
| `sessionStorage` indisponível ou inválido | posição padrão atual (24, 140), sem erro |

## 9. Edge Cases

- Tela menor que a barra (ex.: 1366×768 com a barra vertical): a barra fica na margem de 6px e o resto é cortado, como
  no arraste atual.
- Ajuste da barra vertical ancorada pela base que levaria o canto superior para a faixa do topo: a orientação continua
  vertical (RF-2604).
- Mudança de resolução durante a sessão: as posições são limitadas à tela no próximo expandir/minimizar ou ao medir.

## 10. Dados/Contratos impactados

- Nenhum contrato. Chaves de `sessionStorage` novas no renderer do overlay: `mlab.floatingToolbarBubblePos` e
  `mlab.floatingToolbarExpanded`; `mlab.floatingToolbarPos` continua com a posição visível atual.

## 11. Critérios de Sucesso

- Testes do desktop: bolinha nos quatro cantos e nas bordas, em 1920×1080 e 1366×768, expande com o retângulo inteiro
  na tela e a orientação da zona da bolinha; minimizar depois de arrastar a barra aberta devolve a bolinha ao ponto;
  reexpandir sem mover a bolinha volta à posição da barra aberta; minimizar por sincronização e por atalho também
  restaura a bolinha; testes da 009 e da 017 continuam verdes.
- Manual no Windows: bolinha nos quatro cantos, expandir, arrastar a barra aberta, minimizar, `Alt+H`, com e sem mão
  levantada.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-2601 a C-2604).
