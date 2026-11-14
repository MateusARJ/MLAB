# Plan: Join em Sala Encerrada Responde 409

Feature: `029-join-sala-encerrada`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-2901 a C-2903)

## 1. Summary

```text
aluno: POST /join ──► room.Handler.handleJoin
   sala não encontrada ──► 404 "sala não encontrada" (RF-2903, sem mudança)
   room.Status == closed ──► 409 "esta transmissão já foi encerrada..." (RF-2901; era 404)
   matrícula conectada ──► 409 Student ID in use (027, sem mudança; vem depois — RF-2902)
   sala cheia ──► 429 (sem mudança)
```

1. `room/handler.go`, `handleJoin`: `http.StatusNotFound` → `http.StatusConflict` no ramo `StatusClosed`, com
   comentário citando a RN-08.
2. `room/room_test.go`: `TestJoinSalaEncerrada`, no molde de `TestJoinMatriculaConectada`.
3. `001/converge.md`: a evidência da RN-08 aponta `TestJoinSalaEncerrada`.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Direção | código segue a spec (`409`) | C-2901 |
| Mensagem | mantida; o web exibe `error` e o E2E procura "encerrada" | C-2902 |
| Ordem | sala encerrada antes da matrícula conectada e do `429` (já é assim) | C-2902 |
| Teste | sala criada `closed` via `store.CreateRoom`, sem passar pela REST `close` (que remove a sala) | spec §2 |
| Versão | PATCH via `npm run bump -- patch` | C-2903 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Cliente que tratava `404` como "encerrada" | mensagem diferente | web e E2E usam só o texto do `error`, que não muda |
| Conflito de versão com a 028 (2.0.0) | `version:check` falha | rebase e novo bump no PR que entrar depois |

## Scope Lock

### IN

- status `409` no ramo de sala encerrada do `join`;
- teste Go do `join` para sala encerrada;
- evidência da RN-08 no `001/converge.md`;
- incremento PATCH.

### OUT

- encerramento pelo hub sem marcar a sala no store (issue própria);
- status do `GET /rooms/{id}/info` para sala encerrada (issue própria);
- mensagem de erro, store, sinalização, web, desktop e `packages/**`.

### Allowed Paths

- `apps/backend/internal/room/handler.go`, `apps/backend/internal/room/room_test.go`
- `spec-kit/specs/001-screen-share-core/converge.md`
- `spec-kit/specs/029-join-sala-encerrada/**`
- só na T2903, via `npm run bump`: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`

### Prohibited Paths

- `apps/backend/internal/room/store.go`, `apps/backend/internal/signaling/**`, `apps/backend/internal/webrtc/**`,
  `apps/backend/cmd/**`
- `apps/web/**`, `apps/desktop/**`, `packages/**` (fora da T2903)
- `spec-kit/specs/001-screen-share-core/contracts/**`, `spec-kit/specs/001-screen-share-core/spec.md`,
  `docs/requirements/**`, `spec-kit/docs/adrs/**`, `.github/**`

### Dependencies

- Nenhuma nova. Go stdlib (`net/http/httptest`) já usada nos testes.

### Non-Goals

- mudar o `404` do link de sala removida;
- unificar as mensagens de erro do `join`.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: recusa decidida no servidor.
- [x] Princípio III: SFU intocada.
- [x] Princípio IV: nenhuma meta de desempenho declarada.
- [x] Princípio V: contrato inalterado; o código passa a cumpri-lo.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: uma constante de status e um teste.
- [ ] Princípio VIII: converge ao final (T2903).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-14 | Código volta ao `409` da RN-08 | C-2901 |
| 2026-11-14 | Mensagem e ordem mantidas | C-2902 |
| 2026-11-14 | Desvios adjacentes em issues; IDs `290x`; versão PATCH | C-2903 |
