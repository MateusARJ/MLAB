# Tasks: Link `mlab.local` no Celular

Feature: `010-mdns-celular`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: READY-FOR-IMPLEMENTATION

Regra de cada task de código: `go vet ./...` e `go test ./...` em `apps/backend` verdes antes do `[x]`.

### T101 — Teste de regressão da consulta *legacy unicast*
[ ] T101
Allowed Paths: `apps/backend/internal/room/mdns_test.go`
Prohibited Paths: `apps/backend/internal/room/mdns.go`, `apps/backend/go.mod`, `apps/web/**`, `apps/desktop/**`,
`packages/**`
Checks:
- [ ] Consulta A `mlab.local` com ID ≠ 0, de porta efêmera, para `224.0.0.251:5353`; exige resposta unicast nessa
  porta com o mesmo ID, a pergunta ecoada e A = IP anunciado (RF-101).
- [ ] Consulta AAAA não recebe registro A (RF-103).
- [ ] `t.Skip` quando a 5353 ou o multicast não estiverem disponíveis.
- [ ] Evidência de que o teste falha com a `pion/mdns v0.0.12`.

### T102 — Migrar o responder para `pion/mdns/v2`
[ ] T102
Depends On: T101
Allowed Paths: `apps/backend/internal/room/mdns.go`, `apps/backend/internal/room/mdns_windows.go`,
`apps/backend/internal/room/mdns_posix.go`, `apps/backend/go.mod`, `apps/backend/go.sum`
Prohibited Paths: `apps/backend/internal/room/handler.go`, `apps/backend/internal/room/origin.go`,
`apps/backend/internal/room/network.go`, `apps/backend/internal/webrtc/**`, `apps/web/**`, `apps/desktop/**`,
`packages/**`
Checks:
- [ ] Import `github.com/pion/mdns/v2` v2.2.2; `github.com/pion/mdns` v0.0.12 removido do `go.mod`.
- [ ] Socket, interfaces, nomes, `LocalAddress` e `Start/StopMDNSServer` sem mudança de comportamento (RF-102, RNF-101).
- [ ] T101 e `TestMDNSServerLifecycleAndQuery` passam; `go vet ./...` e `go test ./...` verdes.

### T103 — Roteiro do smoke A16
[ ] T103
Depends On: T102
Allowed Paths: `docs/metrics/smoke-runbook.md`
Prohibited Paths: `apps/**`, `packages/**`
Checks:
- [ ] A16 lista os limites reais (Firefox, Android < 12, isolamento de AP, firewall do Windows) e o diagnóstico rápido.

### T104 — Verificação manual (A16) e converge
[ ] T104
Depends On: T102, T103
Allowed Paths: `spec-kit/specs/010-mdns-celular/**`
Prohibited Paths: `apps/**`, `packages/**`
Checks:
- [ ] A16 executado: `mlab.local` abre a sala num Android 12+ (Chrome); iOS (Safari) ou "N/E"; link por IP segue.
- [ ] `converge.md` com o resultado, as pendências e o nível de versão (PATCH).
