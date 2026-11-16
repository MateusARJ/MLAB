# Plan: Fixar uma Janela na Transmissão de Múltiplas Janelas

Feature: `032-fixar-janela-transmissao`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-3201 a C-3206)

## 1. Summary

```text
Room.tsx (renderer)
  pinnedWindowSourceId (state + ref)        lastFocusedAuthorizedIdRef
  │
  ├─ onActiveWindowChanged(sourceId)
  │     grava lastFocusedAuthorizedIdRef            (RF-3203)
  │     fixada? → retorna sem trocar                (RF-3203)
  │     senão  → selectSource + changeStream        (atual, RF-3210)
  │
  ├─ handlePinWindow(src)                           (RF-3202, RF-3209)
  │     src no ar?  → restartCursorTracking(src, allowed, src.id)
  │     senão       → selectSource(src, fps, allowed, src.id) + changeStream
  │
  ├─ handleUnpinWindow()                            (RF-3204, RF-3207)
  │     última focada ≠ no ar e autorizada → selectSource(last, fps, allowed) + changeStream
  │     senão                              → restartCursorTracking(noAr, allowed)
  │
  └─ limpar fixação: handleReconfigure, handleEndSession, saída do ao vivo (RF-3206)

useScreenCapture.ts
  selectSource(source, fps?, allowedIds?, pinnedId?) ─► startCursorTracking({..., pinnedSourceId})
  restartCursorTracking(source, allowedIds?, pinnedId?) ─► startCursorTracking(...) sem recaptura
  faixa bruta 'ended' ─► endedSourceId / onCaptureEnded                       (RF-3207)

cursorPresence.ts (main)
  start(target): pinnedWindowId = handle(pinnedSourceId) se ∈ allowed       (RF-3211)
  tick: foco em autorizada ≠ currentActiveSourceId
        → currentActiveSourceId = id; send('active-window-changed')         (mantido)
        → currentTargetWindowId = fg  só se pinnedWindowId === null          (RF-3208)
```

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Base | implementação depois do merge do #93; revalidar `analyze` antes da T3203 | C-3201 |
| Alvo do cursor fixado | `pinnedSourceId` opcional em `cursor-tracking:start`; main mantém o alvo e continua emitindo foco | C-3202 |
| Fim da captura | listener `ended` na faixa **bruta** (antes do `createCursorMaskedTrack`, cujo gerador não termina sozinho); `stop()` não dispara `ended`, então trocas normais não desfixam | C-3203 |
| Fixar sem trocar | reiniciar só o rastreamento (`startCursorTracking`), sem `getUserMedia` | RF-3202 |
| Clique no nome com fixação | equivale a Fixar | C-3205 |
| Interface | botão de alfinete (`Pin`/`PinFilled`, já importados no `Room.tsx`) ao lado de cada janela; padrão Fixar/Desafixar das mensagens fixadas do chat; estilos do design system 2.0 | RF-3201, RF-3205 |
| Gravação | sem mudança | C-3206 |
| Versão | MINOR via `npm run bump -- minor` | C-3206 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Conflito com o #93 no `Room.tsx` | retrabalho | C-3201: implementar depois do merge; T3201/T3202 não tocam o `Room.tsx` |
| Main troca o alvo do cursor para a janela em foco com uma fixada | cursor/lupa desalinhados no vídeo | RF-3208 no main, com teste (T3201) |
| Closure velha no efeito de foco lê fixação desatualizada | troca indevida logo após fixar | ler fixação e última focada por `ref` dentro do callback |
| `restartCursorTracking` zera `currentActiveSourceId` no main | evento de foco repetido para a janela no ar | o renderer já ignora evento da janela no ar; teste cobre |
| Corrida entre desfixar e evento de foco | troca dupla | um único caminho de troca; o último evento registrado vale (spec §9) |
| Gravação após troca de janela | possível problema anterior à feature | verificação manual na T3206; desvio vira issue (C-3206) |

## Scope Lock

### IN

- fixação de uma janela autorizada no seletor "Janelas da Aula" do app do professor;
- regra de foco com janela fixada e troca ao desfixar;
- desfixação automática ao fim da captura e ao reconfigurar/encerrar;
- alvo do cursor na janela fixada no main (campo opcional do IPC);
- testes de main, hook e componente;
- notas na 003 (US-20) e na 007 (RF-701/RF-708), atualização do contrato `desktop-ipc.md`;
- incremento MINOR.

### OUT

- atalho de teclado; estado na barra de marcação;
- `apps/web`, `apps/backend`, `packages/**`, protocolo WebSocket;
- evento `active-window-unauthorized`;
- correção de comportamento da gravação local;
- persistência da fixação.

### Allowed Paths

- `apps/desktop/src/main/cursorPresence.ts`, `apps/desktop/src/main/cursorPresence.test.ts` (novo)
- `apps/desktop/src/main/preload.ts` (só o tipo de `startCursorTracking`)
- `apps/desktop/src/renderer/hooks/useScreenCapture.ts`, `apps/desktop/src/renderer/hooks/useScreenCapture.test.ts`
- `apps/desktop/src/renderer/pages/Room.tsx`, `apps/desktop/src/renderer/pages/Room.test.tsx`
- `apps/desktop/src/test/setup.ts` (mocks de `electronAPI`)
- `spec-kit/specs/032-fixar-janela-transmissao/**`
- `spec-kit/specs/003-classroom-interaction/contracts/desktop-ipc.md`
- `spec-kit/specs/003-classroom-interaction/spec.md` e `spec-kit/specs/007-mascara-cursor-janela/spec.md` (só notas)
- só na T3206, via `npm run bump`: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`

### Prohibited Paths

- `apps/backend/**`, `apps/web/**`, `packages/**` (fora do bump da T3206)
- `apps/desktop/src/main/main.ts` (o handler `cursor-tracking:start` já repassa o alvo inteiro)
- `apps/desktop/src/main/annotationOverlayWindow.ts`, `apps/desktop/src/main/nativeWindowTracker.ts`,
  `apps/desktop/src/renderer/media/**`, `apps/desktop/src/renderer/hooks/useLocalRecorder.ts`,
  `apps/desktop/src/renderer/hooks/useWebRTCPublisher.ts`
- `spec-kit/docs/adrs/**`, `docs/requirements/**`, `.github/**`

### Dependencies

- Nenhuma nova. Vitest e Testing Library já usados no desktop; ícones `Pin`/`PinFilled` já importados.

### Non-Goals

- atalho global para fixar/desfixar;
- indicação de fixação na barra de marcação ou para os alunos;
- mais de uma janela fixada;
- teste e2e com janelas reais do sistema operacional.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: nenhuma autorização muda; a fixação é local ao app do professor.
- [x] Princípio III: SFU intocada; a troca usa o `replaceTrack` existente, sem nova upstream.
- [x] Princípio IV: nenhuma meta de desempenho declarada; a fixação evita recapturas.
- [x] Princípio V: mudança de IPC registrada em `003/contracts/desktop-ipc.md` antes da implementação.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: um estado, duas refs e um campo opcional no IPC.
- [ ] Princípio VIII: converge ao final (T3206).
- [x] Princípio IX: origem na issue #91.

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-15 | Implementar depois do merge do #93 | C-3201 |
| 2026-11-15 | Cursor e lupa só na janela fixada (`pinnedSourceId`) | C-3202 |
| 2026-11-15 | Fechada desfixa; minimizada mantém | C-3203 |
| 2026-11-15 | Sem atalho e sem barra de marcação | C-3204 |
| 2026-11-15 | Clique no nome com fixação equivale a Fixar | C-3205 |
| 2026-11-15 | Gravação sem mudança; testes do main em arquivo novo; IDs `320x`; MINOR | C-3206 |
