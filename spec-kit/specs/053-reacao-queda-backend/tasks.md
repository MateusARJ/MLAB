# Tasks: Reação do App à Queda do Backend

Feature: `053-reacao-queda-backend`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: IN PROGRESS

Regras:
- `npm run test --workspace=apps/desktop` e `npm run lint --workspace=apps/desktop` verdes antes de marcar `[x]`;
- um commit atômico por task, com `Ref: T530x`.

### T5301 — Detecção e reinício no BackendManager
[x] T5301
Allowed Paths: `apps/desktop/src/main/backendManager.ts`, `apps/desktop/src/main/backendManager.test.ts`,
`spec-kit/specs/053-reacao-queda-backend/tasks.md`
Prohibited Paths: `apps/desktop/src/renderer/**`, `apps/backend/**`, `apps/web/**`, `packages/**`
Checks:
- [x] Saída sem `stopping` → `down`, `restarting`, `start()` com a mesma config, `up` após `/health` OK (RF-5301,
  RF-5303).
- [x] `/health` armado no 1º OK; 3 falhas seguidas → `forceKill` + `down` (RF-5302, RNF-5302).
- [x] 3 reinícios em 60 s → `failed`; partida falhando → `failed` (RF-5303).
- [x] Nada reinicia depois de `stop()`/`forceKillSync()` (RF-5303, RNF-5305).
- [x] Testes existentes do `BackendManager` verdes.

### T5302 — Canal IPC `backend:status`
[x] T5302
Depends On: T5301
Allowed Paths: `apps/desktop/src/main/main.ts`, `apps/desktop/src/main/preload.ts`, `apps/desktop/src/env.d.ts`,
`apps/desktop/src/test/setup.ts`, `spec-kit/specs/053-reacao-queda-backend/tasks.md`
Prohibited Paths: `apps/desktop/src/renderer/**`, `apps/backend/**`, `apps/web/**`, `packages/**`
Checks:
- [x] `onStatus` do `BackendManager` envia `backend:status` à janela principal e registra no log (RF-5304).
- [x] `onBackendStatus(cb)` no preload, com função de remoção; tipo no `ElectronAPI` (contrato).
- [x] Nenhum token ou chave no log (RNF-5303).

### T5303 — Retomada no renderer
[x] T5303
Depends On: T5302
Allowed Paths: `apps/desktop/src/renderer/hooks/useBackendRecovery.ts`,
`apps/desktop/src/renderer/hooks/useBackendRecovery.test.ts`, `apps/desktop/src/renderer/App.tsx`,
`apps/desktop/src/renderer/pages/Dashboard.tsx`, `spec-kit/specs/053-reacao-queda-backend/tasks.md`
Prohibited Paths: `apps/desktop/src/renderer/services/**`, `apps/desktop/src/renderer/hooks/useWebRTCPublisher.ts`,
`apps/desktop/src/main/**`, `apps/backend/**`, `apps/web/**`, `packages/**`
Checks:
- [x] `up` após `down`: renova a sessão com o nome guardado; em sala, recria a sala com o mesmo título e chama
  `onRoomRecreated` (RF-5305).
- [x] No dashboard: só renova a sessão (US-5303).
- [x] `failed` ou erro na renovação ou na recriação → `failed`; sucesso → `recovered` por 10 s (RF-5307).
- [x] `App` atualiza a sala e o `setActiveRoom`; `Dashboard` passa o `title`.

### T5304 — Aviso e republicação na sala
[ ] T5304
Depends On: T5303
Allowed Paths: `apps/desktop/src/renderer/pages/Room.tsx`, `apps/desktop/src/renderer/pages/Room.test.tsx`,
`apps/desktop/src/renderer/App.tsx`,
`spec-kit/specs/053-reacao-queda-backend/tasks.md`
Prohibited Paths: `apps/desktop/src/renderer/services/**`, `apps/desktop/src/renderer/hooks/useWebRTCPublisher.ts`,
`apps/desktop/src/main/**`, `apps/backend/**`, `apps/web/**`, `packages/**`
Checks:
- [ ] Aviso fixo com os textos da RF-5307.
- [ ] `room.id` mudou com a sessão ao vivo e `stream` → `startPublishing(stream)` (RF-5306).
- [ ] Testes existentes do `Room` verdes.

### T5305 — Converge
[ ] T5305
Depends On: T5304
Allowed Paths: `spec-kit/specs/053-reacao-queda-backend/**`
Prohibited Paths: `apps/**`, `packages/**`, `.github/**`, `spec-kit/docs/adrs/**`
Checks:
- [ ] `converge.md` com evidências, desvios e impacto de versão (MINOR, C-5304).
- [ ] `npm run spec:check -- spec-kit/specs/053-reacao-queda-backend` com PASS.

### T5306 — Versão
[ ] T5306
Depends On: T5305
Allowed Paths: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`,
`spec-kit/specs/053-reacao-queda-backend/tasks.md`
Prohibited Paths: `apps/**/src/**`, `packages/**/src/**`, `.github/**`
Checks:
- [ ] `npm run bump -- minor` e `npm run version:check`; commit `chore(release): versao X.Y.0`.
