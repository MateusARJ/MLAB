# Tasks: Aviso de Mão Levantada Responsivo

Feature: `006-banner-mao-levantada`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: READY-FOR-IMPLEMENTATION

Regra de cada task: suíte normal verde (`npx turbo run test --force`) antes do `[x]`.

### T601 — Layout e Design System do aviso (#5)
[x] T601
Allowed Paths: `apps/web/src/pages/Room.tsx`, `apps/web/src/pages/Room.test.tsx`
Prohibited Paths: `apps/web/src/hooks/**`, `apps/web/src/pages/Join.tsx`, `apps/backend/**`, `apps/desktop/**`, `packages/**`
Checks:
- [x] Aviso com `width: max-content` e `maxWidth: calc(100% - 32px)`, centralizado (RF-601).
- [x] Ícone com `flexShrink: 0` e 16 px; rótulo do botão sem quebra (RF-602).
- [x] Botão `Button` de `@mlab/ui`; cores, borda e raio de `colors`/`radii` (RF-603).
- [x] `role="status"`, texto e `toggleHand(false)` com `stopPropagation` mantidos (RNF-601).
- [x] Teste de `Room` atualizado (vitest 40 verdes, tsc ok); captura em 360 px: texto em 2 linhas, ícone visível, botão sem quebra.

### T602 — Verificação mobile no E2E A15
[ ] T602
Depends On: T601
Allowed Paths: `apps/web/e2e/aluno.e2e.ts`
Prohibited Paths: `apps/web/e2e/fixtures.ts`, `apps/web/playwright.config.ts`, `apps/web/src/**`
Checks:
- [ ] A15 roda também no projeto mobile (`@mobile`) e confere que o aviso tem largura maior que metade da área do vídeo.
- [ ] `npm run test:e2e -w @mlab/web` executado e resultado registrado.

### T603 — Converge
[ ] T603
Depends On: T601, T602
Allowed Paths: `spec-kit/specs/006-banner-mao-levantada/**`
Prohibited Paths: `apps/**`, `packages/**`
Checks:
- [ ] Capturas antes/depois no celular (360 px) registradas no converge.
- [ ] `converge.md` da 006 criado.
