# Spec: Aviso de Mão Levantada Clicável e Sincronizado com a Fila

Status: READY
Feature ID: `031-aviso-mao-levantada`
Origem: issue #90 (desvio registrado no redesenho da UI 2.0). Restaura o critério de aceitação da US-11 da
`003-classroom-interaction` (RF-301): "um aviso quando a barra lateral está fechada" que leva o professor até a turma.

## 1. Objetivo

Fazer o aviso flutuante de mão levantada do app do professor funcionar como a US-11 descreve: os botões "Ver Turma" e
"Dispensar aviso" respondem ao clique, e o aviso some quando a mão que ele mostra deixa de estar levantada.

## 2. Contexto

Verificado em 2026-11-14 na `development` @ `91ae79a`:

- `apps/desktop/src/renderer/pages/Room.tsx`: o canvas de marcação (`data-testid="annotation-canvas"`, estilo
  `annotationCanvasOverlay`) ocupa 100% da `previewStageBox` com `zIndex: 15` e `pointerEvents: 'auto'`. O aviso
  (`handToastOverlay`) é irmão da `previewStageBox` dentro da `previewArea`, com `zIndex: 10`. A `previewStageBox` é
  `position: relative` sem `zIndex`, então não cria contexto de empilhamento: o canvas fica acima do aviso e recebe os
  cliques dos dois botões (`document.elementFromPoint` devolve o canvas — evidência da issue #90).
- A barra de marcação (`annotationToolbarLeft`, `zIndex: 25`) e o popover de cores (`palettePopoverBox`, `zIndex: 30`)
  já ficam acima do canvas.
- Com a ferramenta Cursor, o canvas continua tratando a lupa/foco (movimento e roda do mouse), então não pode deixar de
  receber eventos.
- `apps/desktop/src/renderer/hooks/useWebRTCPublisher.ts`: o estado `lastHandRaised` alimenta o aviso. Ele é definido em
  `hand-updated` com `raised: true` e só é limpo por `dismissHandToast`. `hand-updated` com `raised: false`,
  `lowerStudentHand` e `participants-update` (inclusive a saída do aluno) não o limpam. Abrir o painel só esconde o
  aviso (`lastHandRaised && !isSidebarOpen`); ao fechar o painel, ele volta.
- O teste `RoomHandRaise.test.tsx` usa `fireEvent.click`, que não passa pelo hit-testing do navegador, e por isso não
  detecta o problema de empilhamento.

## 3. Escopo

### Incluído

- Renderer do desktop: camada do aviso acima do canvas de marcação.
- Renderer do desktop: limpeza do aviso quando a mão mostrada é abaixada pelo aluno, pelo professor ou pela saída do
  aluno.
- Testes de unidade/componente para os dois comportamentos.

### Não incluído

- Backend, `apps/web`, `packages/types` e contratos: as mensagens `hand-updated`, `participants-update` e `lower-hand`
  não mudam.
- Mostrar a "próxima mão" da fila no aviso (C-3101).
- Dispensar o aviso ao abrir o painel (C-3102).
- Mudar o tratamento de eventos do canvas para a ferramenta Cursor.
- O redesenho visual do aviso (UI 2.0, issue #92).

## 4. Atores

- **Professor:** usa o app desktop com o painel lateral fechado durante a transmissão.
- **Aluno:** levanta e abaixa a mão no web; pode sair da sala.

## 5. User Stories

### US-3101 — Botões do aviso respondem ao clique

Como professor com o painel lateral fechado, quero clicar em "Ver Turma" ou no X do aviso de mão levantada, para ir até
a fila ou dispensar o aviso sem procurar outro caminho.

- Dado o aviso visível, quando o professor clica em "Ver Turma", então o painel abre na aba de alunos e o aviso é
  dispensado.
- Dado o aviso visível, quando o professor clica no X, então o aviso é dispensado.
- Os dois botões respondem com qualquer ferramenta de marcação ativa.
- Desenhar na prévia continua funcionando fora da área do aviso.

### US-3102 — Aviso acompanha a mão do aluno

Como professor, quero que o aviso suma quando a mão que ele mostra é abaixada, para não ser avisado de um pedido que já
não existe.

- Dado o aviso do aluno A, quando A abaixa a própria mão, então o aviso some.
- Dado o aviso do aluno A, quando o professor abaixa a mão de A pela aba de alunos, então o aviso some e não volta ao
  fechar o painel.
- Dado o aviso do aluno A, quando A sai da sala, então o aviso some.
- Dado o aviso do aluno B (que levantou a mão depois de A), quando a mão de A é abaixada, então o aviso de B continua.

## 6. Requisitos Funcionais

- RF-3101: o aviso de mão levantada fica acima do canvas de marcação na ordem de empilhamento da prévia, abaixo da barra
  de marcação e do popover de cores (C-3103), de modo que "Ver Turma" e "Dispensar aviso" recebem o clique com qualquer
  ferramenta ativa.
- RF-3102: "Ver Turma" abre o painel lateral na aba de alunos e dispensa o aviso; o X dispensa o aviso (comportamento
  atual dos handlers, mantido).
- RF-3103: ao receber `hand-updated` com `raised: false` para o `participant_id` do aviso, o aviso é removido.
- RF-3104: ao abaixar pela aba de alunos (`lowerStudentHand`) a mão do `participant_id` do aviso, o aviso é removido.
- RF-3105: ao receber `participants-update` em que o `participant_id` do aviso não está na lista ou está com
  `hand_raised` falso, o aviso é removido.
- RF-3106: eventos de outro `participant_id` não alteram o aviso; quando a mão do aviso é abaixada, o aviso some mesmo
  que haja outras mãos na fila (C-3101).

## 7. Requisitos Não Funcionais

- RNF-3101 — testabilidade: a regra de limpeza do aviso fica numa função pura testável sem WebSocket nem
  RTCPeerConnection; a ordem de camadas tem teste que falha se o aviso voltar para baixo do canvas.
- RNF-3102 — dependências: nenhuma nova.

## 8. Estados e Erros

| Situação | Evento | Resultado |
|---|---|---|
| aviso de A visível | clique em "Ver Turma" | painel aberto na aba de alunos; aviso dispensado (RF-3102) |
| aviso de A visível | clique no X | aviso dispensado (RF-3102) |
| aviso de A | `hand-updated` A `raised: false` | aviso removido (RF-3103) |
| aviso de A | professor abaixa A | aviso removido (RF-3104) |
| aviso de A | `participants-update` sem A ou com A de mão abaixada | aviso removido (RF-3105) |
| aviso de B | mão de A abaixada / A sai | aviso de B mantido (RF-3106) |
| aviso de A, painel aberto | professor abaixa A e fecha o painel | nenhum aviso (RF-3104) |

## 9. Edge Cases

- A levanta, abaixa e levanta de novo: o novo `hand-updated` com `raised: true` volta a mostrar o aviso (comportamento
  atual).
- `participants-update` que chega com A de mão levantada não altera o aviso.
- Popover de cores aberto sobre a área do aviso em prévias estreitas: o popover fica por cima (C-3103).

## 10. Dados/Contratos impactados

- Nenhum. `003/contracts/` não muda; só o estado local do renderer.
- `003/spec.md`, US-11: nota apontando esta feature. Não há espelho do RF-301 em `docs/requirements/`.

## 11. Critérios de Sucesso

- Teste de componente: com o aviso visível, o `zIndex` do aviso é maior que o do canvas de marcação e menor que o da
  barra de marcação, para cada ferramenta.
- Testes unitários da função de limpeza cobrindo RF-3103 a RF-3106.
- `npm test` e `npm run lint` (`tsc --noEmit`) do desktop verdes.
- Verificação manual no app real seguindo os passos de reprodução da issue #90.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-3101 a C-3104).
