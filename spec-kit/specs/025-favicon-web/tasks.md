# Tasks: Favicon Próprio do Web App dos Alunos

Feature: `025-favicon-web`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: READY

Regras:
- `npm run test -w apps/web` e `npm run lint` verdes antes de marcar `[x]`;
- um commit atômico por task, com `Ref: T250x` e `Refs #68`.

### T2501 — Favicon SVG e fallbacks PNG
[x] T2501
Allowed Paths: `apps/web/public/favicon.svg`, `apps/web/public/favicon-32.png`, `apps/web/public/apple-touch-icon.png`
Prohibited Paths: `apps/web/public/MLAB-logo.png`, `apps/web/src/**`, `apps/web/index.html`, `apps/desktop/**`,
`apps/backend/**`, `packages/**`, `package.json`
Checks:
- [x] `favicon.svg` com `viewBox="0 0 32 32"`, fundo arredondado `#0f172a`, só o símbolo, sem `<text>`/`<image>`,
  < 2 KB (RF-2501, RF-2502, RNF-2502).
- [x] `favicon-32.png` 32×32 e `apple-touch-icon.png` 180×180 opaco, gerados do SVG fora do repositório (RF-2503,
  RNF-2501).
- [x] Prévia conferida em 16, 32 e 180px sobre fundo branco e escuro.

### T2502 — Links no index.html e teste
[x] T2502
Depends On: T2501
Allowed Paths: `apps/web/index.html`, `apps/web/src/favicon.test.ts`
Prohibited Paths: `apps/web/public/**`, `apps/web/src/pages/**`, `apps/web/src/components/**`, `apps/desktop/**`,
`apps/backend/**`, `packages/**`, `package.json`
Checks:
- [x] `index.html` declara o PNG 32×32, o SVG e o `apple-touch-icon`; não referencia mais `MLAB-logo.png` como ícone
  (RF-2504).
- [x] `favicon.test.ts` cobre links, existência dos arquivos, SVG sem texto e tamanhos dos PNGs (§11).
- [x] `npm run test -w apps/web`, `npm run lint` e `npm run build -w apps/web` verdes; os três ícones estão em `dist/`.

### T2503 — Verificação manual nos navegadores
[ ] T2503
Depends On: T2502
Allowed Paths: `spec-kit/specs/025-favicon-web/**`
Prohibited Paths: `apps/**`, `packages/**`, `package.json`
Checks:
- [ ] Chrome, Firefox e Edge, tema claro e escuro: ícone nítido e com contraste na aba (RF-2501, RF-2502).
- [ ] Logo das páginas de entrada e da sala sem mudança (RF-2504).

### T2504 — Converge e versão
[ ] T2504
Depends On: T2503
Allowed Paths: `spec-kit/specs/025-favicon-web/**`, `package.json`, `package-lock.json`, `apps/*/package.json`,
`packages/*/package.json`
Prohibited Paths: `apps/**/src/**`, `apps/web/public/**`, `apps/web/index.html`, `packages/**/src/**`, `.github/**`
Checks:
- [ ] `converge.md` com evidências, desvios e impacto de versão (PATCH, C-2504).
- [ ] `npm run bump -- patch` e `npm run version:check`; commit `chore(release): versao X.Y.Z`.
- [ ] `npm run spec:check -- spec-kit/specs/025-favicon-web` com PASS.
