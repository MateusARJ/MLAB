# Tasks: Controles do Aluno no Celular

Feature: `043-controles-aluno-celular`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: READY

Regras:
- `npm test` e `npm run lint` em `apps/web` verdes antes de marcar `[x]`;
- um commit atômico por task, com `Ref: T430x` e `Refs #98`.

### T4301 — Barra do vídeo sem sobreposição e X único em tela cheia
[ ] T4301
Allowed Paths: `apps/web/src/pages/Room.tsx`, `apps/web/src/pages/Room.test.tsx`, `apps/web/src/index.css`,
`spec-kit/specs/043-controles-aluno-celular/tasks.md`
Prohibited Paths: `apps/web/src/hooks/**`, `apps/web/src/services/**`, `apps/web/e2e/**`, `apps/desktop/**`,
`apps/backend/**`, `packages/**`, `package.json`
Checks:
- [ ] Pílula e grupo PiP / Tela Cheia no mesmo contêiner flexível com `gap: 8px`, espaçador e grupo sem encolher
  (RF-4301, RF-4302).
- [ ] Rótulo curto "Abaixar mão" e padding de 16 px até 400 px, por CSS; nomes acessíveis iguais (RF-4303).
- [ ] Barra com `pointer-events: none` e controles com `auto` (RF-4304).
- [ ] Cabeçalho da sidebar em tela cheia sem botão de fechar, com espaço para o gatilho (RF-4305, RF-4307).
- [ ] Gatilho com `aria-expanded`, `aria-controls` e rótulo por estado (RF-4306).
- [ ] Testes novos em `Room.test.tsx`: estrutura da barra, rótulos completo/curto, X único e `aria-expanded`;
  testes existentes verdes (RNF-4302).
- [ ] Verificação visual em 320, 360 e 390 px (retrato, normal e ativo), paisagem em tela cheia com menu aberto e
  desktop 1280 px.
- [ ] `npm run test:e2e` em `apps/web`: A10 e A15 verdes (RNF-4302).

### T4302 — Converge
[ ] T4302
Depends On: T4301
Allowed Paths: `spec-kit/specs/043-controles-aluno-celular/**`
Prohibited Paths: `apps/**`, `packages/**`, `.github/**`, `spec-kit/docs/adrs/**`
Checks:
- [ ] `converge.md` com evidências, desvios e impacto de versão (PATCH, C-4303).
- [ ] `npm run spec:check -- spec-kit/specs/043-controles-aluno-celular` com PASS.

### T4303 — Versão
[ ] T4303
Depends On: T4302
Allowed Paths: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`,
`spec-kit/specs/043-controles-aluno-celular/tasks.md`
Prohibited Paths: `apps/**/src/**`, `packages/**/src/**`, `.github/**`
Checks:
- [ ] `npm run bump -- patch` e `npm run version:check`; commit `chore(release): versao X.Y.Z`.
