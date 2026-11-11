# Tasks: Mãos Levantadas na Barra de Marcação

Feature: `017-maos-na-barra-marcacao`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados; contrato `003/contracts/desktop-ipc.md` atualizado
Status: READY

Regras:
- task de desktop: `npm test` em `apps/desktop` verde antes do `[x]` (linha de base: 18 arquivos, 151 testes);
- `npm run lint` (`tsc --noEmit`) do desktop já falha na `development` (#51, 14 erros): o gate é **nenhum erro
  novo** nos arquivos tocados pela task;
- um commit atômico por task, com `Ref: T17x` e `Refs #45`.

### T171 — Canal IPC da quantidade de mãos levantadas
[x] T171
Allowed Paths: `apps/desktop/src/main/annotationOverlayWindow.ts`,
`apps/desktop/src/main/annotationOverlayWindow.test.ts`, `apps/desktop/src/main/main.ts` (só o handler novo),
`apps/desktop/src/main/preload.ts` (só as duas funções novas), `apps/desktop/src/test/setup.ts`
Prohibited Paths: `apps/desktop/src/renderer/**`, `apps/desktop/src/main/toolbarHitTest.ts`,
`apps/desktop/src/main/x11InputShape.ts`, `packages/**`, `apps/backend/**`, `apps/web/**`
Checks:
- [x] `setRaisedHands(sender, value)` envia `annotation-overlay:raised-hands` ao overlay quando o valor muda, e não
  reenvia o mesmo valor (RF-176, RNF-171).
- [x] Descarta valor vindo do webContents do overlay e valores inválidos (`-1`, `1.5`, `'3'`, `NaN`, `null`),
  mantendo o último válido (RNF-172).
- [x] Valor recebido antes do `start()` é entregue quando o overlay carrega; o overlay recriado recebe o último valor
  no `ready-to-show`/`did-finish-load` (spec §7).
- [x] `stop()` volta a contagem para 0.
- [x] `main.ts` registra o handler; `preload.ts` expõe `setAnnotationRaisedHands` e `onAnnotationRaisedHands` (com
  cancelamento) conforme `desktop-ipc.md`; `setup.ts` mocka as duas.
- [x] `npm test` verde (18 arquivos, 155 testes; 4 novos); `tsc` com os mesmos 14 erros da #51, nenhum novo em
  `main/` (o de `main.ts:9`, `systemPreferences`, já existia).

### T172 — Janela do MLab envia a quantidade
[ ] T172
Depends On: T171
Allowed Paths: `apps/desktop/src/renderer/pages/Room.tsx`, `apps/desktop/src/renderer/pages/Room.test.tsx`
Prohibited Paths: `apps/desktop/src/renderer/hooks/useWebRTCPublisher.ts`, `apps/desktop/src/renderer/media/**`,
`apps/desktop/src/renderer/components/**`, `apps/desktop/src/main/**`, `packages/**`, `apps/backend/**`,
`apps/web/**`
Checks:
- [ ] Em sessão ao vivo, `setAnnotationRaisedHands` é chamado com a mesma quantidade da fila "Mãos Levantadas":
  levantar, abaixar e saída do aluno (via `participants-update`) mudam o valor (RF-176).
- [ ] Só um número é enviado; nenhum nome, matrícula ou `participant_id` (RF-179).
- [ ] Fora de sessão ao vivo, nada é enviado; o fluxo de `syncAnnotationState` não muda (RNF-171).
- [ ] Badges e fila dentro do MLab continuam iguais; testes existentes do `Room` verdes (RF-180).
- [ ] `npm test` verde; nenhum erro novo de `tsc` em `Room.tsx`.

### T173 — Indicador e borda de destaque na barra
[ ] T173
Depends On: T171
Allowed Paths: `apps/desktop/src/renderer/components/FloatingAnnotationOverlay.tsx`,
`apps/desktop/src/renderer/components/FloatingAnnotationOverlay.test.tsx`
Prohibited Paths: `apps/desktop/src/renderer/pages/**`, `apps/desktop/src/renderer/media/**`,
`apps/desktop/src/main/**`, `packages/**`, `apps/backend/**`, `apps/web/**`
Checks:
- [ ] 0 mãos: sem indicador, sem badge, borda `#38bdf8` igual à atual (RF-175).
- [ ] 1 e 9 mãos: indicador com badge `1`/`9`; 10 e 23 mãos: badge `9+` (RF-171, RF-173).
- [ ] `title` e `aria-label` "Mãos levantadas: N" com N real (ex.: 23); nenhum outro texto visível sobre mãos na
  barra (RF-174).
- [ ] Barra expandida (horizontal e vertical) e recolhida: indicador dentro de `toolbarRef` e borda `#facc15` com
  anel; sem `animation` (RF-171, RF-172).
- [ ] O indicador segue a visibilidade da barra: oculto com o MLab em foco e, ao a barra reaparecer, mostra a
  quantidade atual (RF-178, spec §7).
- [ ] Clique no indicador não troca ferramenta, não recolhe/expande e não chama `syncAnnotationState` (RF-177).
- [ ] Quando o indicador aparece, `setAnnotationToolbarRect` é chamado de novo (RNF-173).
- [ ] Valor inválido recebido é ignorado (RNF-172).
- [ ] `npm test` verde; nenhum erro novo de `tsc` em `FloatingAnnotationOverlay.tsx`.

### T174 — Nota na 003 e item de smoke A15b
[ ] T174
Depends On: T172, T173
Allowed Paths: `spec-kit/specs/003-classroom-interaction/spec.md`, `docs/metrics/smoke-runbook.md`,
`scripts/smoke-report.js`
Prohibited Paths: `apps/**`, `packages/**`, `spec-kit/specs/003-classroom-interaction/contracts/**`
Checks:
- [ ] US-11 e US-19 da 003 ganham nota "fora do MLab, a barra de marcação mostra a quantidade de mãos levantadas
  (017)"; nada é reescrito.
- [ ] Roteiro `A15b` no runbook: professor na janela transmitida e depois na tela cheia; aluno no celular levanta e
  abaixa; barra recolhida; 10+ mãos se houver alunos suficientes (ou registrar o limite); registrar se o indicador
  aparece no vídeo em tela cheia e não aparece em janela específica (RN-171).
- [ ] `scripts/smoke-report.js` lista `A15b` como `manual`.

### T175 — Smoke, converge e versão
[ ] T175
Depends On: T174
Allowed Paths: `spec-kit/specs/017-maos-na-barra-marcacao/**`, `package.json`, `package-lock.json`,
`apps/*/package.json`, `packages/*/package.json` (só pelo `npm run bump`)
Prohibited Paths: `apps/**/src/**`, `packages/**/src/**`
Checks:
- [ ] Smoke `A15b` executado no Windows, com evidência em `017/evidencias/`; no Linux, regressão da barra (009) com
  o indicador presente, ou o motivo de não ter sido feito.
- [ ] `converge.md` compara código × spec/plan/tasks e registra gaps, desvios (#62) e o nível de versão.
- [ ] `npm run bump -- minor` e `npm run version:check` (C-179); commit `chore(release): versao X.Y.Z`.
- [ ] `npm run spec:check -- spec-kit/specs/017-maos-na-barra-marcacao` verde.
