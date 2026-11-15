# Spec: Fixar uma Janela na Transmissão de Múltiplas Janelas

Status: READY
Feature ID: `032-fixar-janela-transmissao`
Origem: issue #91 (pedido do professor durante o teste do redesenho da interface, UI 2.0). Evolução da US-09/RN-20 da
`001-screen-share-core` e do rastreamento de janelas da US-20 (RF-310) da `003-classroom-interaction`.

## 1. Objetivo

Permitir que o professor, no modo de múltiplas janelas autorizadas, **fixe** uma delas para mantê-la no ar enquanto usa
outra janela autorizada, e **desfixe** para a transmissão voltar a seguir o foco.

## 2. Contexto

Verificado em 2026-11-15 na `development` @ `c3a2f8b`:

- `apps/desktop/src/main/cursorPresence.ts` (`tick`): com mais de uma janela autorizada (`allowedWindowMap.size > 1`),
  quando o foco vai para outra janela autorizada, o rastreador troca o alvo do cursor (`currentTargetWindowId`) para
  ela e emite `active-window-changed` com o `sourceId`.
- `apps/desktop/src/renderer/pages/Room.tsx` (efeito "Rastreamento dinâmico de foco para Múltiplas Janelas"): ao
  receber `active-window-changed` de uma janela autorizada, chama `selectSource(...)` e `changeStream(...)` para
  transmiti-la.
- O seletor "Janelas da Aula (N)" (visível com 2+ janelas autorizadas na sessão ao vivo) chama `handleSwitchScreen`.
  A troca dura só até o próximo `active-window-changed`.
- `apps/desktop/src/renderer/hooks/useScreenCapture.ts` (`selectSource`): sempre recaptura a fonte e chama
  `startCursorTracking({ sourceId, type, displayId, allowedSourceIds })`. Nada escuta o fim (`ended`) da faixa de
  vídeo capturada.
- Não existe estado de "janela fixada".
- Se a fixação ficasse só no renderer, o main continuaria movendo o alvo do cursor para a janela em foco (B) enquanto o
  vídeo mostra a fixada (A): o cursor e a lupa seriam calculados sobre B e desenhados no lugar errado do vídeo de A
  (C-3202).

## 3. Escopo

### Incluído

- Renderer do desktop: ação Fixar/Desfixar no seletor "Janelas da Aula", estado da fixação, registro da última janela
  autorizada em foco, troca ao desfixar, desfixação automática e indicação em texto.
- Main do desktop: campo opcional `pinnedSourceId` no alvo do `cursor-tracking:start`, que mantém o alvo do cursor na
  janela fixada sem parar de emitir `active-window-changed`.
- Hook de captura: repassar a janela fixada ao rastreamento, reiniciar o rastreamento sem recapturar e avisar o fim da
  faixa de vídeo.
- Testes de unidade e de componente.

### Não incluído

- Atalho de teclado para fixar/desfixar (C-3204).
- Estado "fixada" na barra de marcação fora do MLab (C-3204).
- Mudança em `packages/types`, `apps/web`, `apps/backend` e no protocolo WebSocket.
- Mudança no evento `active-window-unauthorized` (não usado pelo renderer desde a 020).
- Persistir a fixação entre sessões.

## 4. Atores

- **Professor:** transmite no modo de janela específica com 2+ janelas autorizadas.
- **Aluno:** só vê o resultado (a janela transmitida); nada muda no web.

## 5. User Stories

### US-3201 — Fixar uma janela autorizada

Como professor com várias janelas autorizadas, quero fixar uma delas, para que a turma continue vendo essa janela
enquanto eu uso outra janela autorizada.

- Dado 2+ janelas autorizadas na sessão ao vivo, o seletor "Janelas da Aula" mostra a ação Fixar em cada janela,
  acessível por teclado e com nome acessível.
- Dado a janela A fixada, quando o foco vai para a janela autorizada B, a transmissão continua em A.
- Dado A fixada, quando o professor fixa B, a transmissão passa para B e A deixa de estar fixada.
- O estado "fixada" aparece em texto no seletor e no rótulo da prévia.

### US-3202 — Desfixar e voltar a seguir o foco

Como professor, quero desfixar a janela, para a transmissão voltar a acompanhar a janela autorizada em uso.

- Dado A fixada e o foco passado depois para a janela autorizada B, quando o professor desfixa A, a transmissão troca
  para B na hora, sem precisar clicar em B de novo.
- Dado A fixada e nenhuma outra janela autorizada em foco desde a fixação, quando o professor desfixa A, a transmissão
  continua em A, sem trocar a fonte.
- Depois de desfixar, colocar o foco em outra janela autorizada troca a transmissão para ela, como hoje.

### US-3203 — Fixação não fica presa a um estado inválido

Como professor, quero que a fixação seja desfeita sozinha quando não faz mais sentido, para não transmitir uma janela que
não existe mais nem levar a fixação para outra configuração.

- "Alterar Modo / Fonte" ou encerrar a transmissão desfazem a fixação.
- Se a janela fixada for fechada (a captura dela termina), ela é desfixada e a transmissão volta a seguir o foco.
- Se a janela fixada for minimizada, ela continua fixada.

## 6. Requisitos Funcionais

- RF-3201: com 2+ janelas autorizadas na sessão ao vivo, cada janela do seletor "Janelas da Aula" tem um botão de
  fixação com nome acessível "Fixar <nome da janela>" (ou "Desafixar <nome da janela>" quando fixada), `aria-pressed`
  refletindo o estado e acesso por teclado (Tab e Enter/Espaço).
- RF-3202: fixar a janela A torna A a única janela fixada. Se A não está no ar, a transmissão troca para A sem
  desconectar a sessão (RN-20 da 001); se já está no ar, a fonte não é recapturada. Fixar B com A fixada substitui a
  fixação (C-3205).
- RF-3203: com uma janela fixada, `active-window-changed` não troca a fonte transmitida; o app registra o `sourceId` da
  última janela autorizada que recebeu foco.
- RF-3204: ao desfixar, se a última janela autorizada registrada em RF-3203 é diferente da janela no ar e continua
  autorizada, a transmissão troca para ela na hora; caso contrário, a fonte não é trocada. Depois disso, a transmissão
  volta a seguir o foco entre todas as janelas autorizadas.
- RF-3205: o estado aparece em texto: no seletor, a janela fixada mostra "Fixada" e as demais "Em pausa"; o rótulo da
  prévia mostra "Fixada: <nome da janela>". Sem fixação, os textos atuais ("No Ar" e o rótulo do modo) não mudam.
- RF-3206: "Alterar Modo / Fonte", encerrar a transmissão e a saída da sessão ao vivo desfazem a fixação, sem troca de
  fonte.
- RF-3207: quando a faixa de vídeo da janela fixada termina (`ended`, janela fechada), a fixação é desfeita pela regra
  de RF-3204. Minimizar a janela fixada não desfaz a fixação (C-3203).
- RF-3208: com uma janela fixada, o alvo do rastreamento do cursor é a janela fixada: o cursor e a lupa só aparecem
  quando a janela fixada está em foco e sob o ponteiro (regra `isCursorVisibleWindowMode`, RN-701 da 007, aplicada à
  janela fixada). Emenda do RF-701/RF-708 da 007 para o caso fixado (C-3202).
- RF-3209: com uma janela fixada, clicar no nome de outra janela no seletor equivale a fixá-la (RF-3202). Sem
  fixação, clicar no nome troca a janela como hoje (C-3205).
- RF-3210: sem janela fixada, o comportamento da transmissão, do seletor e do rastreamento é idêntico ao atual.
- RF-3211: o main só aplica `pinnedSourceId` quando o id está entre os `allowedSourceIds`; caso contrário, ignora o
  campo e se comporta como sem fixação.

## 7. Requisitos Não Funcionais

- RNF-3201 — compatibilidade: `pinnedSourceId` é opcional no IPC `cursor-tracking:start`; chamadas sem ele mantêm o
  comportamento atual. Sem mudança em `packages/types`.
- RNF-3202 — testabilidade: as regras de fixação do main e do renderer têm testes unitários e de componente que simulam
  `active-window-changed` com e sem janela fixada.
- RNF-3203 — dependências: nenhuma nova.

## 8. Estados e Erros

| Situação | Evento | Resultado |
|---|---|---|
| sem fixação, A no ar | foco em B autorizada | transmite B (atual, RF-3210) |
| sem fixação, A no ar | Fixar A | A fixada, sem recaptura (RF-3202) |
| sem fixação, A no ar | Fixar B | B fixada e no ar (RF-3202) |
| A fixada | foco em B autorizada | continua A; última focada = B (RF-3203) |
| A fixada | foco no MLab ou em janela não autorizada | continua A; última focada inalterada (RF-3203) |
| A fixada, última focada B | Desafixar A | transmite B na hora (RF-3204) |
| A fixada, última focada A ou nenhuma | Desafixar A | continua A, sem recaptura (RF-3204) |
| A fixada | Fixar B ou clicar no nome de B | B fixada e no ar (RF-3202, RF-3209) |
| A fixada | Alterar Modo / Fonte ou encerrar | fixação desfeita (RF-3206) |
| A fixada | faixa de A termina | desfixa pela regra de RF-3204 (RF-3207) |
| A fixada | A minimizada | continua fixada (RF-3207) |
| A fixada, B em foco sob o ponteiro | cursor sobre B | cursor/lupa não aparecem (RF-3208) |

## 9. Edge Cases

- Sem rastreador nativo (ambiente sem suporte): não há eventos de foco; fixar e desfixar funcionam, e desfixar nunca
  troca a fonte (RF-3204).
- A troca para a última focada falha (captura recusada): a transmissão continua na janela que estava no ar, já
  desfixada.
- A faixa de uma janela não fixada termina: fora do escopo; segue o comportamento atual.
- Eventos de foco que chegam enquanto a troca de fixação ainda está em andamento: o último evento registrado vale.

## 10. Dados/Contratos impactados

- `spec-kit/specs/003-classroom-interaction/contracts/desktop-ipc.md`: `startCursorTracking(target)` ganha o campo
  opcional `pinnedSourceId`; `active-window-changed` continua sendo emitido com uma janela fixada (RNF-3201).
- `007-mascara-cursor-janela/spec.md` (RF-701/RF-708) e `003-classroom-interaction/spec.md` (US-20): notas apontando
  esta feature, adicionadas na T3206.
- Sem espelho em `docs/requirements/`: os requisitos da 003 e da 007 não são espelhados lá, e o RF027 descreve a
  captura de janela de forma genérica, sem conflito.

## 11. Critérios de Sucesso

- Testes do main: com `pinnedSourceId`, o foco em outra janela autorizada emite `active-window-changed` e o alvo do
  cursor continua na fixada; sem ele, o comportamento atual se mantém.
- Testes do `Room.test.tsx` cobrindo os critérios de US-3201 a US-3203.
- `npm test` e `npm run lint` do desktop verdes; testes existentes de múltiplas janelas sem alteração de asserção.
- Verificação manual no Windows com duas janelas autorizadas, incluindo o alinhamento do cursor com uma janela fixada.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-3201 a C-3206).
