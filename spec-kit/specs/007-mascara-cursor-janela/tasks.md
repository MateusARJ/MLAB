# Tasks: Ocultação do Cursor na Transmissão de Janela Específica

Feature: `007-mascara-cursor-janela`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: READY-FOR-IMPLEMENTATION

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
[ ] T707
Depends On: T703
Allowed Paths: `apps/desktop/src/renderer/media/cursorMaskPolicy.ts`, `apps/desktop/src/renderer/media/cursorMaskPolicy.test.ts`, `apps/desktop/src/renderer/media/cursorMask.worker.ts`
Prohibited Paths: `apps/desktop/src/main/**`, `apps/desktop/src/shared/**`, `apps/desktop/src/renderer/hooks/**`, `apps/backend/**`, `apps/web/**`, `packages/**`
Checks:
- [ ] `CursorTrail` com `maskRect`/`anyRect` dos últimos 150 ms; testes de rastro, expiração e transição oculto → visível (RF-701).
- [ ] `decideFramePath` recebe `maskRect`; testes atualizados.
- [ ] Placa no repasse a cada 250 ms, preservando o rastro, com custo na proteção de FPS (RF-702, RF-703).
- [ ] Placa usada com o cursor parado; borrão só sem pixel limpo (RF-706).
- [ ] Teste manual do professor: sem cursor no movimento rápido e sem quadrado borrado parado.

### T705 — Medição A/B e smoke A12 (manual)
[ ] T705
Depends On: T703, T704, T707
Allowed Paths: `docs/metrics/cursor-mask-2026-11.md`, `spec-kit/specs/007-mascara-cursor-janela/**`
Prohibited Paths: `apps/**`, `packages/**`
Checks:
- [ ] App empacotado, janela específica em 1080p; linha de base na `development` sem a feature.
- [ ] Aluno no Chrome (`chrome://webrtc-internals`): `framesPerSecond`, `frameWidth`/`frameHeight`,
  `keyFramesDecoded`, `freezeCount` nos cenários cursor visível, cursor oculto e anotação ativa (RNF-701).
- [ ] `chrome://gpu` do app registrado; log `[CursorMask]` conferido.
- [ ] Smoke A12 OK.

### T706 — Converge
[ ] T706
Depends On: T701, T702, T703, T704, T705, T707
Allowed Paths: `spec-kit/specs/007-mascara-cursor-janela/**`
Prohibited Paths: `apps/**`, `packages/**`
Checks:
- [ ] `converge.md` da 007 com o resultado da medição e o trabalho restante (opção B da tela cheia).
