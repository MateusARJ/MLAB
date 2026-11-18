# Plan: Erro X no Rastreador de Janelas Não Encerra o App no Linux

Feature: `047-erro-x-rastreador-janelas`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-4701 a C-4703)

## 1. Summary

```text
antes:  consulta → XQueryTree(XID inválido) → BadWindow → handler padrão do Xlib → exit()

depois: consulta → trap.run(dpy, fn):
          XSetErrorHandler(próprio) → fn() → XSync → XSetErrorHandler(anterior)
          → { result, error }   BadWindow: janela não encontrada, sem log
                                outro erro: console.warn uma vez por código
```

1. `apps/desktop/src/main/x11ErrorTrap.ts` (novo): `createX11ErrorTrap(koffi, x11)` define a struct `XErrorEvent` e o
   protótipo do handler, registra o callback (`koffi.register`) que guarda o primeiro erro e expõe
   `run(dpy, fn) → { result, error }` e `dispose()`. `run` instala o handler, executa `fn`, chama `XSync` e restaura o
   anterior em `finally`; se `fn` lança, a exceção segue depois da restauração. Exporta `X_BAD_WINDOW`.
2. `apps/desktop/src/main/x11InputShape.ts`: passa a usar o trap; `X_BAD_WINDOW` continua exportado (reexportado).
   Comportamento da T911 inalterado.
3. `apps/desktop/src/main/nativeWindowTracker.ts`: `createLinuxX11Tracker` cria o trap depois de abrir o display e
   executa o corpo de `queryWindow` e de `queryTopWindowAtCursor` dentro de `trap.run`; o `dispose` libera o trap.
   A função passa a ser exportada para os testes com `koffi` simulado.
4. Testes: `x11ErrorTrap.test.ts` (novo) e casos novos em `nativeWindowTracker.test.ts`, com `koffi` simulado; a suíte
   da T911 (`x11InputShape.test.ts`) segue sem mudança.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Captura de erro X | módulo único `x11ErrorTrap.ts`, handler só durante a chamada | C-4701 |
| `BadWindow` no rastreador | janela não encontrada, sem log | C-4702 |
| Outro erro no rastreador | `console.warn` uma vez por código, sem lançar | C-4702 |
| Trap indisponível | rastreador `null` (fallback do Electron) | C-4702 |
| Região de entrada (009) | comportamento da T911 inalterado | RF-4703 |
| Versão | PATCH, 2.1.5 | C-4703 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Refatoração muda a T911 | região de entrada para de tratar o erro | suíte `x11InputShape.test.ts` (12 testes) sem alteração; mesma ordem de chamadas |
| `XSync` a cada consulta (16 ms) | latência extra | as consultas já fazem várias idas e voltas (`XQueryPointer`, `XQueryTree`); `XSync` é uma a mais (RNF-4703) |
| Log inundado por erros repetidos | log ilegível | `BadWindow` sem log; outros, uma vez por código |
| Erro X fora da consulta herdado | falso erro na consulta seguinte | o erro pendente é zerado no início de cada `run` |

## Scope Lock

### IN

- tratamento de erro X no rastreador de janelas X11 e na região de entrada da 009, por meio de um módulo único;
- testes unitários desses módulos.

### OUT

- `CursorPresenceTracker`, barra de marcação e manager do overlay;
- rastreadores do Windows e do macOS;
- presença do cursor sob XWayland (#140).

### Allowed Paths

- `apps/desktop/src/main/x11ErrorTrap.ts`, `apps/desktop/src/main/x11ErrorTrap.test.ts`
- `apps/desktop/src/main/nativeWindowTracker.ts` (somente o trecho Linux e o `export` de `createLinuxX11Tracker`)
- `apps/desktop/src/main/nativeWindowTracker.test.ts`
- `apps/desktop/src/main/x11InputShape.ts`
- `spec-kit/specs/047-erro-x-rastreador-janelas/**`
- `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json` (somente pelo `npm run bump`)

### Prohibited Paths

- `apps/desktop/src/main/cursorPresence.ts`, `apps/desktop/src/main/annotationOverlayWindow.ts`
- `apps/desktop/src/main/x11InputShape.test.ts`
- `apps/desktop/src/renderer/**`, `apps/web/**`, `apps/backend/**`, `packages/*/src/**`
- `spec-kit/specs/009-marcacao-linux/**`, `spec-kit/docs/adrs/**`, `.github/**`, `docs/**`

### Dependencies

- Nenhuma nova. `koffi` e Vitest, já usados.

### Non-Goals

- mudar o resultado de consultas sem erro;
- tratar erros X de outras bibliotecas do processo (GTK, Chromium).

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: nenhuma regra de autorização muda.
- [x] Princípio III: SFU intocada.
- [x] Princípio IV: custo extra limitado a uma ida e volta por consulta (RNF-4703).
- [x] Princípio V: nenhum contrato muda.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: mudança restrita ao main process do desktop no Linux.
- [x] Princípio VIII: converge ao final (T4705).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-18 | Módulo único `x11ErrorTrap.ts` para o rastreador e a região de entrada | C-4701 |
| 2026-11-18 | `BadWindow` sem log; outro erro com aviso único por código; trap indisponível → rastreador `null` | C-4702 |
| 2026-11-18 | Uma feature, um PR, IDs `470x`, PATCH | C-4703 |
