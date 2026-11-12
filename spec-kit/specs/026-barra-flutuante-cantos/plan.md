# Plan: Barra Flutuante de Marcação nos Cantos da Tela

Feature: `026-barra-flutuante-cantos`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-2601 a C-2604)

## 1. Summary

Tudo em `apps/desktop/src/renderer/components/FloatingAnnotationOverlay.tsx`:

```text
bolinha (bubblePos) ──expandir──► expandedLayout salvo? ──sim──► clamp(expandedLayout.pos), zona salva   (RF-2602)
                                                       └─não──► computeExpandedToolbarPos(bolinha, zona)  (RF-2603)
barra aberta ──minimizar──► clamp(bubblePos)                                                             (RF-2605)
arrastar bolinha ──► bubblePos novo, expandedLayout = null                                               (RF-2606)
arrastar barra aberta ──► expandedLayout = { pos, zona }                                                 (RF-2606)
useLayoutEffect (tamanho medido) ──► re-ancora / limita e envia ao main                                  (RF-2604)
```

1. Funções puras exportadas: `clampToolbarPos(pos, size, vw, vh, margin = 6)` e
   `computeExpandedToolbarPos(bubblePos, bubbleSize, barSize, zone, vw, vh)` (regras da RF-2603 + clamp).
2. Estado no renderer: `toolbarPos` continua sendo a posição visível; novos `bubblePosRef`, `expandedLayoutRef`
   (`{ x, y, zone } | null`), estado `expandedZone` (orientação fixada da barra aberta, C-2603) e
   `pendingAnchorRef` (âncora a refazer com o tamanho medido).
3. `sessionStorage`: `mlab.floatingToolbarPos` (posição visível, como hoje), `mlab.floatingToolbarBubblePos`,
   `mlab.floatingToolbarExpanded`. Sem valor salvo da bolinha, ela usa a posição visível inicial.
4. Transição única `applyCollapsedTransition(base, nextCollapsed)` usada pelo botão de minimizar, pelo clique na
   bolinha, pelo atalho `toggle-collapse`, pela tecla `h` e pelo `onAnnotationStateSync` quando `collapsed` muda
   (nesse caso o `toolbarPos` recebido, que é o antigo repassado pelo main, é ignorado e o calculado é reenviado).
5. Sincronização sem troca de `collapsed`: aplica o `toolbarPos` recebido só se ele for diferente do atual (o eco do
   main é igual e não pode recalcular a orientação, C-2603).
6. Orientação: barra aberta usa `expandedZone` quando definida; bolinha e demais casos seguem
   `computeToolbarDockZone(toolbarPos)` como hoje. O arraste da barra aberta atualiza `expandedZone` pela posição.
7. `useLayoutEffect` (depende de `collapsed`, `toolbarPos`, `raisedHands`, `vw`, `vh`, `expandedZone`) e o
   `ResizeObserver` existente: com tamanho medido > 0 e sem arraste, refaz a âncora pendente ou limita a posição à
   tela; se mudou, salva e envia ao main via `pushStateToMain`.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Medida | `toolbarRef.getBoundingClientRect()`; fallback 52×52 (bolinha), 440×54 / 54×440 (aberta) | RF-2604 |
| Margem | 6px, a mesma do arraste atual | RF-2604 |
| Contrato | `toolbarPos` = posição visível; sem campo novo | C-2602, RNF-2601 |
| Hit-test Linux | `reportToolbarRect` já reage a `toolbarPos`/`collapsed`/orientação | RNF-2602 |
| Testes | vitest + jsdom em `FloatingAnnotationOverlay.test.tsx`, com `innerWidth/innerHeight` e `getBoundingClientRect` simulados | §11 |
| Versão | PATCH via `npm run bump -- patch` | C-2604 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Eco do main com `toolbarPos` antigo ao trocar `collapsed` pela `Room.tsx` | bolinha/barra voltam ao ponto errado | transição detectada no sync ignora o `toolbarPos` recebido (item 4) |
| Laço de ajuste no `useLayoutEffect` | renderização infinita | só atualiza quando a posição limitada difere; o clamp é idempotente |
| Ajuste muda a orientação | barra vertical vira horizontal | `expandedZone` fixada (C-2603) |
| `Alt+H` recebido pelo overlay e pela `Room.tsx` | alternância dupla | a transição só age quando `collapsed` muda de fato; se o defeito existir, vira issue de desvio (AGENTS §14) |

## Scope Lock

### IN

- posições independentes da bolinha e da barra aberta, âncora e limite à tela na barra flutuante do overlay;
- testes do componente;
- nota na spec 003 apontando a 026;
- incremento PATCH de versão.

### OUT

- barra interna da `Room.tsx`; processo main; `packages/**`; web; backend; persistência entre sessões; mudança de
  atalhos.

### Allowed Paths

- `apps/desktop/src/renderer/components/FloatingAnnotationOverlay.tsx`
- `apps/desktop/src/renderer/components/FloatingAnnotationOverlay.test.tsx`
- `spec-kit/specs/026-barra-flutuante-cantos/**`
- `spec-kit/specs/003-classroom-interaction/spec.md` (só a nota)
- só na T2604, via `npm run bump`: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`

### Prohibited Paths

- `apps/desktop/src/main/**`, `apps/desktop/src/preload/**`, `apps/desktop/src/renderer/pages/**`
- `packages/**` (fora da T2604), `apps/web/**`, `apps/backend/**`
- `.github/**`, `scripts/**`

### Dependencies

- Nenhuma nova.

### Non-Goals

- Lembrar posições entre sessões; mudar o tamanho ou o conteúdo da barra; corrigir o recebimento duplo de atalhos.

## 4. Validation

- `npm run test -w apps/desktop`, `npm run lint`, `npm run spec:check -- spec-kit/specs/026-barra-flutuante-cantos`.
- Manual no Windows (T2603).
