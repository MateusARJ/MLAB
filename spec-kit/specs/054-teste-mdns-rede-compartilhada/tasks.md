# Tasks: Teste da Sondagem mDNS Isolado da Rede

Feature: `054-teste-mdns-rede-compartilhada`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: IN PROGRESS

Regras:
- `go vet ./...` e `go test ./...` em `apps/backend` verdes antes de marcar `[x]`;
- um commit atômico por task, com `Ref: T540x` e `Refs #164`.

### T5401 — Nomes únicos no teste da sondagem
[ ] T5401
Allowed Paths: `apps/backend/internal/room/mdns_probe_test.go`,
`spec-kit/specs/054-teste-mdns-rede-compartilhada/tasks.md`
Prohibited Paths: `apps/backend/internal/room/mdns_probe.go`, `apps/backend/internal/room/mdns_test.go`,
`apps/backend/cmd/**`, `apps/desktop/**`, `apps/web/**`, `packages/**`
Checks:
- [ ] Nomes `mlab-teste-<8 hex>.local`, `-2`, `-3` gerados por execução, usados nos responders e no `probe` (RF-5401).
- [ ] Asserções e limite de 1,5 s iguais (RF-5402).
- [ ] `-count=5` verde com o MLab do professor anunciando `mlab.local` na LAN; `go vet` e `go test ./...` verdes
  (RNF-5402).

### T5402 — Converge
[ ] T5402
Depends On: T5401
Allowed Paths: `spec-kit/specs/054-teste-mdns-rede-compartilhada/**`
Prohibited Paths: `apps/**`, `packages/**`, `.github/**`, `spec-kit/docs/adrs/**`
Checks:
- [ ] `converge.md` com evidências e impacto de versão (nenhum, C-5402).
- [ ] `npm run spec:check -- spec-kit/specs/054-teste-mdns-rede-compartilhada` com PASS.
