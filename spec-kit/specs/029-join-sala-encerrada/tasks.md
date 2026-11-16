# Tasks: Join em Sala Encerrada Responde 409

Feature: `029-join-sala-encerrada`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: DONE

Regras:
- `go test ./...` e `go vet ./...` em `apps/backend`; `gofmt -l` vazio nos arquivos Go alterados antes de marcar `[x]`;
- um commit atômico por task, com `Ref: T290x` e `Refs #86`.

### T2901 — Teste do join em sala encerrada
[x] T2901
Allowed Paths: `apps/backend/internal/room/room_test.go`
Prohibited Paths: `apps/backend/internal/room/handler.go`, `apps/backend/internal/room/store.go`,
`apps/backend/internal/signaling/**`, `apps/web/**`, `apps/desktop/**`, `packages/**`, `package.json`
Checks:
- [x] `TestJoinSalaEncerrada`: sala `closed` → `409`, `error` com a mensagem de sala encerrada, nenhum participante
  registrado (RF-2901).
- [x] Com a matrícula conectada (checker `true`), a resposta é o `409` de sala encerrada (RF-2902).
- [x] Id inexistente → `404` (RF-2903).
- [x] O teste falha antes da T2902 (o código responde `404`); entra no mesmo commit da T2902 para não deixar a suíte
  vermelha.

### T2902 — Join: 409 para sala encerrada
[x] T2902
Depends On: T2901
Allowed Paths: `apps/backend/internal/room/handler.go`, `apps/backend/internal/room/room_test.go`
Prohibited Paths: `apps/backend/internal/room/store.go`, `apps/backend/internal/signaling/**`,
`apps/backend/internal/webrtc/**`, `apps/backend/cmd/**`, `apps/web/**`, `apps/desktop/**`, `packages/**`,
`package.json`
Checks:
- [x] Ramo `StatusClosed` do `handleJoin` responde `http.StatusConflict` com a mensagem mantida (RF-2901, C-2902).
- [x] `TestJoinSalaEncerrada` verde; `go test ./...`, `go vet ./...` verdes; `gofmt -l` vazio.

### T2903 — Converge e versão
[x] T2903
Depends On: T2902
Allowed Paths: `spec-kit/specs/029-join-sala-encerrada/**`, `spec-kit/specs/001-screen-share-core/converge.md`,
`package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`
Prohibited Paths: `apps/**/src/**`, `apps/backend/internal/**`, `apps/backend/cmd/**`, `packages/**/src/**`,
`.github/**`
Checks:
- [x] `converge.md` com evidências, desvios e impacto de versão (PATCH, C-2903).
- [x] `001/converge.md`: evidência da RN-08 aponta `TestJoinSalaEncerrada`.
- [x] `npm run bump -- patch` e `npm run version:check`; commit `chore(release): versao X.Y.Z`.
- [x] `npm run spec:check -- spec-kit/specs/029-join-sala-encerrada` com PASS.
