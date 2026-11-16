# Plan: Encerramento da Sala pelo Hub Reflete no Store

Feature: `033-encerramento-sala-pelo-hub`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-3301 a C-3305)

## 1. Summary

```text
hub: timeout 30 s / end-session ──► onPublisherTimeout / onRoomClose ──► onClosed(roomID)
   antes: onClosed = room.Handler.ReleaseRoomFiles            (só arquivos; sala segue no store)
   agora: onClosed = room.Handler.CloseRoomFromSession
            sala aberta no store ──► UpdateRoomStatus(closed) → DeleteRoom → StopMDNSServer
            sempre                ──► ReleaseRoomFiles
REST close (sem mudança): marca/remove a sala antes de avisar o hub ──► listener encontra a sala removida
```

1. `room/handler.go`: método `CloseRoomFromSession(roomID)`, idempotente, na mesma sequência da `closeRoom`.
2. `cmd/server/main.go`: `sigHandler.SetRoomClosedListener(roomHandler.CloseRoomFromSession)`.
3. `room/room_test.go`: `TestCloseRoomFromSession`.
4. `cmd/server/smoke_test.go`: A18 verifica `join`/`/info` depois do timeout; subteste novo para `end-session`.
5. `001/contracts/room-api.md`: `/info` sem `closed` no `200` e com os `404`.
6. Espelho `RF015` e `001/converge.md`.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Onde corrigir | no listener já existente (`onClosed`), sem tocar o hub | C-3301 |
| Estado final | sala `closed` e removida do store, como a REST | C-3302 |
| Status do `join` | `404` (sala removida) | C-3302 |
| mDNS | só para quando o listener encerra a sala | C-3304 |
| Contexto | `context.Background()` (chamado na goroutine do hub, sem request) | — |
| Contrato `/info` | contrato segue o código | C-3303 |
| Teste smoke | `e.join` já devolve o status; sem helper novo | — |
| Versão | PATCH via `npm run bump -- patch` | C-3305 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Aviso atrasado do hub para o mDNS de sala nova | link `.local` some | RNF-3301: para só se a sala estava aberta no store |
| Corrida entre o `SessionClosed` do hub e o `DeleteRoom` | WebSocket chega no intervalo e cria hub novo | janela de microssegundos; depois do listener o `serveWS` responde `404` |
| Smoke A18 leva ~30 s | suíte mais lenta | já era assim; o subteste do `end-session` não espera timeout |

## Scope Lock

### IN

- listener de encerramento pelo hub atualizando o store;
- testes Go (unitário e smoke);
- contrato do `/info`;
- espelho `RF015` e evidências no `001/converge.md`;
- incremento PATCH.

### OUT

- retomada da sala após o timeout;
- gravação de `publishing`/`reconnecting` no store;
- `409` para sala removida;
- hub de sinalização, SFU, store, web, desktop e `packages/**`.

### Allowed Paths

- `apps/backend/internal/room/handler.go`, `apps/backend/internal/room/room_test.go`
- `apps/backend/cmd/server/main.go`, `apps/backend/cmd/server/smoke_test.go`
- `spec-kit/specs/001-screen-share-core/contracts/room-api.md`, `spec-kit/specs/001-screen-share-core/converge.md`
- `docs/requirements/functionals/RF015-encerramento-de-sala-e-conexoes.md`
- `spec-kit/specs/033-encerramento-sala-pelo-hub/**`
- só na T3305, via `npm run bump`: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`

### Prohibited Paths

- `apps/backend/internal/signaling/**`, `apps/backend/internal/webrtc/**`, `apps/backend/internal/room/store.go`
- `apps/web/**`, `apps/desktop/**`, `packages/**` (fora da T3305)
- `spec-kit/specs/001-screen-share-core/spec.md`, `spec-kit/docs/adrs/**`, `.github/**`

### Dependencies

- Nenhuma nova. Go stdlib (`context`, `net/http/httptest`) já usada.

### Non-Goals

- unificar as mensagens de erro de sala encerrada;
- corrigir a leitura de `hub.status` fora da goroutine do hub (se confirmada, vira desvio).

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: recusa decidida no servidor.
- [x] Princípio III: SFU intocada; o hub continua chamando `sfu.RoomClosed`.
- [x] Princípio IV: nenhuma meta de desempenho declarada.
- [x] Princípio V: mudança de contrato registrada em `contracts/` (T3301).
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: um método, uma linha de wiring, testes.
- [ ] Princípio VIII: converge ao final (T3304).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-15 | Timeout encerra de vez (RN-13/RF-18) | C-3301 |
| 2026-11-15 | Sala removida do store; `join` responde `404` | C-3302 |
| 2026-11-15 | Contrato do `/info` segue o código | C-3303 |
| 2026-11-15 | mDNS só para quando o listener encerra a sala | C-3304 |
| 2026-11-15 | Uma feature, um PR, IDs `330x`, PATCH | C-3305 |
