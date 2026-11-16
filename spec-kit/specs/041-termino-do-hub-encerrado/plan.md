# Plan: Término da Goroutine do Hub Encerrado

Feature: `041-termino-do-hub-encerrado`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-4101 a C-4103)

## 1. Summary

```text
run(): for { select { evento } ; if isClosed() { release(); close(done); return } }

remetentes                         depois do término
handler     hub.enroll(c)       →  room-closed + close(c), false
readPump    hub.deliver(env)    →  false (readPump retorna)
readPump    hub.leave(c)        →  sem efeito
REST/SFU    Broadcast*          →  descartado
timer       sendSignal(timeout) →  descartado
```

1. `signaling/hub.go`: canal `done`; `run()` termina depois do encerramento; `release()`; `closeSession()` comum a
   `onRoomClose` e `onPublisherTimeout`; `terminated()`, `sendSignal()`, `enroll()`, `deliver()` e `leave()`;
   `Broadcast*` e o timer passam por eles.
2. `signaling/client.go`: `readPump` usa `deliver` e `leave`.
3. `signaling/handler.go`: `serveWS` usa `enroll`.
4. `signaling/hub_lifecycle_test.go`: término pelos três caminhos, envios depois do término e contagem de goroutines
   de ponta a ponta.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Sinal de término | `done chan struct{}` fechado por `run()` | C-4101 |
| Onde conferir | depois de cada evento do `select` | C-4101 |
| Canais com buffer | `terminated()` antes do envio | C-4101 |
| Estado liberado | timer, `clients`, `chatLimits`, `chatHistory`, `sharedFiles`, `pinned*` | RF-4102 |
| Marcador | hub continua em `Handler.hubs`; `status` e `connectedStudents` sob mutex | RF-4104 |
| Versão | PATCH via `npm run bump -- patch` | C-4103 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Envio esquecido sem `done` | goroutine bloqueada para sempre | todos os envios ao hub passam pelos métodos novos; teste de envios depois do término |
| Testes antigos chamam `onRoomClose()` direto com `run()` viva | corrida no `release` | o término só é conferido depois de um evento recebido por `run()` |
| `-race` não roda no Windows (sem cgo) | sem verificação local nativa | container Linux (`golang:1.26`) e CI Linux do PR #26 |

## Scope Lock

### IN

- ciclo de vida de `run()`, liberação do estado e envios ao hub;
- testes novos do pacote `signaling`;
- incremento PATCH.

### OUT

- remover o marcador do mapa do handler;
- SFU, store, web e desktop;
- persistência.

### Allowed Paths

- `apps/backend/internal/signaling/hub.go`, `apps/backend/internal/signaling/client.go`,
  `apps/backend/internal/signaling/handler.go`, `apps/backend/internal/signaling/hub_lifecycle_test.go`
- `spec-kit/specs/041-termino-do-hub-encerrado/**`
- só na T4103, via `npm run bump`: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`

### Prohibited Paths

- `apps/backend/internal/signaling/message.go`, `apps/backend/internal/room/**`, `apps/backend/internal/webrtc/**`,
  `apps/backend/cmd/**`
- `apps/web/**`, `apps/desktop/**`, `packages/**/src/**`
- `spec-kit/specs/001-screen-share-core/**`, `spec-kit/docs/adrs/**`, `.github/**`

### Dependencies

- Nenhuma nova. Go stdlib (`runtime`, `sync`, `testing`) e `gorilla/websocket`, já usados.

### Non-Goals

- reaproveitar IDs de sala;
- mudar o tempo de reconexão do professor.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: nenhuma regra de autorização muda.
- [x] Princípio III: SFU intocada; sem P2P nem reencode.
- [x] Princípio IV: nenhuma meta de desempenho declarada.
- [x] Princípio V: nenhum contrato muda.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: um canal de término e métodos de envio pequenos.
- [ ] Princípio VIII: converge ao final (T4102).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-15 | `done` e envios que o escutam, em vez de buffers | C-4101 |
| 2026-11-15 | Marcador mantido sem estado; encerramento repetido descartado | C-4102 |
| 2026-11-15 | Uma feature, um PR sobre a 039, IDs `410x`, PATCH | C-4103 |
