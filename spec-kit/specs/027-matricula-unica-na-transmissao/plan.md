# Plan: Matrícula Conectada Recusa Nova Entrada

Feature: `027-matricula-unica-na-transmissao`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-2701 a C-2705)
ADR: `spec-kit/docs/adrs/0010-sessao-unica-recusa-nova-entrada.md`

## 1. Summary

```text
aluno B: POST /join ──► room.Handler.handleJoin
   studentConnected(room.ID, matrícula)? ──► sim: 409 "Esta matrícula já está conectada nesta transmissão." (RF-2701)
                                         └─► não: regra de sala cheia (429) e fluxo atual (RF-2702)
         └─ main.go liga studentConnected → signaling.Handler.HasConnectedStudent → Hub.HasConnectedStudent

corrida (dois join aceitos): WS do aluno B ──► Hub.onRegister
   outro participant_id com a mesma matrícula registrado? ──► sim: closeWithCode(4002), não registra (RF-2703)
   mesmo participant_id? ──► fecha a conexão anterior com 4001, registra a nova (RF-2704)
Hub.onUnregister ──► libera a matrícula (RF-2705)

web: Join.tsx já exibe o `error` do 409; hook: close 4002 → status `student-id-in-use`, sem reconexão;
Room.tsx → onLeave("Esta matrícula já está conectada nesta transmissão.") (RF-2706)
```

1. `signaling/client.go`: `CloseStudentIDInUse = 4002`, motivo `"Student ID In Use"`.
2. `signaling/hub.go`:
   - campos `studentsMu sync.RWMutex` e `connectedStudents map[string]string` (chave: matrícula normalizada com
     `strings.ToUpper(strings.TrimSpace(...))`; valor: `participant_id`), escritos só na goroutine `run`, sob o mutex;
   - `HasConnectedStudent(studentID string) bool`, seguro entre goroutines (RNF-2702);
   - `onRegister`: o laço que derrubava outro aluno com `4001` vira a recusa com `4002` + `return` antes de registrar;
     o caso do mesmo `participant_id` segue com `4001`; após registrar, grava a matrícula;
   - `onUnregister`: remove a matrícula se ela aponta para o participante que saiu.
3. `signaling/handler.go`: `HasConnectedStudent(roomID, studentID string) bool` via `GetHub`.
4. `room/handler.go`: `SetStudentConnectedChecker(func(roomID, studentID string) bool)`, no padrão de
   `SetFileBroadcaster`; checagem no `handleJoin` depois da sala encerrada e antes do `CountParticipants`.
5. `cmd/server/main.go`: `roomHandler.SetStudentConnectedChecker(sigHandler.HasConnectedStudent)`.
6. Web: `useWebRTCSubscriber.ts` trata `4002` como o `4001` (sem reconexão), com o estado `student-id-in-use`;
   `Room.tsx` chama `onLeave` com a mensagem.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Fonte da verdade | WebSocket registrado no hub, não o store | C-2702 |
| Normalização | `ToUpper(TrimSpace)` para a chave; a regex da matrícula aceita só ASCII, então equivale a `EqualFold` | C-2702, C-501 |
| Concorrência | mapa próprio com `RWMutex`; `clients` segue exclusivo da `run` | RNF-2702 |
| Desacoplamento | `room` não importa `signaling`; ligação por função em `main.go`, como os broadcasters | AGENTS §6 |
| Store | sem mudança: `AddParticipant` continua trocando o registro de mesma matrícula (só chega lá quem não está conectado) | spec §8 |
| Web 409 | sem mudança no `Join.tsx`: `joinRoom` já lança `error` da resposta; só teste | C-2703 |
| Testes Go | `hub_session_test.go`, `room_test.go`, smoke A19 (`-tags smoke`) | spec §11 |
| Versão | MINOR via `npm run bump -- minor` | C-2705 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Matrícula presa por WS zumbi | dono espera até 60 s | reconexão com o mesmo token é aceita (RF-2704); `pongWait` já existente |
| Mapa de matrículas fora de sincronia com `clients` | recusa indevida | escrito nos mesmos pontos que `clients` (`onRegister`/`onUnregister`), coberto por teste |
| `sendJSON` de ICE servers para cliente recusado | panic | `safeSend` já recupera envio em canal fechado |
| E2E reaproveitar a mesma matrícula com aba aberta | teste quebra | cada teste do E2E fecha a página do anterior; conferido no converge |
| Conflito de versão com outro PR | `version:check` falha | rebase e novo bump no PR que entrar depois |

## Scope Lock

### IN

- recusa da matrícula conectada no `join` e no hub; close `4002`;
- tratamento do `4002` no web;
- RN-04, contratos da 001 e espelho em `docs/requirements/`;
- testes, smoke A19 e incremento MINOR.

### OUT

- remoção de aluno pelo professor; PIN ou cadastro de alunos;
- app desktop, `packages/**`, SFU (`internal/webrtc`);
- mudança no store e na regex da matrícula.

### Allowed Paths

- `apps/backend/internal/signaling/client.go`, `apps/backend/internal/signaling/hub.go`,
  `apps/backend/internal/signaling/handler.go`, `apps/backend/internal/signaling/hub_session_test.go`
- `apps/backend/internal/room/handler.go`, `apps/backend/internal/room/room_test.go`
- `apps/backend/cmd/server/main.go`, `apps/backend/cmd/server/smoke_test.go`, `scripts/smoke-report.js`
- `apps/web/src/hooks/useWebRTCSubscriber.ts`, `apps/web/src/hooks/useWebRTCSubscriber.test.ts`,
  `apps/web/src/pages/Room.tsx`, `apps/web/src/pages/Room.test.tsx`, `apps/web/src/pages/Join.test.tsx`
- `spec-kit/specs/001-screen-share-core/spec.md`, `spec-kit/specs/001-screen-share-core/contracts/room-api.md`,
  `spec-kit/specs/001-screen-share-core/contracts/signaling.md`
- `docs/requirements/business-rules/RN004-restricao-de-sessao-unica-por-aluno.md`
- `spec-kit/specs/027-matricula-unica-na-transmissao/**`
- só na T2705, via `npm run bump`: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`

### Prohibited Paths

- `apps/backend/internal/room/store.go`, `apps/backend/internal/webrtc/**`, `apps/backend/internal/auth/**`
- `apps/web/src/pages/Join.tsx`, `apps/web/src/App.tsx`, `apps/web/src/services/**`
- `apps/desktop/**`, `packages/**` (fora da T2705)
- `.github/**`, `docs/metrics/**`, `spec-kit/docs/adrs/**` (a ADR 0010 já foi registrada antes desta feature)

### Dependencies

- Nenhuma nova. Go stdlib (`sync`, `strings`), `gorilla/websocket` já usado; Vitest e Testing Library já instalados.

### Non-Goals

- diferenciar homônimos ou validar a matrícula contra lista da turma;
- liberar a matrícula antes de o servidor detectar a queda do WebSocket;
- mensagem nova no WebSocket (a recusa usa só o close code).

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED, ADR 0010 aprovada.
- [x] Princípio II: recusa decidida no servidor (`join` e hub).
- [x] Princípio III: SFU intocada.
- [x] Princípio IV: nenhuma meta de desempenho declarada.
- [x] Princípio V: `room-api.md` e `signaling.md` atualizados na T2701, antes do código.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: só o mapa de matrículas e um callback; ambos com consumidor.
- [ ] Princípio VIII: converge ao final (T2705).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-13 | Matrícula conectada recusa a nova entrada | C-2701, ADR 0010 |
| 2026-11-13 | "Conectada" = WS ativo no hub | C-2702 |
| 2026-11-13 | `409` no `join`, `4002` na corrida | C-2703 |
| 2026-11-13 | `409` antes do `429` | C-2704 |
| 2026-11-13 | IDs `270x`; versão MINOR | C-2705 |
