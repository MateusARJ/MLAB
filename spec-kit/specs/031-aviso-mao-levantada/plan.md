# Plan: Aviso de Mão Levantada Clicável e Sincronizado com a Fila

Feature: `031-aviso-mao-levantada`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-3101 a C-3104)

## 1. Summary

```text
previewArea (position: relative)
├── annotationToolbarLeft  zIndex 25
├── palettePopoverBox      zIndex 30
├── previewStageBox (sem zIndex → sem contexto próprio)
│   ├── vídeo / selos      zIndex ≤ 10
│   └── annotation-canvas  zIndex 15
└── handToastOverlay       zIndex 10 → 20 (RF-3101)

useWebRTCPublisher
  hand-updated raised:false ──► clearHandToastOnLower(toast, id)        (RF-3103)
  lowerStudentHand(id)      ──► clearHandToastOnLower(toast, id)        (RF-3104)
  participants-update       ──► clearHandToastOnParticipants(toast, ps) (RF-3105)
```

1. `Room.tsx`: `handToastOverlay.zIndex` 10 → 20, com comentário da ordem de camadas.
2. `hooks/handToast.ts` (novo): tipo `HandToast` e funções puras `clearHandToastOnLower` e
   `clearHandToastOnParticipants`, que devolvem o mesmo objeto quando nada muda.
3. `useWebRTCPublisher.ts`: aplica as funções via `setLastHandRaised(prev => ...)` nos três caminhos.
4. Testes: `hooks/handToast.test.ts` (novo) e um caso novo em `pages/RoomHandRaise.test.tsx`.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Camada | `zIndex: 20` no aviso (acima de 15, abaixo de 25/30) | C-3103 |
| Mão do aviso abaixada com fila | aviso some | C-3101 |
| Abrir painel | só oculta, como hoje | C-3102 |
| Regra de limpeza | função pura em módulo próprio, aplicada com updater funcional do `useState` | RNF-3101 |
| Teste de camada | `element.style.zIndex` inline do aviso × canvas × barra, por ferramenta | C-3104 |
| Versão | PATCH via `npm run bump -- patch` | C-3104 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| `participants-update` chegar antes do `hand-updated` correspondente | aviso removido e recriado na ordem certa | a função só remove quando a lista mostra o aluno ausente ou de mão abaixada; o `hand-updated` com `raised: true` recria |
| Aviso cobrir área de desenho no canto superior direito | traço não começa sob o aviso | aceito (critério "fora da área do aviso"); o aviso pode ser dispensado |
| Conflito com a UI 2.0 (#92) em `Room.tsx` | conflito de merge nos estilos | mudança de uma linha; rebase de quem entrar depois |

## Scope Lock

### IN

- camada do aviso de mão levantada na prévia do professor;
- limpeza do aviso nos três caminhos de mão abaixada;
- testes de componente e unitários;
- nota na US-11 da 003;
- incremento PATCH.

### OUT

- backend, web, `packages/**`, contratos;
- próxima mão no aviso; dispensar ao abrir o painel;
- eventos do canvas e lupa/foco;
- visual do aviso (UI 2.0).

### Allowed Paths

- `apps/desktop/src/renderer/pages/Room.tsx`, `apps/desktop/src/renderer/pages/RoomHandRaise.test.tsx`
- `apps/desktop/src/renderer/hooks/handToast.ts`, `apps/desktop/src/renderer/hooks/handToast.test.ts`
- `apps/desktop/src/renderer/hooks/useWebRTCPublisher.ts`
- `spec-kit/specs/031-aviso-mao-levantada/**`, `spec-kit/specs/003-classroom-interaction/spec.md` (nota na US-11)
- só na T3104, via `npm run bump`: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`

### Prohibited Paths

- `apps/backend/**`, `apps/web/**`, `packages/**` (fora da T3104)
- `apps/desktop/src/main/**`, `apps/desktop/src/preload/**`
- `spec-kit/specs/003-classroom-interaction/contracts/**`, `spec-kit/docs/adrs/**`, `docs/requirements/**`,
  `.github/**`

### Dependencies

- Nenhuma nova. Vitest e Testing Library já usados no desktop.

### Non-Goals

- teste e2e com clique real no desktop;
- escala de camadas unificada para a prévia.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: nenhuma autorização muda; abaixar mão continua validado no servidor.
- [x] Princípio III: SFU intocada.
- [x] Princípio IV: nenhuma meta de desempenho declarada.
- [x] Princípio V: contratos inalterados.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: uma linha de estilo e duas funções puras.
- [ ] Princípio VIII: converge ao final (T3104).
- [x] Princípio IX: origem na issue #90.

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-14 | Aviso some quando a mão dele é abaixada, mesmo com fila | C-3101 |
| 2026-11-14 | Abrir o painel só oculta | C-3102 |
| 2026-11-14 | `zIndex: 20` no aviso | C-3103 |
| 2026-11-14 | Testes sem Playwright; IDs `310x`; PATCH | C-3104 |
