# Plan: Mãos Levantadas na Barra de Marcação

Feature: `017-maos-na-barra-marcacao`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-171 a C-179)

## 1. Summary

A janela do MLab já sabe quantas mãos estão levantadas (`raisedHandsStudents`, `Room.tsx:1421`). O plano leva só esse
número à barra de marcação por um canal IPC próprio, só de ida (C-177), e desenha o indicador na barra.

```text
Room.tsx ──setAnnotationRaisedHands(n)──▶ main (AnnotationOverlayManager)
                                           │ rejeita se vier do overlay; valida inteiro ≥ 0
                                           │ guarda o último valor; reenvia ao recriar o overlay
                                           ▼
                     FloatingAnnotationOverlay ◀──onAnnotationRaisedHands(cb)── 'annotation-overlay:raised-hands'
```

### Main e preload — `apps/desktop/src/main/`

1. **`annotationOverlayWindow.ts` (RF-179, RNF-172):**
   - campo `lastRaisedHands = 0`;
   - `setRaisedHands(sender: WebContents, value: unknown): void`:
     - descarta quando `isOverlayWebContents(sender)` (a barra não altera a contagem). O overlay é a única outra janela
       do app; qualquer outro remetente é a janela do MLab, como já assumem `annotation-overlay:start` e `sync-state`;
     - descarta quando `!Number.isInteger(value) || value < 0`;
     - se o valor mudou, guarda e envia `annotation-overlay:raised-hands` ao overlay, quando ele existir;
     - aceita antes do `start()`: o valor fica guardado e vai ao overlay quando ele carregar (a ordem entre os
       efeitos de início do overlay e de envio no `Room` deixa de importar);
   - reenvia `lastRaisedHands` no `ready-to-show` e no `did-finish-load` do overlay, junto com o `lastState` (estado
     "janela da barra recriada" da spec);
   - `stop()` volta `lastRaisedHands` para 0.
2. **`main.ts`:** `ipcMain.handle('annotation-overlay:raised-hands', (event, value) =>
   annotationOverlayManager.setRaisedHands(event.sender, value))`.
3. **`preload.ts`:** na interface `ElectronAPI` e no objeto exposto:
   - `setAnnotationRaisedHands(count: number): Promise<void>` → `invoke('annotation-overlay:raised-hands', count)`;
   - `onAnnotationRaisedHands(cb: (count: number) => void): () => void` → `on('annotation-overlay:raised-hands')`,
     repassando só números.
4. **`apps/desktop/src/test/setup.ts`:** mocks das duas funções novas.

O payload é um número; não há tipo novo em `packages/types` (Princípio VII). Os nomes ficam no contrato.

### Janela do MLab — `apps/desktop/src/renderer/pages/Room.tsx`

5. **Envio (RF-176, RF-179, RNF-171):** `raisedHandsCount = raisedHandsStudents.length`, calculado com o mesmo
   filtro da fila. Efeito com dependências `[isLiveSession, raisedHandsCount]`: em sessão ao vivo, chama
   `window.electronAPI?.setAnnotationRaisedHands?.(raisedHandsCount)`. Não toca no efeito de `syncAnnotationState`
   nem no `syncingFromExternalRef`. O efeito fica antes de qualquer retorno condicional do componente.

### Barra — `apps/desktop/src/renderer/components/FloatingAnnotationOverlay.tsx`

6. **Estado:** `raisedHands` (número, começa em 0), atualizado por `onAnnotationRaisedHands`; valores não inteiros ou
   negativos são ignorados.
7. **Indicador (RF-171, RF-173, RF-174, RF-177):** componente local `RaisedHandsIndicator`, renderizado só com
   `raisedHands > 0`:
   - caixa `position: relative` de 30 × 28 px com `Touch_1Filled` (16 px, de `@mlab/ui`, já exportado);
   - badge `position: absolute; top: 0; right: 0`, **dentro** da caixa (RNF-173), fundo `#facc15`, texto `#0f172a`,
     10 px, negrito, `min-width` 14 px, cantos arredondados; texto `n` até 9 e `9+` a partir de 10;
   - `role="img"`, `aria-label` e `title` "Mãos levantadas: N" com N real; o badge tem `aria-hidden`;
   - é um `span`, sem `onClick` nem `onPointerDown`: não troca ferramenta, não recolhe, não arrasta;
   - `data-testid="external-raised-hands"` e `data-testid="external-raised-hands-badge"`.
8. **Posição:** barra expandida, logo depois do cabeçalho de arraste (primeiro item depois do `⋮⋮`/minimizar), nas
   duas orientações; barra recolhida, abaixo do botão redondo, dentro da mesma coluna. Fica sempre dentro do elemento
   `toolbarRef`.
9. **Borda (RF-172, RF-175):** com `raisedHands > 0`, a barra troca `border` de `1px solid #38bdf8` para
   `1px solid #facc15` e soma um anel `0 0 0 2px rgba(250, 204, 21, 0.55)` ao `boxShadow` existente. Mesma largura
   de borda, sem mudar o layout; sem `animation`/`transition` de cor (C-171). Atributo `data-raised-hands="N"` para
   os testes.
10. **Linux (RNF-173):** `reportToolbarRect` passa a depender também de `raisedHands`, para reenviar o retângulo
    quando o indicador aparece ou some. O indicador está dentro de `toolbarRef`, então o retângulo o cobre.

### Documentos

11. **Contrato** `003/contracts/desktop-ipc.md`: as duas entradas novas (feito junto com estes artefatos, antes do
    código; Princípio V).
12. **003** (`spec.md`, US-11 e US-19): nota apontando para a 017. **Smoke** novo `A15b` em
    `docs/metrics/smoke-runbook.md` e `scripts/smoke-report.js`.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Transporte | canal IPC próprio `annotation-overlay:raised-hands`, só de ida | C-177 |
| Payload | inteiro ≥ 0; sem tipo novo em `packages/types` | RF-179, Princípio VII |
| Remetente aceito | qualquer webContents que não seja o do overlay | RNF-172 |
| Ícone | `Touch_1Filled` de `@mlab/ui` (o mesmo da fila no `Room`) | RNF-175 |
| Badge | `1`–`9`, `9+`; amarelo `#facc15` sobre a barra escura | C-175, RNF-174 |
| Borda | `#facc15` + anel no `boxShadow`, fixa | C-171 |
| Visibilidade | a mesma da barra (`showFloatingToolbar`) | C-176 |
| Testes | vitest (jsdom para o overlay e o `Room`; fakes de `BrowserWindow` no main) | — |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Indicador entra no vídeo em tela cheia | alunos veem a borda e o número | aceito (C-172, RN-171); sem animação; smoke confere |
| Retângulo do Linux desatualizado quando o indicador aparece | clique no indicador atravessa ou parte da barra perde cliques | `reportToolbarRect` depende de `raisedHands`; indicador dentro de `toolbarRef`; teste da T173 |
| Overlay recriado (troca de fonte/modo) perde a contagem | indicador some com mãos levantadas | `lastRaisedHands` reenviado no `ready-to-show`/`did-finish-load`; teste da T171 |
| Envio antes do `start()` do overlay | contagem perdida | o manager aceita e guarda antes do `start()` |
| Contagem diferente da fila | aviso enganoso | mesmo filtro (`raisedHandsStudents`); teste da T172 |
| `tsc --noEmit` do desktop já falha (#51) | typecheck não serve de gate | gate: nenhum erro novo nos arquivos tocados (linha de base: 14 erros) |

## Scope Lock

### IN

- canal IPC da quantidade de mãos levantadas (main, preload, mocks de teste);
- envio da quantidade pela janela do MLab;
- indicador, badge e borda de destaque na barra de marcação flutuante;
- contrato `desktop-ipc.md`, nota na 003 e item de smoke `A15b`.

### OUT

- backend, web app dos alunos, sinalização e protocolo de mãos;
- notificação do sistema, som, `flashFrame`, badge na barra de tarefas;
- ação de clique no indicador;
- avisos de mãos dentro da janela do MLab;
- captura de tela (retirar a barra do vídeo) e correção da #62;
- mudanças em `AnnotationSessionState` e no fluxo de `annotation-overlay:sync-state`.

### Allowed Paths

- `apps/desktop/src/main/annotationOverlayWindow.ts`, `apps/desktop/src/main/annotationOverlayWindow.test.ts`
- `apps/desktop/src/main/main.ts` (só o handler novo)
- `apps/desktop/src/main/preload.ts` (só as duas funções novas)
- `apps/desktop/src/test/setup.ts`
- `apps/desktop/src/renderer/pages/Room.tsx`, `apps/desktop/src/renderer/pages/Room.test.tsx`
- `apps/desktop/src/renderer/components/FloatingAnnotationOverlay.tsx`,
  `apps/desktop/src/renderer/components/FloatingAnnotationOverlay.test.tsx`
- `spec-kit/specs/003-classroom-interaction/contracts/desktop-ipc.md`
- `spec-kit/specs/003-classroom-interaction/spec.md` (só nota de referência)
- `docs/metrics/smoke-runbook.md`, `scripts/smoke-report.js`
- `spec-kit/specs/017-maos-na-barra-marcacao/**`
- `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json` (só pelo `npm run bump`)

### Prohibited Paths

- `apps/backend/**`, `apps/web/**`
- `packages/types/**`, `packages/ui/**`
- `apps/desktop/src/renderer/hooks/useWebRTCPublisher.ts`
- `apps/desktop/src/renderer/media/**`
- `apps/desktop/src/main/toolbarHitTest.ts`, `apps/desktop/src/main/x11InputShape.ts`,
  `apps/desktop/src/main/doubleCtrlDetector.ts`, `apps/desktop/src/main/nativeWindowTracker.ts`
- `apps/desktop/package.json` fora do `npm run bump`; `apps/desktop/electron-builder*`

### Dependencies

- Nenhuma nova. Existentes: `electron`, `react`, `@mlab/ui` (`Touch_1Filled`), `vitest`, `@testing-library/react`.

### Non-Goals

- esconder o indicador ou a barra do vídeo em tela cheia;
- mostrar nomes ou ordem da fila fora do MLab;
- corrigir os erros de `tsc` da #51 ou o comentário da #62.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: sem operação protegida nova no servidor; no app, a barra não altera a contagem (RNF-172).
- [x] Princípio III: SFU e caminho do vídeo intocados (RNF-171).
- [x] Princípio IV: sem meta de desempenho declarada; nada a medir além do smoke funcional.
- [x] Princípio V: `desktop-ipc.md` atualizado antes do código.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: sem tipo novo nem abstração; um componente local com um consumidor (barra expandida e recolhida).
- [x] Princípio IX: desvios encontrados na análise registrados (#62); #50 e #51 já existiam.
- [ ] Princípio VIII: converge ao final (T175).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-10 | Borda fixa, sem animação | C-171 |
| 2026-11-10 | Indicador no vídeo em tela cheia é aceito | C-172 |
| 2026-11-10 | Indicador só informa; some com zero mãos; `9+` | C-173, C-174, C-175 |
| 2026-11-10 | Canal IPC próprio, só de ida, sem campo em `AnnotationSessionState` | C-177 |
| 2026-11-10 | Payload numérico, sem tipo novo em `packages/types` | Princípio VII |
| 2026-11-10 | IDs 17x; versão MINOR | C-179 |
