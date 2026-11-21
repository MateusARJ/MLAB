# Tasks: Remoção do Pacote Linux tar.gz

Feature: `055-pacote-linux-tar-gz`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: IN PROGRESS

Regras:
- um commit atômico por task, com `Ref: T550x` e `Refs #169`.

### T5501 — Remover o tar.gz da configuração de build
[ ] T5501
Allowed Paths: `apps/desktop/package.json`, `.github/workflows/build-all.yml`,
`spec-kit/specs/055-pacote-linux-tar-gz/tasks.md`
Prohibited Paths: `scripts/**`, `apps/desktop/src/**`, `apps/web/**`, `apps/backend/**`, `packages/**`
Checks:
- [ ] `build.linux.target` com `AppImage` e `deb` (RF-5501).
- [ ] `release_files` da perna Linux com `*.AppImage` e `*.deb` (RF-5502).
- [ ] `npm run make:linux` gera `.AppImage` e `.deb`; job "Build linux" verde no PR (RNF-5502).

### T5502 — Deixar de anunciar o tar.gz na documentação
[ ] T5502
Depends On: T5501
Allowed Paths: `README.md`, `docs/versionamento.md`, `spec-kit/specs/055-pacote-linux-tar-gz/tasks.md`
Prohibited Paths: `docs/releases/**`, `apps/**`, `packages/**`, `.github/**`
Checks:
- [ ] README indica o AppImage para outras distribuições e a tabela de builds lista `.AppImage` e `.deb` (RF-5503).
- [ ] `docs/versionamento.md` §5 lista só `.AppImage` e `.deb` no Linux (RF-5503).
- [ ] `git grep "tar.gz"` sem menção ao pacote Linux do app fora das notas antigas e do `Source code (tar.gz)`.

### T5503 — Converge
[ ] T5503
Depends On: T5502
Allowed Paths: `spec-kit/specs/055-pacote-linux-tar-gz/**`
Prohibited Paths: `apps/**`, `packages/**`, `.github/**`, `spec-kit/docs/adrs/**`
Checks:
- [ ] `converge.md` com evidências e impacto de versão (PATCH, C-5502).
- [ ] `npm run spec:check -- spec-kit/specs/055-pacote-linux-tar-gz` com PASS.
