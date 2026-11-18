# Spec: Ocultação do Cursor na Transmissão de Janela Específica

Status: READY
Feature ID: `007-mascara-cursor-janela`
Origem: issue #28; issue #70 (lupa no modo janela, C-705); revisão do PR #26 (`cursorMask.worker.ts:369`, "Preserve cursor masking in the passthrough path").

## 1. Objetivo

Restaurar a ocultação contextual do cursor no modo **janela específica** (003, US-20, RF-310), removida no commit
`29c54d0` para ganhar fluidez, **sem reduzir o FPS nem a qualidade da transmissão**.

Hoje o worker de vídeo repassa todo quadro sem consultar `CursorState.visible`/`rect`. Com isso, o cursor aparece para
os alunos quando a janela transmitida está sem foco ou encoberta sob o ponteiro, inclusive pelo próprio MLab.

No modo **tela cheia**, a captura vai crua ao WebRTC desde o `29c54d0`. A decisão do produto (C-702) é manter assim e
ajustar o requisito da 003: o cursor não é ocultado sobre a área do MLab nesse modo.

## 2. Escopo

### Incluído

- ocultação do cursor no modo janela específica, só nos quadros em que ela é necessária;
- cobertura do rastro do cursor em movimento rápido e preenchimento sem borrão com o cursor parado (C-703);
- cursor mostrado, em vez de apagado, quando o conteúdo em volta dele está mudando (vídeo, animação) (C-704);
- proteção de FPS: a ocultação é suspensa quando custa mais que o orçamento por quadro, e é retentada depois;
- resolução do quadro composto igual à do quadro capturado;
- emenda do US-20 / RF-310 da 003 para o modo tela cheia;
- roteiro do smoke A12 e medição A/B registrada em `docs/metrics/`;
- lupa/destaque no modo janela específica seguindo a mesma regra do cursor (C-705, issue #70).

### Não incluído

- ocultação no modo tela cheia (estudo futuro: troca dinâmica de faixa com `replaceTrack`, C-702);
- mudanças na regra de visibilidade (`cursorPresence.ts`, `cursorVisibility.ts`), no contrato `CursorState`, na SFU,
  no SDP, no REMB ou na `degradationPreference`;
- reconstrução de conteúdo em movimento (vídeo) sob o cursor: nesse caso o cursor é mostrado (C-704);
- mudança nos traços (caneta, marcador, seta, retângulo) no modo janela: continuam no vídeo como hoje (C-705).

## 3. Atores

Professor (app desktop); alunos (web), que recebem a transmissão.

## 4. User Stories

### US-701 — Cursor oculto na janela específica
**Como** professor transmitindo uma janela, **quero** que o cursor não apareça para os alunos quando a janela
transmitida não está em foco ou está coberta sob o ponteiro, **para** não mostrar movimentos que não fazem parte da
aula.
- Com outra janela (ou o MLab) cobrindo a janela transmitida sob o ponteiro, o cursor não aparece para o aluno.
- Com a janela transmitida em foco e sob o ponteiro, o cursor aparece normalmente.

### US-702 — Transmissão sem perda de fluidez
**Como** professor, **quero** que a ocultação do cursor não reduza o FPS nem a resolução da transmissão, **para** a
aula continuar fluida.

### US-703 — Lupa fora da janela transmitida não aparece (C-705, issue #70)
**Como** professor transmitindo uma janela, **quero** que a lupa e o destaque usados fora da janela transmitida não
apareçam para os alunos, **para** a transmissão mostrar só o que faz parte da aula.
- Com outra janela (ou o MLab) em foco e a lupa ligada, os alunos não veem a lupa sobre a janela transmitida.
- Com a janela transmitida em foco e sob o ponteiro, a lupa aparece para os alunos e acompanha o ponteiro.
- Com a lupa posicionada no visualizador do MLab, ela aparece para os alunos como hoje.
- Os traços já desenhados continuam no vídeo, com ou sem foco na janela transmitida.

## 5. Requisitos

- RF-701: no modo janela específica, o cursor é apagado do quadro quando `CursorState.visible` é `false` e
  `CursorState.rect` não é nulo (cursor dentro da fonte, mas que não deve aparecer). A área apagada é a união dos
  retângulos ocultos dos últimos 150 ms, cobrindo o atraso entre o estado do cursor e o quadro capturado (C-703).
- RF-702: quando o cursor deve aparecer (`visible: true`), ou está fora da fonte (`rect: null`), e não há anotação
  desenhada no worker, o quadro é repassado sem cópia e sem gerar quadro novo. O único trabalho extra é atualizar a
  placa de fundo a cada 250 ms (uma cópia do quadro, sem codificar nada), sujeito à proteção de FPS (C-703).
- RF-703: se o tempo médio de composição de um quadro com ocultação (ou de atualização da placa) passar do orçamento (8 ms, metade do intervalo
  a 60 fps), a ocultação é suspensa e o quadro é repassado; ela é retentada após uma espera que dobra a cada nova
  suspensão (5 s, 10 s, 20 s, 40 s, máximo 60 s). As anotações não são afetadas pela suspensão (C-701).
- RF-704: o quadro composto tem a mesma resolução de exibição (`displayWidth` × `displayHeight`) do quadro capturado,
  para que alternar entre repasse e composição não reconfigure o encoder.
- RF-706: a área apagada é preenchida com a placa de fundo sempre que a placa tem pixels limpos naquela região,
  inclusive com o cursor parado; o preenchimento pelo entorno (borrado) só é usado quando não há pixel limpo
  conhecido (C-703).
- RF-707: quando o conteúdo em volta da área apagada muda em relação à placa de fundo (vídeo, animação, rolagem), o
  quadro segue sem a máscara e o cursor aparece; a máscara volta 500 ms depois da última mudança detectada. Sobre
  conteúdo parado, a ocultação continua como em RF-701 e RF-706 (C-704).
- RF-705: no modo tela cheia, o cursor não é ocultado; a captura segue direto ao WebRTC (C-702).
- RF-708: no modo janela específica, a lupa/destaque só é desenhada no quadro quando o cursor deve aparecer
  (`CursorState.visible` é `true` e `CursorState.rect` não é nulo) ou quando foi posicionada no visualizador do MLab
  (`spotlight.activeInViewer`). Fora disso o quadro segue sem a lupa; sem outra anotação, pelo repasse (RF-702). Os
  traços não mudam: seguem a regra atual de anotações. A suspensão da proteção de FPS não afeta essa regra (C-705).
- Nota (032) sobre RF-701 e RF-708: com uma janela fixada no modo de múltiplas janelas, a "janela transmitida" das
  regras acima é a janela fixada, mesmo com o foco em outra janela autorizada (`032-fixar-janela-transmissao`,
  RF-3208).
- RNF-701: com o cursor visível, FPS e resolução recebidos pelo aluno iguais à linha de base (`development` antes da
  feature); com o cursor oculto, FPS recebido ≥ 95% do alvo, resolução inalterada e nenhum keyframe extra a cada
  alternância entre caminhos.
- RNF-702: kill-switch `mlab.cursorMask=off`, fallback para a faixa bruta sem Insertable Streams e degradação sem erro
  em sistemas sem rastreador nativo continuam valendo (003, RNF-303).
- RNF-703: suspensão e retomada da ocultação ficam registradas no log do renderer com o prefixo `[CursorMask]`.

## 6. Regras de Negócio

- RN-701: a regra de quando o cursor deve aparecer é a da 003 (`isCursorVisibleWindowMode`), sem alteração. No modo
  janela, a lupa usa a mesma regra (RF-708).
- RN-702: entre FPS e ocultação, o FPS tem prioridade (C-701).

## 7. Critérios de Sucesso

- Testes unitários da política de caminho e da proteção de FPS (vitest) verdes; suítes e builds do monorepo verdes.
- Medição A/B no app empacotado registrada em `docs/metrics/`, atendendo RNF-701.
- Smoke A12 manual OK no roteiro atualizado.
