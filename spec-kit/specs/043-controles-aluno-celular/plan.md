# Plan: Controles do Aluno no Celular

Feature: `043-controles-aluno-celular`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-4301 a C-4303)

## 1. Summary

```text
barra inferior do vídeo (position: absolute; left/right/bottom: 16px; display: flex; gap: 8px; pointer-events: none)
┌───────────┬──────────────────────────────┬─────────────┐
│ espaçador │   slot (flex 1 1 auto)        │ grupo PiP / │
│ 0 100 90px│   [ ✋ Levantar mão ]          │ Tela Cheia  │
│ (encolhe  │   centrado, min-width 0,      │ flex-shrink │
│ primeiro) │   texto com reticências       │ 0           │
└───────────┴──────────────────────────────┴─────────────┘

tela cheia: gatilho ☰/X (aria-expanded, aria-controls) ── sidebar sem botão de fechar no cabeçalho
```

1. `apps/web/src/pages/Room.tsx`:
   - `videoBottomBar` com espaçador, slot da pílula e grupo; `handPos` sai; `videoOverlayControls` perde o
     posicionamento absoluto; pílula com `className="ml-hand-btn"`, `minWidth: 0`, `maxWidth: 100%` e rótulos
     completo/curto em `<span>`.
   - gatilho com `aria-expanded`, `aria-controls="fullscreen-right-sidebar"`, rótulo por estado; `<aside>` com
     `id`; cabeçalho sem `closeDrawerBtn` e com `paddingRight` para o gatilho.
2. `apps/web/src/index.css`: `.ml-hand-btn` (padding), `.ml-hand-label`, `.ml-hand-label-short` e `@media (max-width:
   400px)`.
3. `apps/web/src/pages/Room.test.tsx`: testes novos.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Linha flexível | espaçador `flex: 0 100 90px`, slot `flex: 1 1 auto`, grupo `flex-shrink: 0`, `gap: 8px` | C-4302 |
| Rótulo curto e padding | CSS com `@media (max-width: 400px)` em `index.css` | C-4302 |
| Cliques | barra `pointer-events: none`; pílula e grupo `auto` | RF-4304 |
| Menu em tela cheia | só o gatilho; `aria-expanded`/`aria-controls`; cabeçalho com `paddingRight: 64px` | C-4301 |
| Versão | PATCH | C-4303 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| jsdom não mede layout | testes não provam o espaçamento | testes de estrutura + verificação visual registrada no converge |
| Padding inline sobrepõe a classe | media query sem efeito | padding sai do estilo inline e fica só na classe |
| Rótulo duplicado lido por leitores de tela | anúncio repetido | `aria-label` do botão prevalece; spans só visuais |

## Scope Lock

### IN

- barra inferior do vídeo, pílula de levantar mão, gatilho e cabeçalho do menu em tela cheia no web do aluno.

### OUT

- drawers de Arquivos e Chat; lógica de mão, PiP, tela cheia; desktop; backend; `packages/`.

### Allowed Paths

- `apps/web/src/pages/Room.tsx`, `apps/web/src/pages/Room.test.tsx`, `apps/web/src/index.css`
- `spec-kit/specs/043-controles-aluno-celular/**`
- só na T4303, via `npm run bump`: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`

### Prohibited Paths

- `apps/web/src/hooks/**`, `apps/web/src/services/**`, `apps/web/e2e/**`, `apps/desktop/**`, `apps/backend/**`,
  `packages/**/src/**`
- `spec-kit/docs/adrs/**`, `.github/**`, `docs/**`

### Dependencies

- Nenhuma nova.

### Non-Goals

- redesenhar a barra do vídeo ou o menu em tela cheia;
- mudar os rótulos no desktop.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: nenhuma regra de autorização muda.
- [x] Princípio III: SFU intocada.
- [x] Princípio IV: nenhuma meta de desempenho declarada.
- [x] Princípio V: nenhum contrato muda.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: mudança restrita a estilos e marcação do `Room`.
- [ ] Princípio VIII: converge ao final (T4302).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-16 | Manter o gatilho flutuante e remover o X do cabeçalho | C-4301 |
| 2026-11-16 | Linha flexível com espaçador e rótulo curto por CSS | C-4302 |
| 2026-11-16 | Uma feature, um PR, IDs `430x`, PATCH | C-4303 |
