# Tasks: Entrada Única do Web do Aluno no Modo de Desenvolvimento

Feature: `008-dev-entrada-unica-web`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: READY-FOR-IMPLEMENTATION

### T801 — Redirecionar as páginas da 8080 para o Vite no modo de desenvolvimento
[x] T801
Allowed Paths: `apps/backend/cmd/server/main.go`, `apps/backend/cmd/server/main_test.go`
Prohibited Paths: `apps/backend/internal/**`, `apps/web/**`, `apps/desktop/**`, `packages/**`, `scripts/**`, `turbo.json`
Checks:
- [x] `GET`/`HEAD` fora da API → `307` para `http://<host>:<WEB_PORT|5173><caminho e query>`, inclusive IPv6 (RF-801).
- [x] Outros métodos fora da API → `404` (RF-802).
- [x] Sem `MLAB_DEV_MONOREPO=1`, `spaHandler` como hoje (RF-803).
- [x] `/health` e rotas de API respondem no modo de desenvolvimento (RNF-801).
- [x] `go test ./...` do backend verde e smoke (`-tags smoke`) verde em 2026-11-02.

### T802 — Verificação manual e converge
[x] T802
Depends On: T801
Allowed Paths: `spec-kit/specs/008-dev-entrada-unica-web/**`
Prohibited Paths: `apps/**`, `packages/**`
Checks:
- [x] No `npm run dev`, `http://<ip>:8080/` e o link da sala com a porta 8080 abrem a página da 5173 (confirmado pelo responsável em 2026-11-02).
- [x] `converge.md` da 008.
