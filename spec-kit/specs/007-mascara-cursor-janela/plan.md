# Plan: Ocultação do Cursor na Transmissão de Janela Específica

Feature: `007-mascara-cursor-janela`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (CLOSED — C-701, C-702, C-703)

## 1. Summary

1. **Política pura (RF-701, RF-702)** — novo módulo `apps/desktop/src/renderer/media/cursorMaskPolicy.ts` com
   `decideFramePath(cursor, annotations, maskSuspended)`, que devolve `{ compose, maskCursor, drawAnnotations }`. O
   worker passa a decidir o caminho de cada quadro por ela; o repasse sem cópia continua sendo o caminho quando
   `compose` é `false`. A função é testável em vitest (o worker usa `VideoFrame`/`OffscreenCanvas`, ausentes no jsdom).
2. **Máscara no worker (RF-701, RF-704)** — `cursorMask.worker.ts` volta a usar o algoritmo anterior ao `29c54d0`
   (`updatePlatePreservingCursor`, `inpaintFromNeighborhood`, `rectsOverlap`, que ainda estão no arquivo), com
   três ajustes:
   - a placa de fundo só é atualizada (a cada 90 ms) enquanto a máscara está ativa, e é invalidada quando um quadro
     segue pelo repasse; com o cursor visível, não há nenhuma cópia de quadro;
   - a máscara é aplicada antes das anotações, no mesmo quadro composto;
   - canvas e quadro composto usam `displayWidth`/`displayHeight` (hoje: `codedWidth`/`codedHeight`, que pode ter
     preenchimento, por exemplo 1088 linhas em NV12).
3. **Proteção de FPS (RF-703, RNF-703)** — classe pura `FrameBudgetGuard` no mesmo módulo da política: média móvel
   exponencial (α = 0,1) do tempo de composição dos quadros com máscara, mínimo de 10 amostras, orçamento de 8 ms,
   suspensão com espera de 5 s que dobra até 60 s. O relógio é injetado para teste. O worker envia
   `{ type: 'mask-suspended', avgMs, retryInMs }` e `{ type: 'mask-resumed' }`; `createCursorMaskedTrack.ts` registra
   essas mensagens (e a `fatal`, hoje ignorada) no log com prefixo `[CursorMask]`.
4. **Rastro e placa (RF-701, RF-706; C-703, T707)** — classe pura `CursorTrail` no módulo da política: guarda os
   estados do cursor com o instante de chegada e devolve a união dos retângulos ocultos (`maskRect`) e de todos os
   retângulos (`anyRect`) vigentes nos últimos 150 ms. `decideFramePath` passa a receber `maskRect`. No worker:
   - a placa é atualizada também no repasse, a cada 250 ms (90 ms durante a máscara), preservando `anyRect`;
   - uma região "suja" (o `anyRect` de quando a placa nasceu) é limpa assim que uma atualização não a sobrepõe;
   - a máscara copia da placa sempre que `maskRect` não sobrepõe a região suja; senão, preenche pelo entorno;
   - a regra dos 350 ms parado é removida; o canvas de recorte cresce conforme o rastro (antes, fixo em 256 px);
   - o custo de cada atualização da placa no repasse entra na `FrameBudgetGuard`.
4a. **Composição em memória (RF-701, RF-703, RF-704; T708)** — medição do professor (2026-11-02): com a máscara
   ativa a transmissão engasga. Causa medida em harness: o quadro capturado chega em memória (`I420`) e vai direto
   ao encoder no repasse, mas o quadro composto sai do `OffscreenCanvas` acelerado (RGBA na GPU) e o encoder precisa
   lê-lo de volta da GPU e convertê-lo a cada quadro. Essa leitura acontece dentro do `await writer.write` (7–13 ms
   por quadro a 50 fps numa janela de 1376×782), fora do tempo medido pela proteção de FPS (~0,7 ms), que por isso
   nunca suspende. Mudanças:
   - quando o formato do quadro é mapeável em memória (`I420`, `I420A`, `I422`, `I444`, `NV12`, `RGBA`, `RGBX`,
     `BGRA`, `BGRX`), a máscara é feita nos planos do próprio quadro: `VideoFrame.copyTo` para um buffer, cópia do
     retângulo a partir da placa (também um buffer no mesmo layout) ou preenchimento pelo entorno, e
     `new VideoFrame(buffer, { format, layout })` no mesmo formato e resolução de exibição do quadro capturado;
   - o preenchimento pelo entorno em memória é o mesmo critério do canvas (linhas logo acima e abaixo da área,
     interpoladas na vertical), não um algoritmo novo;
   - com anotações no worker, o quadro já mascarado em memória é a base do canvas das anotações;
   - formatos não mapeáveis seguem o caminho do canvas atual;
   - a proteção de FPS passa a medir a composição **e** a entrega ao gerador (`await writer.write`) dos quadros com
     máscara, para enxergar o custo de conversão onde quer que ele aconteça;
   - funções puras de planos (geometria, cópia de retângulo, cópia preservando retângulo, preenchimento) ficam em
     `apps/desktop/src/renderer/media/cursorMaskFrame.ts`, testáveis em vitest.
4b. **Conteúdo em movimento sob o cursor (RF-707; C-704, T709)** — no caminho em memória, antes de apagar o cursor:
   - função pura `ringChangeRatio` em `cursorMaskFrame.ts`: fração das amostras do primeiro plano (luma em YUV;
     canais de cor nos formatos empacotados) que diferem entre o quadro atual e a placa num anel de 12 px em volta
     da área apagada, com tolerância por amostra de 12 níveis;
   - fração acima de 3% marca o conteúdo como em movimento; enquanto houver mudança e até 500 ms depois da última,
     o quadro segue sem a máscara (repasse do quadro capturado, ou só as anotações, quando houver);
   - sem comparação confiável (placa sem pixels limpos no anel, anel vazio na borda do quadro), mantém a decisão
     anterior;
   - a placa continua sendo atualizada nesse período (90 ms), para a detecção seguir valendo;
   - o custo (cópia + comparação + entrega) entra na proteção de FPS como os quadros com máscara;
   - formatos não mapeáveis (caminho do canvas) não têm detecção e seguem como hoje.
5. **Tela cheia (RF-705)** — nenhuma mudança de código. Emenda do US-20 / RF-310 em
   `spec-kit/specs/003-classroom-interaction/spec.md` e roteiro do A12 em `docs/metrics/smoke-runbook.md`.
6. **Medição (RNF-701)** — no app empacotado, janela específica em 1080p. No aluno (Chrome),
   `chrome://webrtc-internals`, `inbound-rtp` de vídeo: `framesPerSecond`, `frameWidth`/`frameHeight`,
   `keyFramesDecoded`, `freezeCount`. Três cenários: cursor visível, cursor oculto (outra janela cobrindo a janela
   transmitida sob o ponteiro) e anotação ativa; linha de base na `development` sem a feature. Resultado em
   `docs/metrics/cursor-mask-2026-11.md`.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Decisão por quadro | `decideFramePath` pura; `maskCursor = !suspensa && !visible && rect com área > 0` | RF-701, RF-702 |
| Anotações | `drawAnnotations` igual à regra atual (`hasAnyAnnotation && !capturedNativelyByScreen`) | RF-702 |
| Placa de fundo | atualizada a cada 250 ms no repasse e 90 ms na máscara, preservando o rastro | RF-702, RF-706 |
| Rastro | união dos retângulos dos últimos 150 ms | RF-701, C-703 |
| Resolução | `displayWidth`/`displayHeight` | RF-704 |
| Orçamento | 8 ms, EMA α 0,1, 10 amostras, espera 5→60 s | RF-703, C-701 |
| Medição do tempo | do início da composição até o fim do `await writer.write` do quadro com máscara (T708; antes: só até criar o `VideoFrame`) | RF-703 |
| Quadro composto com máscara | em memória, no formato do quadro capturado, quando mapeável; canvas só para formatos não mapeáveis e para desenhar anotações | RF-701, RF-704, T708 |
| Conteúdo em movimento | anel de 12 px, tolerância 12 níveis, limiar 3%, cursor mostrado até 500 ms após a última mudança; só no caminho em memória | RF-707, C-704 |
| Log | `[CursorMask]` no renderer | RNF-703 |
| Tela cheia | sem mudança de código | RF-705, C-702 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Canvas sem aceleração por GPU no worker | FPS cai durante a máscara | proteção de FPS (RF-703); conferência em `chrome://gpu` na medição |
| Alternar repasse/composição reconfigurar o encoder | engasgo e keyframe a cada alternância | mesma resolução (RF-704); `keyFramesDecoded` na medição |
| Cursor pisca 1–2 quadros na transição | cursor visível por instantes | atraso do IPC já existia antes do `29c54d0`; margem por velocidade do `toNormalizedCursorRect` |
| Cursor parado sobre vídeo | área congelada no último conteúdo limpo | aceito (C-703); conteúdo de aula é majoritariamente estático |
| Cópia da placa no repasse | custo pequeno e periódico com o cursor visível | 4 cópias/s; medida pela proteção de FPS, que suspende máscara e placa |
| Quadro composto na GPU convertido a cada quadro pelo encoder | engasgo com a máscara ativa, invisível à proteção de FPS | composição em memória no formato capturado e medição incluindo a entrega ao gerador (T708) |
| Layout ou formato do quadro mudando no meio da transmissão | cópia com geometria errada | geometria recalculada a cada quadro a partir do `copyTo`; mudança reinicia a placa |
| Conteúdo em movimento sob o cursor | quadrado com conteúdo antigo acompanhando o cursor | cursor mostrado enquanto o anel em volta muda (RF-707, T709) |
| Detecção falsa (cursor desenhado fora da área, cursor de texto piscando no anel) | cursor aparece por 500 ms sobre conteúdo parado | limiar de 3% do anel; tolerância por amostra |
| Suspensão e retomada alternando | cursor aparece e some periodicamente | espera crescente até 60 s |
| Mudança no caminho das anotações por `displayWidth` | quadro anotado com outra resolução | é correção: hoje a resolução pode divergir do repasse; coberto pela medição com anotação ativa |

## Scope Lock

### IN

- política de caminho por quadro e proteção de FPS no renderer do desktop;
- máscara do cursor no worker de vídeo do modo janela específica;
- log das mensagens do worker em `createCursorMaskedTrack.ts`;
- emenda do US-20 / RF-310 da 003 para a tela cheia, roteiro do A12 e registro da medição.

### OUT

- modo tela cheia no código (`useScreenCapture.ts`), troca de faixa e publisher WebRTC;
- regra de visibilidade do cursor, rastreador nativo e processo principal;
- backend, web, `packages/**` e contratos.

### Allowed Paths

- `apps/desktop/src/renderer/media/cursorMaskPolicy.ts`
- `apps/desktop/src/renderer/media/cursorMaskPolicy.test.ts`
- `apps/desktop/src/renderer/media/cursorMask.worker.ts`
- `apps/desktop/src/renderer/media/cursorMaskFrame.ts`
- `apps/desktop/src/renderer/media/cursorMaskFrame.test.ts`
- `apps/desktop/src/renderer/media/createCursorMaskedTrack.ts`
- `apps/desktop/src/renderer/media/createCursorMaskedTrack.test.ts`
- `spec-kit/specs/003-classroom-interaction/spec.md`
- `spec-kit/specs/003-classroom-interaction/tasks.md`
- `docs/metrics/smoke-runbook.md`
- `docs/metrics/cursor-mask-2026-11.md`
- `spec-kit/specs/007-mascara-cursor-janela/**`

### Prohibited Paths

- `apps/desktop/src/main/**`, `apps/desktop/src/shared/**`
- `apps/desktop/src/renderer/hooks/**`, `apps/desktop/src/renderer/pages/**`, `apps/desktop/src/renderer/components/**`
- `apps/backend/**`, `apps/web/**`, `packages/**`
- `spec-kit/specs/003-classroom-interaction/contracts/**`

### Dependencies

- Nenhuma nova. Existentes: Insertable Streams do Chromium (`MediaStreamTrackProcessor`/`MediaStreamTrackGenerator`),
  `OffscreenCanvas`, `VideoFrame` (inclusive `copyTo` e construção a partir de buffer), `@mlab/types` (`CursorState`, `AnnotationOverlayState`), `vitest`.

### Non-Goals

- ocultar o cursor na tela cheia;
- novo algoritmo de preenchimento da área do cursor;
- reconstrução de conteúdo em movimento sob o cursor (C-704: o cursor é mostrado);
- painel de métricas WebRTC no app.

## 4. Constitution Check

- [x] Princípio I — spec aprovada (issue #28, C-701, C-702).
- [x] Princípio II — nenhuma regra de autorização envolvida.
- [x] Princípio III — SFU intocada; nada é reencodado por aluno.
- [x] Princípio IV — metas de desempenho só declaradas após medição (T705).
- [x] Princípio V — nenhum contrato alterado (`CursorState` e IPC iguais).
- [x] Princípio VI — Scope Lock e paths por task.
- [x] Princípio VII — reaproveita o algoritmo e os canvases já presentes no worker.
- [ ] Princípio VIII — converge ao final (T706).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-02 | FPS tem prioridade; máscara condicional com proteção reversível | C-701 |
| 2026-11-02 | Tela cheia sem ocultação; `replaceTrack` como estudo futuro | C-702 |
| 2026-11-02 | Rastro de 150 ms e placa mantida no repasse após o teste do professor | C-703 |
| 2026-11-02 | Máscara composta em memória no formato capturado; proteção de FPS mede também a entrega ao gerador | T708 |
| 2026-11-03 | Cursor mostrado quando o conteúdo em volta dele está mudando | C-704, T709 |
