# Plan: Leitura Sincronizada do Status do Hub

Feature: `036-status-hub-sincronizado`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-3601 a C-3604)

## 1. Summary

```text
hub (goroutine run): setStatus / onPublisherTimeout / onRoomClose ──► writeStatus(s)  [statusMu.Lock]
signaling.Handler.getOrCreateHub (goroutine HTTP)                 ──► hub.isClosed()  [statusMu.RLock]
leituras dentro de run(): h.status direto (mesma goroutine que escreve)
```

1. `signaling/hub.go`: `statusMu sync.RWMutex`; `writeStatus` como único ponto de escrita; `isClosed` para leitura
   externa; comentário do struct atualizado.
2. `signaling/handler.go`: `getOrCreateHub` usa `hub.isClosed()`.
3. `signaling/hub_status_test.go`: teste concorrente do `getOrCreateHub` com o encerramento.
4. `.github/workflows/build-all.yml`: passo `go test -race` na perna Linux.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Sincronização | `sync.RWMutex` próprio, padrão do `studentsMu` | C-3601 |
| Escrita | só `writeStatus`, chamado na goroutine `run()` | RF-3601 |
| Leitura em `run()` | sem lock: a goroutine lê o que ela mesma escreveu | RF-3601 |
| Callbacks | `onStatusChanged`/`onClosed` fora do lock | RNF-3602 |
| Race no CI | passo só em `ubuntu-latest` (gcc presente, cgo ativo por padrão) | C-3603 |
| Versão | PATCH via `npm run bump -- patch` | C-3604 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Deadlock hub ↔ store | hub trava | o lock cobre só a atribuição; callbacks rodam depois de soltá-lo |
| `-race` acusar outra race já existente | CI vermelho | registrar como desvio (AGENTS §14), sem corrigir nesta feature |
| Teste concorrente instável | falso negativo | espera com prazo pelo encerramento e `-count` repetido na verificação |
| `workflow_dispatch` do `build-all.yml` cria release | release indevida | não disparar manualmente; a evidência do `-race` vem do PR para a `main` |

## Scope Lock

### IN

- sincronização do status do hub (`hub.go`) e leitura pelo handler (`handler.go`);
- teste do pacote `signaling`;
- passo de `-race` no CI Linux;
- incremento PATCH.

### OUT

- recusar registro em hub encerrado (janela TOCTOU, C-3602);
- protocolo WebSocket (`message.go`), SFU, `room`, web, desktop, `packages/`;
- persistência.

### Allowed Paths

- `apps/backend/internal/signaling/hub.go`, `apps/backend/internal/signaling/handler.go`,
  `apps/backend/internal/signaling/hub_status_test.go`
- `.github/workflows/build-all.yml`
- `spec-kit/specs/036-status-hub-sincronizado/**`
- só na T3605, via `npm run bump`: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`

### Prohibited Paths

- `apps/backend/internal/signaling/message.go`, `apps/backend/internal/room/**`, `apps/backend/internal/webrtc/**`,
  `apps/backend/cmd/**`
- `apps/web/**`, `apps/desktop/**`, `packages/**/src/**`
- `spec-kit/specs/001-screen-share-core/**`, `spec-kit/docs/adrs/**`

### Dependencies

- Nenhuma nova. Go stdlib (`sync`, `testing`, `time`).

### Non-Goals

- fechar a janela entre `getOrCreateHub` e `hub.register`;
- limpar hubs encerrados do mapa fora do `getOrCreateHub`;
- `-race` em Windows e macOS.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: nada muda na autorização.
- [x] Princípio III: SFU intocada; sem P2P nem reencode.
- [x] Princípio IV: nenhuma meta de desempenho declarada.
- [x] Princípio V: nenhum contrato muda.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: um mutex, dois métodos, um teste, um passo de CI.
- [ ] Princípio VIII: converge ao final (T3604).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-15 | Mutex próprio para o status do hub | C-3601 |
| 2026-11-15 | Janela TOCTOU fora do escopo, como desvio | C-3602 |
| 2026-11-15 | `-race` só na perna Linux do CI | C-3603 |
| 2026-11-15 | Uma feature, um PR, IDs `360x`, PATCH | C-3604 |
