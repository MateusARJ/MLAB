# Plan: Ocultação do Cursor na Transmissão de Janela Específica

Feature: `007-mascara-cursor-janela`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (CLOSED — C-701, C-702)

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
4. **Tela cheia (RF-705)** — nenhuma mudança de código. Emenda do US-20 / RF-310 em
   `spec-kit/specs/003-classroom-interaction/spec.md` e roteiro do A12 em `docs/metrics/smoke-runbook.md`.
5. **Medição (RNF-701)** — no app empacotado, janela específica em 1080p. No aluno (Chrome),
   `chrome://webrtc-internals`, `inbound-rtp` de vídeo: `framesPerSecond`, `frameWidth`/`frameHeight`,
   `keyFramesDecoded`, `freezeCount`. Três cenários: cursor visível, cursor oculto (outra janela cobrindo a janela
   transmitida sob o ponteiro) e anotação ativa; linha de base na `development` sem a feature. Resultado em
   `docs/metrics/cursor-mask-2026-11.md`.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Decisão por quadro | `decideFramePath` pura; `maskCursor = !suspensa && !visible && rect com área > 0` | RF-701, RF-702 |
| Anotações | `drawAnnotations` igual à regra atual (`hasAnyAnnotation && !capturedNativelyByScreen`) | RF-702 |
| Placa de fundo | só durante a máscara; invalidada no repasse | RF-702 |
| Resolução | `displayWidth`/`displayHeight` | RF-704 |
| Orçamento | 8 ms, EMA α 0,1, 10 amostras, espera 5→60 s | RF-703, C-701 |
| Medição do tempo | do início da composição até criar o `VideoFrame` (sem o `await writer.write`) | RF-703 |
| Log | `[CursorMask]` no renderer | RNF-703 |
| Tela cheia | sem mudança de código | RF-705, C-702 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Canvas sem aceleração por GPU no worker | FPS cai durante a máscara | proteção de FPS (RF-703); conferência em `chrome://gpu` na medição |
| Alternar repasse/composição reconfigurar o encoder | engasgo e keyframe a cada alternância | mesma resolução (RF-704); `keyFramesDecoded` na medição |
| Cursor pisca 1–2 quadros na transição | cursor visível por instantes | atraso do IPC já existia antes do `29c54d0`; margem por velocidade do `toNormalizedCursorRect` |
| Placa de fundo velha colada fora de contexto | artefato visual na área do cursor | placa invalidada a cada saída da máscara; preenchimento pelo entorno até a placa ser refeita |
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
  `OffscreenCanvas`, `VideoFrame`, `@mlab/types` (`CursorState`, `AnnotationOverlayState`), `vitest`.

### Non-Goals

- ocultar o cursor na tela cheia;
- novo algoritmo de preenchimento da área do cursor;
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
