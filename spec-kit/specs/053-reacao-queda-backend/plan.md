# Plan: Reação do App à Queda do Backend

Feature: `053-reacao-queda-backend`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-5301 a C-5304)
Contrato: `./contracts/ipc-backend-status.md`

## 1. Summary

```text
BackendManager (main)                       main.ts                 renderer
  exit sem pedido ─┐                                                  
  /health 3× falha ─┴─> forceKill ─> onStatus('down') ─> IPC ───> useBackendRecovery (App)
                         start(lastConfig) ─> 'restarting'             down/restarting: aviso
                         /health OK ─> 'up' ───────────> IPC ───> up: startProfessorSession(nome)
                         3 quedas/60 s ─> 'failed'                     em sala: createRoom(título) → setRoom
                                                                     Room: room.id mudou e ao vivo → startPublishing(stream)
```

1. `apps/desktop/src/main/backendManager.ts`:
   - `onStatus?: (s: BackendStatus) => void` no construtor (opcional; testes injetam).
   - Guarda a última `BackendStartConfig`/porta de `start()` para reiniciar.
   - `attach`: no `exit`, se `!this.stopping` e o filho é o atual → `handleCrash('saída inesperada')`.
   - Vigia do `/health`: começa depois do `start()` com `started`; consulta a cada `HEALTH_INTERVAL_MS = 3000` usando
     `deps.fetchHealth` e `deps.sleep`. Arma no primeiro OK; com 3 falhas seguidas → `forceKill(child)` e
     `handleCrash('sem resposta ao /health')`. Para no `stop()`/`forceKillSync()`.
   - `handleCrash`: uma vez por filho; `onStatus('down')`; descarta tentativas com mais de 60 s; com 3 → `failed`.
     Senão `onStatus('restarting')`, `start(lastConfig)`, espera o `/health` OK (até ~10 s) → `up`; falha → `failed`.
     Nada disso roda com `stopping`.
2. `apps/desktop/src/main/main.ts`: cria o `BackendManager` com `onStatus` que envia `backend:status` para a
   `mainWindow` (se existir) e registra no log.
3. `apps/desktop/src/main/preload.ts`: `onBackendStatus(cb)` com `ipcRenderer.on`/`removeListener`; tipo no
   `ElectronAPI`.
4. `apps/desktop/src/renderer/hooks/useBackendRecovery.ts` (novo): escuta `onBackendStatus`; mantém
   `recovery: 'idle' | 'reconnecting' | 'recovered' | 'failed'`; em `up` após `down`: `startProfessorSession(nome
   guardado)` e, com `room`, `createRoom(room.title)` + `getRoomLink` → `onRoomRecreated(novaSala)`; `recovered` some
   em 10 s.
5. `apps/desktop/src/renderer/App.tsx`: guarda `title` junto da sala (vindo do `Dashboard`); usa o hook; em
   `onRoomRecreated` → `setRoom` e `setActiveRoom` com o novo token; passa `recovery` ao `Room`.
6. `apps/desktop/src/renderer/pages/Dashboard.tsx`: inclui `title` no `onEnterRoom`.
7. `apps/desktop/src/renderer/pages/Room.tsx`: prop `recovery`; aviso fixo (RF-5307); efeito em `room.id`: se mudou
   e a sessão está ao vivo com `stream`, chama `startPublishing(stream)`.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Queda | `exit` sem `stopping` | RF-5301 |
| Travamento | `/health` 3 s × 3, armado no 1º OK | C-5302, RF-5302 |
| Limite | 3 reinícios/60 s | C-5303 |
| Retomada | sessão + sala + publicação automáticas | C-5301 |
| Canal | `backend:status` | contrato |
| Versão | MINOR (2.2.x → 2.3.0) | C-5304 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Falso positivo do `/health` com a máquina carregada | aula interrompida à toa | armar no 1º OK; 3 falhas; timeout de 500 ms por consulta |
| Reinício durante o fechamento do app | backend órfão | toda a recuperação checa `stopping` antes e depois de cada espera |
| Loop de quedas | CPU e log | limite de 3 em 60 s → `failed` |
| `startPublishing` com closure antiga do `roomId` | publica na sala velha | efeito depende de `room.id` e de `startPublishing` (recriado com o novo `roomId`) |
| Slug diferente na recriação | link muda | mesmo título e nome; a tela já mostra os links de `useRoomLinks(room)` |

## Scope Lock

### IN

- detecção, reinício e aviso no app desktop; retomada da sala no renderer do professor.

### OUT

- web do aluno; backend Go; recuperação de chat/arquivos/presença; modo dev com backend externo.

### Allowed Paths

- `apps/desktop/src/main/backendManager.ts`, `apps/desktop/src/main/backendManager.test.ts`
- `apps/desktop/src/main/main.ts`, `apps/desktop/src/main/preload.ts`
- `apps/desktop/src/renderer/App.tsx`, `apps/desktop/src/renderer/pages/Dashboard.tsx`,
  `apps/desktop/src/renderer/pages/Room.tsx`, `apps/desktop/src/renderer/pages/Room.test.tsx`
- `apps/desktop/src/renderer/hooks/useBackendRecovery.ts`, `apps/desktop/src/renderer/hooks/useBackendRecovery.test.ts`
- `apps/desktop/src/env.d.ts` (tipo do `electronAPI`, se declarado ali)
- `apps/desktop/src/test/setup.ts` (mock global do `electronAPI` nos testes; precisa do método novo para o `tsc`)
- `spec-kit/specs/053-reacao-queda-backend/**`
- só na T5306, via `npm run bump`: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`

### Prohibited Paths

- `apps/backend/**`, `apps/web/**`, `packages/**/src/**`
- `apps/desktop/src/renderer/hooks/useWebRTCPublisher.ts`, `apps/desktop/src/renderer/services/**`
- `.github/**`, `spec-kit/docs/adrs/**`, `docs/**`

### Dependencies

- Nenhuma nova.

### Non-Goals

- Reconexão automática do aluno.
- Restaurar chat, arquivos, mãos levantadas e presença.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: autorização no servidor sem mudança; a renovação usa a chave de host (ADR 0006).
- [x] Princípio III: SFU intocada; o professor continua com uma upstream.
- [x] Princípio IV: nenhuma meta de desempenho declarada.
- [x] Princípio V: canal IPC novo registrado em `contracts/`.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: sem dependência nova.
- [ ] Princípio VIII: converge ao final (T5305).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-19 | Retomada automática com sala recriada | C-5301 |
| 2026-11-19 | `/health` 3 s × 3 | C-5302 |
| 2026-11-19 | 3 reinícios em 60 s | C-5303 |
| 2026-11-19 | Branch e PR da/para a `main`; IDs `530x`; MINOR | C-5304 |
