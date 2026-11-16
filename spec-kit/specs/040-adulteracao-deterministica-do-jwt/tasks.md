# Tasks: Adulteração Determinística do JWT no Teste de Segurança

Feature: `040-adulteracao-deterministica-do-jwt`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: IN PROGRESS

Regras:
- antes de marcar `[x]`: `go test ./...` e `go vet ./...` em `apps/backend`, e `gofmt -l` vazio nos arquivos Go
  alterados;
- um commit atômico por task, com `Ref: T400x` e `Refs #116`.

### T4001 — Adulterar a claim `role` no teste
[ ] T4001
Allowed Paths: `apps/backend/internal/auth/auth_security_test.go`,
`spec-kit/specs/040-adulteracao-deterministica-do-jwt/tasks.md`
Prohibited Paths: `apps/backend/internal/auth/jwt.go`, `apps/backend/internal/auth/middleware.go`,
`apps/backend/internal/auth/handler.go`, `apps/backend/internal/signaling/**`, `apps/backend/cmd/**`, `apps/web/**`,
`apps/desktop/**`, `packages/**`, `package.json`
Checks:
- [ ] O teste troca `role` de `aluno` para `professor` no payload e mantém header e assinatura (RF-4001).
- [ ] O teste confere que o token adulterado difere do original e exige erro do `ParseToken` (RF-4002).
- [ ] `go test -count=1000 -run TestAuthSecurity_ClaimManipulation ./internal/auth/` e 200 execuções em segundos
  diferentes sem falha (RNF-4001).
- [ ] `go vet ./...` e `go test -count=1 ./...` verdes.

### T4002 — Converge
[ ] T4002
Depends On: T4001
Allowed Paths: `spec-kit/specs/040-adulteracao-deterministica-do-jwt/**`
Prohibited Paths: `apps/**`, `packages/**`, `.github/**`, `spec-kit/docs/adrs/**`
Checks:
- [ ] `converge.md` com evidências, desvios e impacto de versão (sem incremento, C-4002).
- [ ] `npm run spec:check -- spec-kit/specs/040-adulteracao-deterministica-do-jwt` com PASS.
