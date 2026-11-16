# Tasks: Fixar uma Janela na Transmissão de Múltiplas Janelas

Feature: `032-fixar-janela-transmissao`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados; PR #93 integrado à `development` (C-3201)
Status: READY

Regras:
- `npm test` e `npm run lint` (`tsc --noEmit`) em `apps/desktop` verdes antes de marcar `[x]`;
- um commit atômico por task, com `Ref: T320x` e `Refs #91`;
- antes da T3203, revalidar este arquivo e o `analyze.md` contra o `Room.tsx` da `development` com o #93.

### T3201 — Main: alvo do cursor preso à janela fixada
[x] T3201
Allowed Paths: `apps/desktop/src/main/cursorPresence.ts`, `apps/desktop/src/main/cursorPresence.test.ts`,
`apps/desktop/src/main/preload.ts`, `spec-kit/specs/003-classroom-interaction/contracts/desktop-ipc.md`
Prohibited Paths: `apps/desktop/src/main/main.ts`, `apps/desktop/src/main/nativeWindowTracker.ts`,
`apps/desktop/src/renderer/**`, `apps/backend/**`, `apps/web/**`, `packages/**`, `package.json`
Checks:
- [x] `CursorTrackingTarget` e o tipo de `startCursorTracking` no preload ganham `pinnedSourceId?: string`
  (RNF-3201).
- [x] `pinnedSourceId` só vale quando está em `allowedSourceIds`; senão é ignorado (RF-3211).
- [x] Com uma janela fixada, `currentTargetWindowId` começa na fixada e não muda quando o foco vai para outra janela
  autorizada; `active-window-changed` continua sendo emitido uma vez por mudança de foco (RF-3203, RF-3208).
- [x] `stopTimerOnly()` limpa a fixação.
- [x] `cursorPresence.test.ts` (novo, `electron` e rastreador nativo simulados): com fixada, o foco em B emite o evento
  e o `CursorState` é calculado sobre a fixada; sem fixada, o alvo segue o foco como hoje; `pinnedSourceId` fora dos
  autorizados é ignorado. O teste da fixada falha no código anterior.
- [x] Linha de `startCursorTracking` em `003/contracts/desktop-ipc.md` passa a "Em vigor desde 032 (T3201)".

### T3202 — Hook: repassar a fixação, reiniciar o rastreamento e avisar o fim da captura
[ ] T3202
Depends On: T3201
Allowed Paths: `apps/desktop/src/renderer/hooks/useScreenCapture.ts`,
`apps/desktop/src/renderer/hooks/useScreenCapture.test.ts`, `apps/desktop/src/test/setup.ts`
Prohibited Paths: `apps/desktop/src/renderer/pages/**`, `apps/desktop/src/renderer/media/**`,
`apps/desktop/src/renderer/hooks/useWebRTCPublisher.ts`, `apps/desktop/src/main/**`, `apps/backend/**`,
`apps/web/**`, `packages/**`, `package.json`
Checks:
- [ ] `selectSource` aceita `pinnedSourceId` opcional e o repassa ao `startCursorTracking`; chamadas atuais não mudam.
- [ ] `restartCursorTracking(source, allowedIds?, pinnedId?)` chama `startCursorTracking` sem `getUserMedia`
  (RF-3202, RF-3204).
- [ ] Listener `ended` na faixa de vídeo bruta expõe ao chamador o `sourceId` cuja captura terminou (RF-3207).
- [ ] Testes: repasse de `pinnedSourceId`; `restartCursorTracking` sem nova captura; `ended` da faixa bruta notifica o
  `sourceId`.

### T3203 — Room: estado e regras de fixação
[ ] T3203
Depends On: T3202
Allowed Paths: `apps/desktop/src/renderer/pages/Room.tsx`, `apps/desktop/src/renderer/pages/Room.test.tsx`
Prohibited Paths: `apps/desktop/src/renderer/hooks/**`, `apps/desktop/src/renderer/media/**`,
`apps/desktop/src/main/**`, `apps/backend/**`, `apps/web/**`, `packages/**`, `package.json`
Checks:
- [ ] Estado `pinnedWindowSourceId` (state + ref) e `lastFocusedAuthorizedIdRef`.
- [ ] Efeito de foco: grava a última janela autorizada focada; com fixação, não troca a fonte (RF-3203); sem fixação,
  igual ao atual (RF-3210).
- [ ] `handlePinWindow`: fixa sem recaptura se a janela já está no ar; senão troca com `pinnedSourceId`, aplicando o
  mudo do microfone como no `handleSwitchScreen`; substitui fixação anterior (RF-3202).
- [ ] `handleUnpinWindow`: troca para a última focada quando difere da janela no ar e continua autorizada; senão só
  reinicia o rastreamento sem fixação (RF-3204).
- [ ] Clique no nome com fixação chama `handlePinWindow` (RF-3209).
- [ ] Fixação limpa em `handleReconfigure`, `handleEndSession` e na saída do ao vivo (RF-3206).
- [ ] Fim da captura da fixada desfixa por `handleUnpinWindow` (RF-3207).
- [ ] Testes em `Room.test.tsx`, partindo do teste de múltiplas janelas existente (callback de
  `onActiveWindowChanged`): foco em B com A fixada não troca; desfixar após foco em B troca para B; desfixar sem foco
  em outra não chama `selectSource`; depois de desfixar o foco volta a trocar; fixar B com A fixada passa para B;
  reconfigurar/encerrar limpa; fim da captura desfixa; `startCursorTracking`/`selectSource` recebem `pinnedSourceId`.

### T3204 — Room: interface da fixação
[ ] T3204
Depends On: T3203
Allowed Paths: `apps/desktop/src/renderer/pages/Room.tsx`, `apps/desktop/src/renderer/pages/Room.test.tsx`
Prohibited Paths: `apps/desktop/src/renderer/hooks/**`, `apps/desktop/src/main/**`, `packages/**`, `apps/backend/**`,
`apps/web/**`, `package.json`
Checks:
- [ ] Botão de alfinete por janela no seletor (`Pin`/`PinFilled`), com `aria-label` "Fixar <nome>"/"Desafixar
  <nome>", `aria-pressed` e acesso por teclado (RF-3201).
- [ ] Selo "Fixada" na fixada e "Em pausa" nas demais; rótulo da prévia "Fixada: <nome>"; sem fixação, textos atuais
  (RF-3205, RF-3210).
- [ ] Estilos com os tokens do design system 2.0 (028).
- [ ] Testes: nomes acessíveis, `aria-pressed`, textos "Fixada"/"Em pausa"/"Fixada: <nome>" e ausência deles sem
  fixação.

### T3205 — Regressão de múltiplas janelas sem fixação
[ ] T3205
Depends On: T3204
Allowed Paths: `apps/desktop/src/renderer/pages/Room.test.tsx`
Prohibited Paths: `apps/desktop/src/renderer/pages/Room.tsx`, `apps/desktop/src/renderer/hooks/**`,
`apps/desktop/src/main/**`, `packages/**`, `apps/backend/**`, `apps/web/**`, `package.json`
Checks:
- [ ] Teste de múltiplas janelas existente passa sem mudar asserções (RF-3210).
- [ ] Teste novo: sem fixação, `selectSource` é chamado sem `pinnedSourceId` em toda troca por foco e pelo seletor.

### T3206 — Verificação, notas, converge e versão
[ ] T3206
Depends On: T3201, T3202, T3203, T3204, T3205
Allowed Paths: `spec-kit/specs/032-fixar-janela-transmissao/**`, `spec-kit/specs/003-classroom-interaction/spec.md`,
`spec-kit/specs/007-mascara-cursor-janela/spec.md`, `package.json`, `package-lock.json`, `apps/*/package.json`,
`packages/*/package.json`
Prohibited Paths: `apps/**/src/**`, `packages/**/src/**`, `apps/backend/**`, `.github/**`, `docs/requirements/**`
Checks:
- [ ] Verificação manual no Windows (duas janelas autorizadas): fixar, foco na outra, desfixar, fechar a fixada,
  reconfigurar, alinhamento do cursor/lupa com a fixada; gravação após troca observada (C-3206) ou impossibilidade
  registrada no `converge.md`.
- [ ] Notas na US-20 da `003/spec.md` e no RF-701/RF-708 da `007/spec.md` apontando o RF-3208.
- [ ] `converge.md` com evidências, desvios registrados e impacto de versão (MINOR, C-3206).
- [ ] `npm run bump -- minor` e `npm run version:check`; commit `chore(release): versao X.Y.Z`.
- [ ] `npm run spec:check -- spec-kit/specs/032-fixar-janela-transmissao` com PASS.
