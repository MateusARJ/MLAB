# Tasks: Link `mlab.local` no Celular

Feature: `010-mdns-celular`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: READY-FOR-IMPLEMENTATION

Regra de cada task de código: `go vet ./...` e `go test ./...` em `apps/backend` verdes antes do `[x]`.

### T101 — Teste de regressão da consulta *legacy unicast*
[x] T101
Allowed Paths: `apps/backend/internal/room/mdns_test.go`
Prohibited Paths: `apps/backend/internal/room/mdns.go`, `apps/backend/go.mod`, `apps/web/**`, `apps/desktop/**`,
`packages/**`
Checks:
- [x] Consulta A `mlab.local` com ID ≠ 0, de porta efêmera, para `224.0.0.251:5353`; exige resposta unicast nessa
  porta com o mesmo ID, a pergunta ecoada e A = IP anunciado (RF-101).
- [x] Consulta AAAA não recebe registro A (RF-103).
- [x] `t.Skip` quando a 5353 ou o multicast não estiverem disponíveis.
- [x] Evidência: com a v0.0.12, `TestMDNSRespondeConsultaLegacyUnicast` falha com "nenhuma resposta unicast à consulta legacy de mlab.local" (Windows 11, Wi-Fi, 2026-11-06; commit `991c954`).

### T102 — Migrar o responder para `pion/mdns/v2`
[x] T102
Depends On: T101
Allowed Paths: `apps/backend/internal/room/mdns.go`, `apps/backend/internal/room/mdns_windows.go`,
`apps/backend/internal/room/mdns_posix.go`, `apps/backend/go.mod`, `apps/backend/go.sum`
Prohibited Paths: `apps/backend/internal/room/handler.go`, `apps/backend/internal/room/origin.go`,
`apps/backend/internal/room/network.go`, `apps/backend/internal/webrtc/**`, `apps/web/**`, `apps/desktop/**`,
`packages/**`
Checks:
- [x] Import `github.com/pion/mdns/v2` v2.2.2; `github.com/pion/mdns` v0.0.12 deixa de ser dependência direta (continua indireta via `pion/ice/v2` do `webrtc/v3`). `go mod tidy` também atualizou `x/net` 0.35, `x/sys` 0.41, `pion/logging` 0.2.4 e moveu `pion/rtp` para dependência direta (já era importado).
- [x] Socket, interfaces, nomes, `LocalAddress` e `Start/StopMDNSServer` sem mudança de comportamento (RF-102, RNF-101).
- [x] T101 e `TestMDNSServerLifecycleAndQuery` passam; `go vet ./...` e `go test ./...` verdes (6 pacotes); `GOOS=linux go vet ./...` e `GOOS=darwin go build ./...` ok. Commit `78c5d5d`.

### T103 — Roteiro do smoke A16
[x] T103
Depends On: T102
Allowed Paths: `docs/metrics/smoke-runbook.md`
Prohibited Paths: `apps/**`, `packages/**`
Checks:
- [x] A16 lista os limites reais (Firefox, Android < 12, isolamento de AP, firewall do Windows) e o diagnóstico rápido; `Resolve-DnsName mlab.local -Type A` conferido contra o servidor (devolveu o IP da Wi-Fi). Commit `00b47f3`.

### T104 — Verificação manual (A16) e converge
[x] T104
Depends On: T102, T103
Allowed Paths: `spec-kit/specs/010-mdns-celular/**`
Prohibited Paths: `apps/**`, `packages/**`
Checks:
- [x] A16 executado: `mlab.local` abre a sala no Chrome e no Safari de celulares de alunos (responsável, 2026-11-06). Link por IP não foi reverificado: código intocado (`handler.go`).
- [x] `converge.md` com o resultado, as pendências e o nível de versão (PATCH, 1.9.1). Resultado: CONVERGED.
