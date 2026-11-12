# Tasks: Lista de Arquivos do Celular na Altura da Gaveta

Feature: `024-lista-arquivos-celular`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: DONE

Regras:
- `npm run test -w apps/web` e `npm run lint` verdes antes de marcar `[x]`;
- um commit atômico por task, com `Ref: T240x` e `Refs #65`.

### T2401 — Web: lista do celular ocupa a altura da gaveta
[x] T2401
Allowed Paths: `apps/web/src/pages/Room.tsx`, `apps/web/src/pages/Room.test.tsx`,
`spec-kit/specs/003-classroom-interaction/spec.md`
Prohibited Paths: `apps/web/src/hooks/**`, `apps/web/src/services/**`, `apps/web/src/components/**`,
`apps/web/index.html`, `apps/web/public/**`, `apps/backend/**`, `apps/desktop/**`, `packages/**`, `package.json`
Checks:
- [x] Celular: a lista da aba Arquivos (`mobile-files-list`) não tem `max-height: 380px`, tem `flex: 1` e
  `overflow-y: auto`; a moldura não tem `overflow-y: auto` (RF-2401).
- [x] Desktop: a lista da gaveta (`files-list`) mantém `max-height: 380px` (RF-2402).
- [x] Os testes de rolagem automática da 018 continuam verdes (RF-2403).
- [x] Nota de referência à 024 na US-16 da 003.
- [x] `npm run test -w apps/web` e `npm run lint` verdes.

### T2402 — Verificação manual no celular
[x] T2402
Depends On: T2401
Allowed Paths: `spec-kit/specs/024-lista-arquivos-celular/**`
Prohibited Paths: `apps/**`, `packages/**`, `package.json`
Checks:
- [x] Celular real (ou emulação 375×812 e 412×915) com 10+ arquivos: a lista vai até o fim da gaveta e rola (RF-2401).
- [x] Arquivo novo com a aba aberta: a lista rola até ele (RF-2403).
- [x] Desktop 1280px: gaveta "Arquivos da Aula" igual à anterior (RF-2402).

### T2403 — Converge e versão
[x] T2403
Depends On: T2402
Allowed Paths: `spec-kit/specs/024-lista-arquivos-celular/**`, `package.json`, `package-lock.json`,
`apps/*/package.json`, `packages/*/package.json`
Prohibited Paths: `apps/**/src/**`, `apps/backend/internal/**`, `packages/**/src/**`, `.github/**`
Checks:
- [x] `converge.md` com evidências, desvios e impacto de versão (PATCH, C-2403).
- [x] `npm run bump -- patch` e `npm run version:check`; commit `chore(release): versao X.Y.Z`.
- [x] `npm run spec:check -- spec-kit/specs/024-lista-arquivos-celular` com PASS.
