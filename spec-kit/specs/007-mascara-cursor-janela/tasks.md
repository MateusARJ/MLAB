# Tasks: Ocultação do Cursor na Transmissão de Janela Específica

Feature: `007-mascara-cursor-janela`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: DONE

Regra de cada task de código: `npx turbo run build test --force` verde antes do `[x]`.

### T701 — Política de caminho do quadro (refatoração sem mudança de comportamento)
[x] T701
Allowed Paths: `apps/desktop/src/renderer/media/cursorMaskPolicy.ts`, `apps/desktop/src/renderer/media/cursorMaskPolicy.test.ts`, `apps/desktop/src/renderer/media/cursorMask.worker.ts`
Prohibited Paths: `apps/desktop/src/main/**`, `apps/desktop/src/shared/**`, `apps/desktop/src/renderer/hooks/**`, `apps/backend/**`, `apps/web/**`, `packages/**`
Checks:
- [x] `decideFramePath` devolve `{ compose, maskCursor, drawAnnotations }` (RF-701, RF-702).
- [x] Testes: cursor visível sem anotação → sem composição; `rect: null` → sem composição; oculto com `rect` →
  `maskCursor`; suspensa → sem `maskCursor`; anotações seguem a regra atual (tela cheia nativa vs. worker).
- [x] O worker usa só `drawAnnotations`/`compose` sem `maskCursor` nesta task (comportamento idêntico ao atual).

### T702 — Máscara do cursor no worker e resolução de exibição
[x] T702
Depends On: T701
Allowed Paths: `apps/desktop/src/renderer/media/cursorMask.worker.ts`
Prohibited Paths: `apps/desktop/src/main/**`, `apps/desktop/src/shared/**`, `apps/desktop/src/renderer/hooks/**`, `apps/backend/**`, `apps/web/**`, `packages/**`
Checks:
- [x] Com `maskCursor`, a área do cursor é preenchida pela placa de fundo ou pelo entorno (algoritmo anterior ao
  `29c54d0`), antes das anotações (RF-701).
- [x] Placa atualizada só durante a máscara e invalidada no repasse (RF-702).
- [x] Canvas e quadro composto em `displayWidth` × `displayHeight` (RF-704).
- [x] Repasse sem cópia intacto quando `compose` é `false` (RF-702).

### T703 — Proteção de FPS e log das mensagens do worker
[x] T703
Depends On: T702
Allowed Paths: `apps/desktop/src/renderer/media/cursorMaskPolicy.ts`, `apps/desktop/src/renderer/media/cursorMaskPolicy.test.ts`, `apps/desktop/src/renderer/media/cursorMask.worker.ts`, `apps/desktop/src/renderer/media/createCursorMaskedTrack.ts`, `apps/desktop/src/renderer/media/createCursorMaskedTrack.test.ts`
Prohibited Paths: `apps/desktop/src/main/**`, `apps/desktop/src/shared/**`, `apps/desktop/src/renderer/hooks/**`, `apps/backend/**`, `apps/web/**`, `packages/**`
Checks:
- [x] `FrameBudgetGuard`: suspende com média > 8 ms após 10 amostras; retoma após 5 s, 10 s, 20 s, 40 s, 60 s
  (máximo); testes com relógio injetado (RF-703).
- [x] Worker mede só os quadros com máscara e envia `mask-suspended`/`mask-resumed`; anotações não são suspensas.
- [x] `createCursorMaskedTrack.ts` registra `mask-suspended`, `mask-resumed` e `fatal` com `[CursorMask]`; doc do
  módulo atualizada (RNF-703); teste cobre o registro.

### T704 — Emenda da 003 (tela cheia) e roteiro do A12
[x] T704
Allowed Paths: `spec-kit/specs/003-classroom-interaction/spec.md`, `spec-kit/specs/003-classroom-interaction/tasks.md`, `docs/metrics/smoke-runbook.md`
Prohibited Paths: `apps/**`, `packages/**`, `spec-kit/specs/003-classroom-interaction/contracts/**`
Checks:
- [x] US-20 / RF-310: tela cheia sem ocultação do cursor sobre o MLab, com referência a C-702 (RF-705).
- [x] T310 da 003 com nota apontando a regressão do `29c54d0` e a correção na 007.
- [x] A12 do runbook com o passo "outra janela cobrindo a janela transmitida sob o ponteiro".

### T707 — Rastro do cursor e preenchimento sem borrão (C-703)
[x] T707
Depends On: T703
Allowed Paths: `apps/desktop/src/renderer/media/cursorMaskPolicy.ts`, `apps/desktop/src/renderer/media/cursorMaskPolicy.test.ts`, `apps/desktop/src/renderer/media/cursorMask.worker.ts`
Prohibited Paths: `apps/desktop/src/main/**`, `apps/desktop/src/shared/**`, `apps/desktop/src/renderer/hooks/**`, `apps/backend/**`, `apps/web/**`, `packages/**`
Checks:
- [x] `CursorTrail` com `maskRect`/`anyRect` dos últimos 150 ms; testes de rastro, expiração e transição oculto → visível (RF-701).
- [x] `decideFramePath` recebe `maskRect`; testes atualizados.
- [x] Placa no repasse a cada 250 ms, preservando o rastro, com custo na proteção de FPS (RF-702, RF-703).
- [x] Placa usada com o cursor parado; borrão só sem pixel limpo (RF-706).
- [x] Teste manual do professor: sem cursor no movimento rápido e sem quadrado borrado parado — confirmado pelo
  responsável em 2026-11-03 (com a T709).

### T708 — Máscara composta em memória e proteção de FPS com a entrega ao gerador
[x] T708
Depends On: T707
Allowed Paths: `apps/desktop/src/renderer/media/cursorMaskFrame.ts`, `apps/desktop/src/renderer/media/cursorMaskFrame.test.ts`, `apps/desktop/src/renderer/media/cursorMask.worker.ts`
Prohibited Paths: `apps/desktop/src/main/**`, `apps/desktop/src/shared/**`, `apps/desktop/src/renderer/hooks/**`, `apps/backend/**`, `apps/web/**`, `packages/**`
Checks:
- [x] `cursorMaskFrame.ts`: planos por formato (`I420`, `I420A`, `I422`, `I444`, `NV12`, `RGBA`, `RGBX`, `BGRA`, `BGRX`;
  outros → `null`), cópia de retângulo, cópia preservando retângulo e preenchimento pelo entorno; testes com buffers
  `I420`, `NV12` e `RGBA`, incluindo bordas e dimensões ímpares (RF-701, RF-706).
- [x] Worker: com formato mapeável, a máscara é feita em memória e o quadro sai no mesmo formato e resolução de
  exibição do capturado (RF-701, RF-704); placa em buffer com as mesmas regras de 90/250 ms, rastro e região suja
  (RF-702, RF-706); formato não mapeável segue o canvas.
- [x] Com anotações no worker, o quadro mascarado em memória é a base do canvas das anotações (revisão de código; não exercitado no harness).
- [x] Proteção de FPS mede composição + `await writer.write` dos quadros com máscara (RF-703).
- [x] Harness de captura (janela real, loopback WebRTC): com a máscara ativa, a espera do `writer.write` cai em
  relação à versão em canvas e o FPS acompanha a captura (2026-11-02, I420 1376×782 a ~55 fps: espera de 300–680 para 3–5 ms por segundo; cursor ausente no quadro recebido).
- [x] Teste manual do professor: sem engasgo com a máscara ativa (MLab ou outra janela em foco) — confirmado pelo
  responsável em 2026-11-03.

### T709 — Cursor mostrado sobre conteúdo em movimento (C-704)
[x] T709
Depends On: T708
Allowed Paths: `apps/desktop/src/renderer/media/cursorMaskFrame.ts`, `apps/desktop/src/renderer/media/cursorMaskFrame.test.ts`, `apps/desktop/src/renderer/media/cursorMask.worker.ts`
Prohibited Paths: `apps/desktop/src/main/**`, `apps/desktop/src/shared/**`, `apps/desktop/src/renderer/hooks/**`, `apps/backend/**`, `apps/web/**`, `packages/**`
Checks:
- [x] `ringChangeRatio`: anel em volta do retângulo, recortado nas bordas, sem o retângulo; tolerância por amostra;
  testes com `I420` e `RGBA`, anel parado (0), anel mudando, mudança só dentro do retângulo (0), retângulo na
  borda e anel vazio (RF-707).
- [x] Worker: fração acima de 3% mostra o cursor até 500 ms após a última mudança; placa mantida; com anotações, só
  as anotações são desenhadas; custo na proteção de FPS (RF-703, RF-707).
- [x] Harness com janela animada: sem quadrado acompanhando o cursor; com janela parada, cursor continua oculto
  (2026-11-03, I420 1366×776: janela animada com o cursor mostrado em quase todos os quadros e sem quadrado no
  quadro recebido; Bloco de Notas com texto, máscara em 100% dos quadros, sem detecção falsa).
- [x] Teste manual do professor: sobre vídeo o cursor aparece sem quadrado; sobre conteúdo parado continua oculto —
  confirmado pelo responsável em 2026-11-03.

### T710 — Lupa no modo janela segue a regra do cursor (C-705, issue #70)
[x] T710
Depends On: T709
Allowed Paths: `apps/desktop/src/renderer/media/cursorMaskPolicy.ts`, `apps/desktop/src/renderer/media/cursorMaskPolicy.test.ts`, `apps/desktop/src/renderer/media/cursorMask.worker.ts`, `spec-kit/specs/003-classroom-interaction/spec.md`, `docs/metrics/smoke-runbook.md`
Prohibited Paths: `apps/desktop/src/main/**`, `apps/desktop/src/shared/**`, `apps/desktop/src/renderer/hooks/**`, `apps/desktop/src/renderer/pages/**`, `apps/desktop/src/renderer/components/**`, `apps/backend/**`, `apps/web/**`, `packages/**`
Checks:
- [x] `shouldDrawSpotlight`: no modo janela, lupa só com `visible && rect` ou `activeInViewer`; tela cheia sem
  mudança; testes de foco fora, ponteiro fora da fonte, cursor visível, visualizador e lupa desligada (RF-708).
- [x] `decideFramePath` recebe o `CursorState` e devolve `drawSpotlight`; lupa escondida sem traços → repasse
  (`compose: false`); com traços, só os traços; testes existentes atualizados.
- [x] Worker desenha a lupa só com `path.drawSpotlight`; traços inalterados (`2a2e1dc`; `turbo run build test lint
  --force` verde em 2026-11-11, desktop com 244 testes).
- [x] US-19 da 003 com nota apontando a 007 (C-705); A12 do runbook com o passo da lupa com outra janela em foco.
- [x] Teste manual do professor: com outra janela em foco e a lupa ligada, o aluno não vê a lupa; de volta à janela
  transmitida, a lupa aparece e acompanha o ponteiro — confirmado pelo responsável em 2026-11-11.

### T705 — Medição A/B e smoke A12 (manual)
[x] T705
Depends On: T703, T704, T707, T708, T709, T710
Allowed Paths: `docs/metrics/cursor-mask-2026-11.md`, `spec-kit/specs/007-mascara-cursor-janela/**`
Prohibited Paths: `apps/**`, `packages/**`
Concluída com ressalvas aceitas pelo responsável em 2026-11-12 (`docs/metrics/cursor-mask-2026-11.md`, seções 3–5).
Checks:
- [x] App empacotado — com ressalva: janela em 1366×768, não 1080p; linha de base só na rodada 1 (aluno no mesmo
  notebook), não na rodada 2.
- [x] Aluno no Chrome (`chrome://webrtc-internals`, Android, rodada 2): `framesPerSecond` (média 43,3, mediana 46,
  nenhum segundo abaixo de 20), resolução constante, keyframes só a cada 10 s, 2 travamentos em 48 s, nos cenários
  V, O, T e A feitos na mesma sessão (RNF-701).
- [ ] `chrome://gpu` do app registrado; log `[CursorMask]` conferido — não feito; ressalva aceita pelo responsável e
  levada ao `converge.md`.
- [x] Smoke A12 OK, com cursor oculto sem mancha (responsável, 2026-11-12).

### T706 — Converge
[x] T706
Depends On: T701, T702, T703, T704, T705, T707, T708, T709, T710
Allowed Paths: `spec-kit/specs/007-mascara-cursor-janela/**`
Prohibited Paths: `apps/**`, `packages/**`
Checks:
- [x] `converge.md` da 007 com o resultado da medição e o trabalho restante (opção B da tela cheia).
- [x] Impacto de versão (`docs/versionamento.md` §2) e desvios registrados (#70 resolvido pela T710).
