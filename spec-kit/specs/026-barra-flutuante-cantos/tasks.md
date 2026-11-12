# Tasks: Barra Flutuante de Marcação nos Cantos da Tela

Feature: `026-barra-flutuante-cantos`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: IN PROGRESS

Regras:
- `npm run test -w apps/desktop` e `npm run lint` verdes antes de marcar `[x]`;
- um commit atômico por task, com `Ref: T260x` e `Refs #78`.

### T2601 — Posições separadas, âncora e limite à tela
[x] T2601
Allowed Paths: `apps/desktop/src/renderer/components/FloatingAnnotationOverlay.tsx`,
`spec-kit/specs/003-classroom-interaction/spec.md` (só a nota da 026)
Prohibited Paths: `apps/desktop/src/main/**`, `apps/desktop/src/preload/**`, `apps/desktop/src/renderer/pages/**`,
`packages/**`, `apps/web/**`, `apps/backend/**`, `package.json`
Checks:
- [x] `clampToolbarPos` e `computeExpandedToolbarPos` exportadas com as regras da RF-2603/RF-2604.
- [x] Posições da bolinha e da barra aberta separadas em `sessionStorage` (RF-2601).
- [x] Transição única para botão, bolinha, `toggle-collapse`, tecla `h` e sincronização (RF-2602, RF-2605).
- [x] Arrastar a bolinha invalida a posição salva da barra aberta; arrastar a barra aberta só muda a dela (RF-2606).
- [x] Orientação da barra aberta fixada na expansão; ajuste pelo tamanho medido sem trocar a orientação (RF-2604).
- [x] `toolbarPos` enviado ao main é sempre a posição visível (RNF-2601); testes existentes verdes.

### T2602 — Testes da barra nos cantos
[ ] T2602
Depends On: T2601
Allowed Paths: `apps/desktop/src/renderer/components/FloatingAnnotationOverlay.test.tsx`
Prohibited Paths: `apps/desktop/src/renderer/components/FloatingAnnotationOverlay.tsx`, `apps/desktop/src/main/**`,
`apps/desktop/src/renderer/pages/**`, `packages/**`, `apps/web/**`, `apps/backend/**`, `package.json`
Checks:
- [ ] Unitários: bolinha nos quatro cantos e bordas, em 1920×1080 e 1366×768, expande dentro da tela e com a orientação
  da zona da bolinha (RF-2603, RF-2604).
- [ ] Componente: canto inferior direito expande dentro; arrastar barra aberta e minimizar devolve a bolinha; reexpandir
  sem mover volta à barra aberta; mover a bolinha e reexpandir ancora; minimizar por sync e por atalho restaura;
  popover dentro da tela; barra vertical ancorada pela base continua vertical (RF-2601 a RF-2606).
- [ ] `npm run test -w apps/desktop` e `npm run lint` verdes.

### T2603 — Verificação manual no Windows
[ ] T2603
Depends On: T2602
Allowed Paths: `spec-kit/specs/026-barra-flutuante-cantos/**`
Prohibited Paths: `apps/**`, `packages/**`, `package.json`
Checks:
- [ ] Bolinha nos quatro cantos: expandir mostra a barra inteira; minimizar volta ao ponto (US-2601, US-2602).
- [ ] Arrastar a barra aberta, minimizar e reexpandir; `Alt+H`; com e sem mão levantada; popover de cores aberto.

### T2604 — Converge e versão
[ ] T2604
Depends On: T2603
Allowed Paths: `spec-kit/specs/026-barra-flutuante-cantos/**`, `package.json`, `package-lock.json`,
`apps/*/package.json`, `packages/*/package.json`
Prohibited Paths: `apps/**/src/**`, `packages/**/src/**`, `.github/**`
Checks:
- [ ] `converge.md` com evidências, desvios e impacto de versão (PATCH, C-2604).
- [ ] `npm run bump -- patch` e `npm run version:check`; commit `chore(release): versao X.Y.Z`.
- [ ] `npm run spec:check -- spec-kit/specs/026-barra-flutuante-cantos` com PASS.
