# Analyze: Ocultação do Cursor na Transmissão de Janela Específica

Feature: `007-mascara-cursor-janela`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

- O US-20 / RF-310 da 003 exige ocultar o cursor sobre o MLab na tela cheia; a 007 decide o contrário (C-702). A
  emenda é feita na própria 003 (T704), antes da convergência, seguindo a direção spec → tasks.
- A T310 da 003 está `[x]`, mas o comportamento regrediu no `29c54d0`. A T704 registra a nota; a T705 revalida pelo
  smoke A12.

Nenhuma outra contradição: a regra de visibilidade (RN-701) e o contrato `CursorState` não mudam.

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-701 | T701, T702, T707, T708 |
| RF-702 | T701, T702 |
| RF-703 | T703, T707, T708 |
| RF-704 | T702, T705, T708 |
| RF-705 | T704 |
| RF-707 | T709 |
| RF-708 | T710 |
| RF-706 | T707, T708 |
| RNF-701 | T705 |
| RNF-702 | T703 (testes de `createCursorMaskedTrack` mantidos) |
| RNF-703 | T703 |

## 3. Contratos

Nenhum contrato alterado. As mensagens `mask-suspended`/`mask-resumed` são internas entre o worker e
`createCursorMaskedTrack.ts`, no mesmo módulo `renderer/media`, e não cruzam processos nem serviços.

## 4. Tarefas fora do Scope Lock

Nenhuma. T701–T703 alteram só `apps/desktop/src/renderer/media/**` listados; T704 só a spec/tasks da 003 e o
runbook; T705–T706 só documentação. `useScreenCapture.ts`, o processo principal e `packages/**` estão proibidos.

## 5. Riscos

- Desempenho só verificável no app real: a T705 é manual e bloqueia a convergência.
- Canvas sem GPU: mitigado pela proteção de FPS (RF-703).
- Alternância de resolução: mitigada por RF-704 e verificada por `keyFramesDecoded`.

## 5a. Revalidação após C-703 (2026-11-02)

RF-701, RF-702 e RF-703 emendados e RF-706 criado a partir do teste do professor; a T707 cobre as mudanças dentro
dos mesmos Allowed Paths. A T702 continua válida como base; a T707 substitui a regra dos 350 ms e a invalidação da
placa no repasse. Nenhum contrato ou path novo.

## 5b. Revalidação após o engasgo com a máscara ativa (2026-11-02)

O professor relatou engasgo com o MLab (ou outra janela) em foco e o cursor sobre a janela transmitida, ou seja,
com a máscara ativa; com a janela transmitida em foco (repasse) não há engasgo. Harness com captura real e
loopback WebRTC: quadros capturados em `I420`; o quadro composto no canvas custa ~0,7 ms medido, mas o
`await writer.write` espera 7–13 ms por quadro (leitura da GPU e conversão para o encoder), fora da medição da
proteção de FPS. O plan ganhou o item 4a e a linha de medição foi corrigida; a T708 cobre a mudança.

- Requisitos: nenhum muda. RF-703 ("tempo médio de composição") passa a contar a entrega ao gerador, que é parte
  de produzir o quadro; RF-704 é mantido (mesmo formato e resolução de exibição do capturado).
- Scope Lock: dois paths novos em `renderer/media` (`cursorMaskFrame.ts` e o teste), dentro do IN; nenhuma
  dependência nova (`VideoFrame.copyTo` já faz parte do `VideoFrame`).
- Non-Goal "novo algoritmo de preenchimento": respeitado; o preenchimento em memória usa o mesmo critério do canvas.
- Cobertura: RF-701, RF-703, RF-704 e RF-706 também por T708; T705 e T706 passam a depender da T708.

## 5c. Revalidação após o quadrado sobre conteúdo em movimento (2026-11-03)

O professor relatou um quadrado borrado acompanhando o cursor oculto sobre vídeo ou animação; com conteúdo parado,
a ocultação funciona. Harness com janela animada reproduz: a área apagada mostra conteúdo de 0,3 a 0,5 s atrás,
congelado na placa enquanto o cursor passa. C-704 decide mostrar o cursor nesse caso.

- Requisitos: RF-707 novo; o "Não incluído" da spec troca a aceitação de C-703 (último conteúdo limpo sob cursor
  parado sobre vídeo) por C-704. RF-701 e RF-706 continuam valendo sobre conteúdo parado; RN-702 (FPS primeiro)
  mantido, a detecção entra na proteção de FPS.
- Scope Lock: os mesmos paths da T708; nenhuma dependência nova; nenhum contrato.
- Non-Goals: acrescentado "reconstrução de conteúdo em movimento sob o cursor"; nenhum conflito.
- Cobertura: RF-707 pela T709; T705 e T706 passam a depender da T709.

## 5d. Revalidação após a lupa no modo janela (issue #70, 2026-11-11)

Relatado no teste manual do PR #69: com o professor em outra janela e a lupa ligada, os alunos veem a lupa sobre a
janela transmitida. Verificado no código: o worker desenha a lupa sem consultar `CursorState.visible`. A US-19 da
003 não definia o caso; C-705 decide seguir a regra do cursor da US-20, mais o visualizador do MLab.

- Requisitos: RF-708 e US-703 novos; RN-701 estendida à lupa. Nenhum requisito existente muda: RF-702 já prevê o
  repasse quando não há o que desenhar; os traços seguem a regra atual de anotações.
- Contradição com a 003: nenhuma; a US-19 era omissa. A T710 registra uma nota na US-19 apontando a 007, como a T704
  fez na US-20.
- Contratos: nenhum. `CursorState` e `AnnotationOverlayState` já chegam ao worker; `activeInViewer` já existe no
  tipo `SpotlightState`. `FramePath` é interno ao `renderer/media`.
- Scope Lock: a T710 usa paths já no Allowed Paths do plan (`cursorMaskPolicy.ts`, teste, worker, spec da 003,
  runbook); overlay, páginas e processo principal continuam proibidos. Nenhuma dependência nova.
- Non-Goals: acrescentada a manutenção dos traços como estão; nenhum conflito.
- Cobertura: RF-708 pela T710 (unitário + teste manual); T705 e T706 passam a depender da T710.

## 6. Resultado

- [ ] FAIL
- [x] PASS — próxima execução: T710; depois T705 (medição A/B e smoke A12) e T706 (converge).
