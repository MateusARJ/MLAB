# Tasks: Limite do RNF-121 Medido Só na Sondagem

Feature: `030-teste-mdns-sondagem`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: READY

Regras:
- `gofmt -l`, `go vet ./...` e `go test -count=1 ./...` em `apps/backend` verdes antes do `[x]`;
- um commit atômico por task, com `Ref: T300x` e `Refs #87`.

### T3001 — Medir só a sondagem no teste do claim com outro backend
[ ] T3001
Allowed Paths: `apps/backend/internal/room/mdns_test.go`, `apps/backend/internal/room/mdns_probe_test.go`
Prohibited Paths: `apps/backend/internal/room/mdns.go`, `apps/backend/internal/room/mdns_probe.go`,
`apps/backend/internal/signaling/**`, `apps/backend/internal/webrtc/**`, `apps/backend/go.mod`, `apps/desktop/**`,
`apps/web/**`, `packages/**`
Checks:
- [ ] `proberCronometrado` e `cronometraSondagem(t)` em `mdns_probe_test.go`: embrulham o prober real, guardam só a
  primeira sondagem sob mutex e restauram `newMDNSProber` no `t.Cleanup` (RF-3001, C-3003).
- [ ] `TestMDNSNaoDisputaNomeDeOutroBackend` aplica 1,5 s à sondagem, falha se ela não ocorreu e registra sondagem e
  claim total no log (RF-3001, RF-3002).
- [ ] `go test -race -count=3 -run 'TestMDNS|TestLegacyProber' -v ./internal/room/` verde, sem corrida.
- [ ] `go vet ./...` e `go test -count=1 ./...` verdes.

### T3002 — Converge
[ ] T3002
Depends On: T3001
Allowed Paths: `spec-kit/specs/030-teste-mdns-sondagem/**`
Prohibited Paths: `apps/**`, `packages/**`, `package.json`, `package-lock.json`
Checks:
- [ ] `go test -count=10 ./...` em `apps/backend` sem falha de `TestMDNSNaoDisputaNomeDeOutroBackend`; maior tempo de
  sondagem registrado.
- [ ] `converge.md` com evidências, desvios e impacto de versão (nenhum).
- [ ] `npm run spec:check` com PASS.
