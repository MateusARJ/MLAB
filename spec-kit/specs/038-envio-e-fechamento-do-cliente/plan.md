# Plan: Envio e Fechamento do Cliente sem Corrida

Feature: `038-envio-e-fechamento-do-cliente`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-3801 e C-3802)

## 1. Summary

```text
Client{ sendMu sync.Mutex; closed bool }
safeSend:      lock → closed? descarta : select { send<-data | default: descarta } → unlock
closeWithCode: closeOnce.Do( lock → closeCode/reason → closed=true → close(send) → unlock )
```

1. `signaling/client.go`: `sendMu` e `closed` no `Client`. `safeSend` e `closeWithCode` usam o lock, e o `recover()`
   deixa de ser necessário.
2. `signaling/client_test.go`: envio depois do fechamento e envios concorrentes ao fechamento.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Sincronização | `sync.Mutex` por cliente, tomado em `safeSend` e `closeWithCode` | C-3801 |
| Bloqueio sob lock | nenhum: o envio é `select` com `default` | RNF-3801 |
| Idempotência | `closeOnce` mantido | RF-3803 |
| `recover()` | removido: com o lock não há envio em canal fechado | RF-3801 |
| Leitura do close code pelo `writePump` | inalterada: os campos são escritos antes de `close(send)` | RF-3803 |
| Versão | PATCH via `npm run bump -- patch` | C-3802 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Lock contendido no broadcast | latência | seção crítica curta e não bloqueante; um lock por cliente |
| Deadlock | travamento | o lock não chama nada externo nem toma outro lock |
| `-race` não roda no Windows (sem cgo) | sem verificação local nativa | rodar o passo do CI num container Linux (`golang:1.26`) e no CI Linux do PR #26 |

## Scope Lock

### IN

- `safeSend`, `closeWithCode` e os campos do `Client`;
- teste novo do pacote `signaling`;
- incremento PATCH.

### OUT

- ordem das mensagens do registro;
- hub, handler, SFU, web e desktop;
- persistência.

### Allowed Paths

- `apps/backend/internal/signaling/client.go`, `apps/backend/internal/signaling/client_test.go`
- `spec-kit/specs/038-envio-e-fechamento-do-cliente/**`
- só na T3803, via `npm run bump`: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`

### Prohibited Paths

- `apps/backend/internal/signaling/hub.go`, `apps/backend/internal/signaling/handler.go`,
  `apps/backend/internal/signaling/message.go`, `apps/backend/internal/room/**`, `apps/backend/internal/webrtc/**`,
  `apps/backend/cmd/**`
- `apps/web/**`, `apps/desktop/**`, `packages/**/src/**`
- `spec-kit/specs/001-screen-share-core/**`, `spec-kit/docs/adrs/**`, `.github/**`

### Dependencies

- Nenhuma nova. Go stdlib (`sync`, `testing`), já usada.

### Non-Goals

- enviar `ice-servers` antes do registro;
- remover o log de buffer cheio.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: nenhuma regra de autorização muda.
- [x] Princípio III: SFU intocada; sem P2P nem reencode.
- [x] Princípio IV: nenhuma meta de desempenho declarada.
- [x] Princípio V: nenhum contrato muda.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: um lock, uma flag, um teste.
- [ ] Princípio VIII: converge ao final (T3802).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-15 | Lock no `Client` em vez de reordenar o `serveWS` | C-3801 |
| 2026-11-15 | Uma feature, um PR, IDs `380x`, PATCH | C-3802 |
