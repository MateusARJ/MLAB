# Converge: Status da Sala Acompanha a Sessão do Hub

Feature: `035-status-sala-pelo-hub`
Mode: READ-ONLY sobre o código (só este arquivo, o `tasks.md`, o espelho `RF018` e as evidências dos `converge.md` da
001 e da 002 são escritos)
Data: 2026-11-15
Commits avaliados: `f006f2e` (artefatos), `24bf162` (T3501), `bb43154` (T3502), `e7a2ff3` (T3503), `507f717` (T3504),
`3fdf419` (T3505)
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-3501 a C-3504), `plan.md`, `tasks.md` (T3501 a T3507)
- contrato: `001/contracts/room-api.md` (`join`, `/info`, `/rooms/active`); RF-18 da 001; RNF-SEC-05 da 002
- código: `room/model.go`, `room/store.go` (`SetSessionStatus`, `activeRoomRank`), `room/handler.go`
  (`SyncStatusFromSession`), `signaling/hub.go` (`setStatus`, `newHubWithCallbacks`), `signaling/handler.go`
  (`SetRoomStatusListener`), `cmd/server/main.go`, `packages/types/src/index.ts`
- suítes:
  - `go vet ./...` e `go test ./...` em `apps/backend`: todos os pacotes verdes;
  - `go test -tags smoke -run TestSmoke ./cmd/server/`: verde (~52 s);
  - `gofmt -d` vazio nos arquivos Go alterados (conferido sem o CRLF da cópia de trabalho);
  - `turbo run lint` em `@mlab/types`, `@mlab/web` e `@mlab/desktop` e `npm run build -w @mlab/types`: verdes;
  - verificação de ponta a ponta, com teste temporário não versionado sobre o servidor real do smoke: sala criada →
    `waiting`; professor conecta o WebSocket → `/info` e `/rooms/active` com `publishing` e `join` com
    `room_status: publishing`; professor cai → `reconnecting`; volta → `publishing`.

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-3501 | `hub.go` (`setStatus` nos quatro pontos); `main.go` (`SetRoomStatusListener` → `SyncStatusFromSession`); `TestHub_AvisaMudancaDeStatus`; `TestSetSessionStatus`; verificação de ponta a ponta |
| RF-3502 | `TestSyncStatusFromSession` (`/info` por id e slug, `/rooms/active`, `room_status` do `join` com `publishing`/`reconnecting`) |
| RF-3503 | `store.go` (`activeRoomRank`: 3/2/1); `TestGetActiveRoom_Deterministic` (reconnecting > waiting mais nova; publishing > reconnecting) |
| RF-3504 | `001/contracts/room-api.md` (commit `24bf162`); `RoomStatus` com `'reconnecting'` (commit `3fdf419`) |
| RNF-3501 | `SetSessionStatus` recusa sala `closed`/inexistente sem tocar índices; `TestSetSessionStatus`; `TestSyncStatusFromSession` (aviso após remoção não traz a sala de volta) |
| RNF-3502 | callback só na goroutine do hub, só toma o lock do store; `TestHub_AvisaMudancaDeStatus` (sem aviso repetido, `closed` fora do callback) |
| RNF-3503 | nenhuma dependência nova |

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta | Evidência |
|---|---|---|
| — | — | nenhum |

## 3. Divergências (código ≠ spec/plan/contrato)

| Item | Plan diz | Código faz | Encaminhamento |
|---|---|---|---|
| Assinatura do hub | `newHub` recebe `hubCallbacks` opcional | `newHub` mantém o variádico `onClosed` e delega a `newHubWithCallbacks(roomID, sfu, hubCallbacks)` | aceito: evita tocar `hub_test.go`, fora do Scope Lock; mesmo efeito. `tasks.md` (T3504) atualizado |

- A divergência da issue #101 (status sempre `waiting`) está resolvida por esta feature.

## 4. Código sem requisito (implementado fora de spec/task)

| Comportamento | Onde | Encaminhamento |
|---|---|---|
| — | — | nenhum |

## 5. Testes faltantes

- `go test -race` não pôde ser executado (Windows sem cgo/gcc). O callback novo roda na goroutine do hub; a leitura
  de `hub.status` fora dela em `getOrCreateHub` segue registrada na issue #102.
- Verificação manual com o app desktop não foi executada; a verificação de ponta a ponta usou o servidor real do
  smoke com clientes WebSocket.

## 6. Novas tasks necessárias

- Nenhuma.

## 7. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| — | — | — | nenhum desvio novo |

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| PATCH | 1.15.5 | O código passa a cumprir requisitos e contrato já existentes (RF-18, RNF-SEC-05, `status` do `/info`); `reconnecting` no `join` e no `RoomStatus` alinha ao enum que o contrato já declarava, sem capacidade nova (C-3504). |

## 9. Resultado

- [ ] OPEN
- [x] CONVERGED — o status da sessão do hub (`publishing`, `reconnecting`) chega ao store; `/info`, `/rooms/active` e
  o `join` refletem a transmissão; `/rooms/active` ordena `publishing > reconnecting > waiting`; sala encerrada não é
  reaberta por aviso tardio.
