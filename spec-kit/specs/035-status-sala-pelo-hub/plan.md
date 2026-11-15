# Plan: Status da Sala Acompanha a Sessão do Hub

Feature: `035-status-sala-pelo-hub`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-3501 a C-3504)

## 1. Summary

```text
hub (goroutine run): onRegister / onPublishRequest / onStreamStarted ──► setStatus(publishing)
                     onUnregister (publisher)                        ──► setStatus(reconnecting)
   setStatus: atribui; se mudou e não é closed ──► onStatusChanged(roomID, status)
signaling.Handler.notifyRoomStatus ──► listener (main.go)
   ──► room.Handler.SyncStatusFromSession(roomID, status)
         ──► store.SetSessionStatus: sala ausente/closed → erro, nada muda; senão só troca Status
closed: inalterado (onClosed → CloseRoomFromSession, 033)
```

1. `room/model.go`: `StatusReconnecting`.
2. `room/store.go`: `SetSessionStatus` na interface `Store`; `GetActiveRoom` aceita `reconnecting`; rank
   `publishing=3 > reconnecting=2 > waiting=1`.
3. `room/handler.go`: `SyncStatusFromSession(roomID, status)`.
4. `signaling/hub.go`: `setStatus` + callback `onStatusChanged`; `signaling/handler.go`: `SetRoomStatusListener`.
5. `cmd/server/main.go`: liga o listener a `SyncStatusFromSession`.
6. `packages/types`: `RoomStatus` com `'reconnecting'`.
7. Contrato, espelho `RF018` e `converge.md`.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Onde propagar | callback do hub, como o `onClosed` da 033 | C-3501 |
| Gravação no store | método novo `SetSessionStatus` com guarda; `UpdateRoomStatus` fica para o `closed` | RNF-3501 |
| Erros da gravação | `ErrRoomNotFound`/`ErrRoomClosed` ignorados; outros vão ao log | RNF-3501 |
| Ordem do `/rooms/active` | `publishing > reconnecting > waiting`, desempate pela mais recente | C-3502 |
| Assinatura de `newHub` | trocar o variádico `onClosed ...func` por `hubCallbacks{onClosed, onStatusChanged}` opcional; `newHub(id, nil)` dos testes continua compilando | — |
| Contexto | `context.Background()` (goroutine do hub, sem request) | — |
| Tipo do status | o listener converte `signaling.SessionStatus` em `room.Status` (mesmos valores) no `main.go` | — |
| Versão | PATCH via `npm run bump -- patch` | C-3504 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Aviso tardio reabre sala encerrada | link antigo volta a funcionar | `SetSessionStatus` não altera sala `closed`/ausente (RNF-3501) e não mexe em índices |
| Deadlock hub ↔ store | hub trava | o callback só toma o lock do store; o store não chama o hub (RNF-3502) |
| Data race no estado do hub | falha no `-race` | `setStatus` só roda na goroutine do hub; o callback recebe valores, não ponteiros |
| `switch` exaustivo em TS sobre `RoomStatus` | typecheck quebra | grep mostrou que nenhum front lê o status REST; typecheck no T3505 |

## Scope Lock

### IN

- propagação do status da sessão do hub ao store;
- status `reconnecting` no modelo e na seleção da sala ativa;
- testes Go dos pacotes `room` e `signaling`;
- contrato `room-api.md` (`join`, `/rooms/active`) e `RoomStatus` em `packages/types`;
- espelho `RF018`, evidências nos `converge.md` da 001 e da 002;
- incremento PATCH.

### OUT

- mudar o momento em que o hub entra em `publishing`;
- protocolo WebSocket (`message.go`), SFU, web e desktop;
- persistência.

### Allowed Paths

- `apps/backend/internal/room/model.go`, `apps/backend/internal/room/store.go`, `apps/backend/internal/room/handler.go`,
  `apps/backend/internal/room/room_test.go`
- `apps/backend/internal/signaling/hub.go`, `apps/backend/internal/signaling/handler.go`,
  `apps/backend/internal/signaling/hub_status_test.go`
- `apps/backend/cmd/server/main.go`
- `packages/types/src/index.ts`
- `spec-kit/specs/001-screen-share-core/contracts/room-api.md`, `spec-kit/specs/001-screen-share-core/converge.md`,
  `spec-kit/specs/002-security-hardening/converge.md`
- `docs/requirements/functionals/RF018-gestao-de-reconexao-do-professor-timeout-30s.md`
- `spec-kit/specs/035-status-sala-pelo-hub/**`
- só na T3507, via `npm run bump`: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`

### Prohibited Paths

- `apps/backend/internal/signaling/message.go`, `apps/backend/internal/webrtc/**`
- `apps/web/**`, `apps/desktop/**`, `packages/ui/**`
- `spec-kit/specs/001-screen-share-core/spec.md`, `spec-kit/specs/002-security-hardening/spec.md`,
  `spec-kit/docs/adrs/**`, `.github/**`

### Dependencies

- Nenhuma nova. Go stdlib (`context`, `errors`, `sync`) e `net/http/httptest` já usados.

### Non-Goals

- exibir o status REST na UI;
- corrigir a leitura de `hub.status` fora da goroutine do hub em `getOrCreateHub` (se o `-race` acusar, vira desvio).

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: o status é decidido no servidor, a partir do hub.
- [x] Princípio III: SFU intocada; sem P2P nem reencode.
- [x] Princípio IV: nenhuma meta de desempenho declarada.
- [x] Princípio V: mudança de contrato registrada em `contracts/` (T3501) e em `packages/types` (T3505).
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: um método no store, um no handler, um callback no hub, testes.
- [ ] Princípio VIII: converge ao final (T3506).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-15 | O hub propaga `publishing`/`reconnecting` ao store | C-3501 |
| 2026-11-15 | `/rooms/active`: `publishing > reconnecting > waiting` | C-3502 |
| 2026-11-15 | O store espelha a semântica atual do hub | C-3503 |
| 2026-11-15 | Uma feature, um PR, IDs `350x`, PATCH | C-3504 |
