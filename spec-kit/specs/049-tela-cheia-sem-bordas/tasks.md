# Tasks: Tela Cheia do Aluno sem Bordas

Feature: `049-tela-cheia-sem-bordas`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: DONE

Regras:
- `npm test` e `npm run lint` em `apps/web` verdes antes de marcar `[x]`;
- um commit atômico por task, com `Ref: T490x` e `Refs #147`.

### T4901 — Tela cheia sem bordas com modo Preencher/Ajustar
[x] T4901
Allowed Paths: `apps/web/src/pages/Room.tsx`, `apps/web/src/pages/Room.test.tsx`, `packages/ui/src/index.ts`,
`spec-kit/specs/049-tela-cheia-sem-bordas/tasks.md`
Prohibited Paths: `apps/web/src/hooks/**`, `apps/web/src/services/**`, `apps/web/e2e/**`, `apps/desktop/**`,
`apps/backend/**`, `packages/types/**`, `packages/ui/src/*.tsx`, `package.json`
Checks:
- [x] `object-fit` do vídeo: `cover` em tela cheia no modo Preencher, `contain` no modo Ajustar e fora da tela cheia
  (RF-4901, RF-4902); padrão Preencher (RF-4903).
- [x] Item do menu em tela cheia com título, descrição e `aria-label` por estado; não fecha o menu (RF-4904,
  RNF-4902).
- [x] Escolha salva e lida em `mlab-video-fit`, com `try/catch` e padrão para valor inválido (RF-4905).
- [x] Chat e Arquivos fecham ao entrar em tela cheia e reabrem pelo menu (RF-4906).
- [x] Sem `padding-bottom` da área segura em tela cheia no celular; mantido fora dela (RF-4907).
- [x] Sombra do menu da transmissão e da gaveta do celular só com o painel aberto (RF-4908).
- [x] `FillScreen` e `FitScreen` exportados por `packages/ui/src/index.ts` (RNF-4903).
- [x] Testes novos em `Room.test.tsx` para RF-4901 a RF-4908; testes existentes verdes (RNF-4901).
- [x] `npx turbo run build --filter=@mlab/web...` verde.
- [x] Verificação visual em tela cheia: 1920×1080, 2560×1080 e 844×390, nos dois modos, com transmissão 16:9.

### T4902 — Converge
[x] T4902
Depends On: T4901
Allowed Paths: `spec-kit/specs/049-tela-cheia-sem-bordas/**`
Prohibited Paths: `apps/**`, `packages/**`, `.github/**`, `spec-kit/docs/adrs/**`
Checks:
- [x] `converge.md` com evidências, desvios e impacto de versão (MINOR, C-4904).
- [x] `npm run spec:check -- spec-kit/specs/049-tela-cheia-sem-bordas` com PASS.

### T4903 — Versão
[x] T4903
Depends On: T4902
Allowed Paths: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`,
`spec-kit/specs/049-tela-cheia-sem-bordas/tasks.md`
Prohibited Paths: `apps/**/src/**`, `packages/**/src/**`, `.github/**`
Checks:
- [x] `npm run bump -- minor` e `npm run version:check`; commit `chore(release): versao 2.2.0`.
