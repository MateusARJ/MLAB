# Tasks: Lint de Tipos do App Desktop sem Erros

Feature: `020-lint-tipos-desktop`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: READY

Regras:
- `npx tsc --noEmit -p .` em `apps/desktop` antes e depois de cada task: a contagem de erros só cai;
- um commit atômico por task, com `Ref: T200x` e `Refs #51`.

### T2001 — Remover import morto do main
[ ] T2001
Allowed Paths: `apps/desktop/src/main/main.ts`
Prohibited Paths: `apps/desktop/src/main/preload.ts`, `apps/desktop/src/main/cursorPresence.ts`, `apps/web/**`,
`apps/backend/**`, `packages/**`, `package.json`
Checks:
- [ ] `systemPreferences` fora do import de `electron` (RF-2001).
- [ ] `tsc`: 14 → 13 erros.

### T2002 — Limpar o worker do cursor e corrigir o tipo do canvas
[ ] T2002
Depends On: T2001
Allowed Paths: `apps/desktop/src/renderer/media/cursorMask.worker.ts`
Prohibited Paths: `apps/desktop/src/renderer/media/createCursorMaskedTrack.ts`, `apps/desktop/src/renderer/hooks/**`,
`packages/**`, `package.json`
Checks:
- [ ] Sobras do inpainting removidas (C-2003); `state.rect` continua alimentando a lupa (RNF-2001).
- [ ] `ensureOutCanvas` devolve `{ canvas, ctx } | null`, sem `as` nem `!` (RF-2001).
- [ ] Caminho sem sobreposição continua repassando o quadro sem cópia (RNF-2001).
- [ ] `tsc`: 13 → 3 erros; testes de `src/renderer/media` verdes.

### T2003 — Remover o estado do selo de privacidade da sala
[ ] T2003
Depends On: T2002
Allowed Paths: `apps/desktop/src/renderer/pages/Room.tsx`, `apps/desktop/src/renderer/pages/Room.test.tsx`
Prohibited Paths: `apps/desktop/src/main/**`, `apps/desktop/src/test/setup.ts`, `spec-kit/specs/*/contracts/**`,
`packages/**`, `package.json`
Checks:
- [ ] Estado, setters e assinatura de `onActiveWindowUnauthorized` fora do `Room.tsx` (RF-2002, C-2001).
- [ ] Teste de múltiplas janelas sem o callback `unauthorized`, mantendo a asserção de que o selo não aparece e as de
  troca de janela (RF-2002).
- [ ] `grep "Proteção de Privacidade\|privacyShield" apps/desktop/src` só acha a asserção negativa.
- [ ] `tsc`: 3 → 2 erros; `Room.test.tsx` verde.

### T2004 — Completar os mocks do publisher
[ ] T2004
Depends On: T2003
Allowed Paths: `apps/desktop/src/renderer/pages/Room.test.tsx`
Prohibited Paths: `apps/desktop/src/renderer/pages/Room.tsx`, `apps/desktop/src/renderer/hooks/**`, `packages/**`,
`package.json`
Checks:
- [ ] `stopPublishing: vi.fn()` nos dois mocks apontados pelo `tsc` (RF-2001).
- [ ] `tsc`: 0 erros; `npm run lint` na raiz com código 0; suíte do desktop verde.

### T2005 — Lint no CI
[ ] T2005
Depends On: T2004
Allowed Paths: `.github/workflows/build-all.yml`
Prohibited Paths: `apps/**`, `packages/**`, `package.json`, demais arquivos de `.github/**`
Checks:
- [ ] Etapa `npm run lint` entre "Compilar pacotes compartilhados" e "Executar testes automatizados" (RF-2003).
- [ ] Gatilhos do workflow inalterados (C-2004).

### T2006 — Converge e versão
[ ] T2006
Depends On: T2005
Allowed Paths: `spec-kit/specs/020-lint-tipos-desktop/**`, `package.json`, `package-lock.json`,
`apps/*/package.json`, `packages/*/package.json`
Prohibited Paths: `apps/**/src/**`, `packages/**/src/**`, `.github/**`
Checks:
- [ ] `converge.md` com evidências, desvios e impacto de versão (PATCH, C-2006).
- [ ] `npm run bump -- patch` (1.12.1) e `npm run version:check`; commit `chore(release): versao 1.12.1`.
- [ ] `npm run spec:check` com PASS.
