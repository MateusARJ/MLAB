# Plan: Conexão Recusada em Sala Encerrada pelo Hub

Feature: `037-registro-em-hub-encerrado`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-3701 a C-3704)

## 1. Summary

```text
serveWS: JWT → store (404/410) → hubForConnection(roomID)
            ├─ hub existente closed           → 410, sem criar
            ├─ hub existente vivo              → usa
            └─ sem hub: store (sob h.mu) aberta → cria; senão 410
         → upgrade → register
hub.run(): onRegister com status closed → room-closed + close(); nada muda no hub
```

1. `signaling/hub.go`: guarda no início do `onRegister`.
2. `signaling/handler.go`: `getOrCreateHub` devolve `(hub, ok)`; marcador e nova consulta ao store; `serveWS` chama
   antes do upgrade.
3. Testes no pacote `signaling`.
4. Nota no `001/contracts/signaling.md`.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Recusa no hub | `room-closed` + `c.close()`, igual a quem estava na sala | C-3701 |
| Recusa no handshake | `http.Error(w, "sala encerrada", 410)`, igual ao store `closed` | C-3701 |
| Hub encerrado | fica no mapa como marcador; não é recriado | C-3702 |
| Consulta ao store na criação | `roomStore.GetRoomByID` sob `h.mu`, só quando cria | RF-3703 |
| Store nil | sem consulta (testes e modo stub sem store) | — |
| Ordem de locks | `Handler.mu` → store; store não chama o handler; join chama `HasConnectedStudent` fora do lock do store | RNF-3701 |
| Versão | PATCH via `npm run bump -- patch` | C-3704 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Deadlock `Handler.mu` ↔ store | handshake trava | store nunca chama o handler; `closeRoom` e `CloseRoomFromSession` soltam o lock do store antes de chamar o handler |
| Hub vazio se o upgrade falhar | hub em `waiting` sem clientes | igual a hub cujos participantes saíram; reaproveitado na próxima conexão |
| Marcadores acumulam no mapa | memória por sala encerrada | já acontecia até a próxima conexão; limpeza é non-goal |
| Teste da 036 contradiz a regra nova | teste falha | ajustado na T3703 (C-3702) |

## Scope Lock

### IN

- guarda do `onRegister`; `getOrCreateHub` e `serveWS`;
- testes do pacote `signaling`;
- nota no contrato `signaling.md`;
- incremento PATCH.

### OUT

- desktop e web;
- código de fechamento novo;
- encerrar a goroutine `run()` de hubs encerrados;
- persistência.

### Allowed Paths

- `apps/backend/internal/signaling/hub.go`, `apps/backend/internal/signaling/handler.go`,
  `apps/backend/internal/signaling/hub_status_test.go`, `apps/backend/internal/signaling/hub_closed_test.go`
- `spec-kit/specs/001-screen-share-core/contracts/signaling.md`
- `spec-kit/specs/037-registro-em-hub-encerrado/**`
- só na T3706, via `npm run bump`: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`

### Prohibited Paths

- `apps/backend/internal/signaling/message.go`, `apps/backend/internal/signaling/client.go`,
  `apps/backend/internal/room/**`, `apps/backend/internal/webrtc/**`, `apps/backend/cmd/**`
- `apps/web/**`, `apps/desktop/**`, `packages/**/src/**`
- `spec-kit/specs/001-screen-share-core/spec.md`, `spec-kit/docs/adrs/**`, `.github/**`

### Dependencies

- Nenhuma nova. Go stdlib (`net/http/httptest`, `sync`, `testing`) e `gorilla/websocket`, já usados.

### Non-Goals

- tratar `session-state`/`room-closed` no desktop;
- remover hubs encerrados do mapa;
- `4004` no backend.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: a recusa é decidida no servidor.
- [x] Princípio III: SFU intocada; sem P2P nem reencode.
- [x] Princípio IV: nenhuma meta de desempenho declarada.
- [x] Princípio V: contrato só ganha nota de comportamento já existente (T3701).
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: uma guarda, uma assinatura nova, testes.
- [ ] Princípio VIII: converge ao final (T3705).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-15 | `410` no handshake e `room-closed` após o upgrade | C-3701 |
| 2026-11-15 | Hub encerrado é marcador; substitui a US-3601 | C-3702 |
| 2026-11-15 | Desktop fora do escopo | C-3703 |
| 2026-11-15 | Uma feature, um PR, IDs `370x`, PATCH | C-3704 |
