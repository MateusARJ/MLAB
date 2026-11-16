# Tasks: Limite do RNF-121 Medido Só na Sondagem

Feature: `030-teste-mdns-sondagem`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: DONE

Regras:
- `gofmt -l`, `go vet ./...` e `go test -count=1 ./...` em `apps/backend` verdes antes do `[x]`;
- um commit atômico por task, com `Ref: T300x` e `Refs #87`.

### T3001 — Medir só a sondagem no teste do claim com outro backend
[x] T3001
Allowed Paths: `apps/backend/internal/room/mdns_test.go`, `apps/backend/internal/room/mdns_probe_test.go`
Prohibited Paths: `apps/backend/internal/room/mdns.go`, `apps/backend/internal/room/mdns_probe.go`,
`apps/backend/internal/signaling/**`, `apps/backend/internal/webrtc/**`, `apps/backend/go.mod`, `apps/desktop/**`,
`apps/web/**`, `packages/**`
Checks:
- [x] `proberCronometrado` e `cronometraSondagem(t)` em `mdns_probe_test.go`: embrulham o prober real, guardam só a
  primeira sondagem sob mutex e restauram `newMDNSProber` no `t.Cleanup` (RF-3001, C-3003).
- [x] `TestMDNSNaoDisputaNomeDeOutroBackend` aplica 1,5 s à sondagem, falha se ela não ocorreu e registra sondagem e
  claim total no log (RF-3001, RF-3002).
- [x] `go test -race -count=3 -run 'TestMDNS|TestLegacyProber' -v ./internal/room/` verde, sem corrida. Registrado:
  `-race` exige cgo e a máquina da verificação não tem gcc; rodado sem `-race` (3 de 3 verdes, sondagem 769–964 ms,
  claim 867–1054 ms). Sincronização conferida no código: escrita e leitura da duração só sob o mesmo mutex.
- [x] `go vet ./...` e `go test -count=1 ./...` verdes (coberto pela rodada `-count=10` da T3002, 6 pacotes).

### T3002 — Converge
[x] T3002
Depends On: T3001
Allowed Paths: `spec-kit/specs/030-teste-mdns-sondagem/**`
Prohibited Paths: `apps/**`, `packages/**`, `package.json`, `package-lock.json`
Checks:
- [x] `go test -count=10 ./...` em `apps/backend` sem falha de `TestMDNSNaoDisputaNomeDeOutroBackend` (10 de 10, 6
  pacotes verdes); maior tempo de sondagem 974 ms, maior claim 1,06 s.
- [x] `converge.md` com evidências, desvios e impacto de versão (nenhum).
- [x] `npm run spec:check` com PASS.
