# Tasks: Teste do Join Independente da Rede

Feature: `013-teste-ice-offline`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: READY

Regras:
- `go vet ./...` e `go test -count=1 ./...` em `apps/backend` verdes antes do `[x]`;
- um commit atômico por task, com `Ref: T13x` e `Refs #35`.

### T131 — Isolar `TestJoinRoomBySlug` da rede
[x] T131
Allowed Paths: `apps/backend/internal/room/room_test.go`
Prohibited Paths: `apps/backend/internal/room/handler.go`, `apps/backend/internal/room/network.go`,
`apps/backend/internal/signaling/**`, `apps/backend/go.mod`, `apps/desktop/**`, `apps/web/**`, `packages/**`
Checks:
- [x] Antes: `go test -count=1 -run TestJoinRoomBySlug ./internal/room/` falha sem internet ("esperava IceServers
  configurados", `room_test.go:406`; Windows 11, 2026-11-10, máquina onde `IsInternetAvailable()` é falso).
- [x] Helper `forceInternet(t, online)` fixa o cache de conectividade e restaura no `t.Cleanup` (RF-131).
- [x] Helper `joinBySlug(t)` com a montagem atual do teste; `TestJoinRoomBySlug` fixa `STUN_URL` vazio e internet
  disponível e confere o STUN padrão; passa na mesma máquina sem internet. `go vet ./...` e `go test -count=1 ./...`
  verdes (6 pacotes).

### T132 — Cobrir os três ramos de `ice_servers`
[ ] T132
Depends On: T131
Allowed Paths: `apps/backend/internal/room/room_test.go`
Prohibited Paths: `apps/backend/internal/room/handler.go`, `apps/backend/internal/room/network.go`,
`apps/backend/internal/signaling/**`, `apps/backend/go.mod`, `apps/desktop/**`, `apps/web/**`, `packages/**`
Checks:
- [ ] `TestJoinIceServers`: `STUN_URL` configurada sem internet → só ela; sem `STUN_URL` com internet → STUN público
  padrão; sem `STUN_URL` sem internet → lista vazia e JSON `"ice_servers":[]` (RF-132, ADR 0005).
- [ ] Suíte do backend verde.

### T133 — Converge
[ ] T133
Depends On: T131, T132
Allowed Paths: `spec-kit/specs/013-teste-ice-offline/**`
Prohibited Paths: `apps/**`, `packages/**`, `package.json`, `package-lock.json`
Checks:
- [ ] `converge.md` com evidências, desvios e impacto de versão (nenhum).
- [ ] `npm run spec:check` com PASS.
