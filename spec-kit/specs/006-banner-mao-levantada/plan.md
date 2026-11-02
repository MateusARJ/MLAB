# Plan: Aviso de Mão Levantada Responsivo

Feature: `006-banner-mao-levantada`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (CLOSED — C-601, C-602)

## 1. Summary

1. **Layout (RF-601, RF-602)** — em `apps/web/src/pages/Room.tsx`, o estilo `handRaisedBanner` troca a largura
   implícita por `width: 'max-content'` com `maxWidth: 'calc(100% - 32px)'` e `boxSizing: 'border-box'`, mantendo o
   centro por `left: 50%` + `translateX(-50%)`. O conteúdo passa a quebrar em linha (`flexWrap: 'wrap'`) com o botão
   alinhado à direita; o ícone fica num contêiner com `flexShrink: 0` e o rótulo do botão com `whiteSpace: 'nowrap'`.
2. **Design System (RF-603)** — o botão vira `<Button variant="secondary" size="sm">` de `@mlab/ui`; fundo, borda,
   raio e cor do texto vêm de `colors` e `radii`.
3. **Testes** — `Room.test.tsx` cobre a largura máxima, o ícone sem encolher e o clique em "Abaixar mão"; o E2E A15
   ganha uma verificação mobile da largura do aviso.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Largura | `max-content` limitado a `calc(100% - 32px)` da área do vídeo | C-601 |
| Ícone | contêiner `inline-flex` com `flexShrink: 0`, `Touch_1Filled size={16}` | RF-602 |
| Botão | `Button` (`secondary`, `sm`) de `@mlab/ui`, `whiteSpace: 'nowrap'` | C-602 |
| Cores | `colors.surfaceCardSolid`, `colors.primary`, `colors.textPrimary`, `radii.md` | C-602 |
| Acessibilidade | mantém `role="status"`; o clique do botão segue com `stopPropagation` | RNF-601 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Aviso cobrir os controles no landscape mobile | controles inacessíveis | aviso no topo e controles no rodapé, como hoje; verificação no E2E mobile |
| `Button` do DS mudar a altura do aviso | aviso maior no desktop | `size="sm"`; conferência visual no desktop |
| Seletores de teste existentes quebrarem | testes falsos | mantém texto, `role="status"` e rótulo do botão |

## Scope Lock

### IN

- estilos e marcação do aviso de mão levantada no web do aluno;
- testes de `Room` e verificação mobile no E2E A15.

### OUT

- protocolo de mão levantada, fila do professor e app desktop;
- botão "Levantar Mão" da barra de controles e da barra lateral;
- `packages/ui`.

### Allowed Paths

- `apps/web/src/pages/Room.tsx`
- `apps/web/src/pages/Room.test.tsx`
- `apps/web/e2e/aluno.e2e.ts`
- `spec-kit/specs/006-banner-mao-levantada/**`

### Prohibited Paths

- `apps/backend/**`, `apps/desktop/**`, `packages/**`
- `apps/web/src/hooks/**`, `apps/web/src/pages/Join.tsx`
- `apps/web/e2e/fixtures.ts`, `apps/web/playwright.config.ts`

### Dependencies

- Nenhuma nova. Existentes: `@mlab/ui` (`Button`, `colors`, `radii`, `Touch_1Filled`), `@playwright/test`.

### Non-Goals

- redesenhar a barra de controles do vídeo ou a sala no celular;
- animações de entrada e saída do aviso;
- mudar o texto do aviso.

## 4. Constitution Check

- [x] Princípio I — spec aprovada.
- [x] Princípio II — nenhuma regra de autorização envolvida.
- [x] Princípio III — SFU intocada.
- [x] Princípio IV — nenhuma meta de desempenho declarada.
- [x] Princípio V — nenhum contrato alterado.
- [x] Princípio VI — Scope Lock e paths por task.
- [x] Princípio VII — sem abstração nova; reutiliza componentes do DS.
- [ ] Princípio VIII — converge ao final (T603).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-02 | Aviso sobre o vídeo com largura total e margem de 16 px | C-601 |
| 2026-11-02 | `Button` e tokens de `@mlab/ui`; `Alert` não usado | C-602 |
