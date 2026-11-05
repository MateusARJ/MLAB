# Analyze: Barra de Marcação no Linux

Feature: `009-marcacao-linux`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma. A spec, o clarify (C-901 a C-903) e o plan concordam: hit-test no main só no Linux, retângulo enviado pelo
overlay, `null` com o MLab em foco, log de atalho recusado e foco pelo clique. O duplo `Ctrl` fica fora (003, RF-309).
A numeração 009 e os IDs 9xx não colidem com `007-mascara-cursor-janela` nem com `008-dev-entrada-unica-web`.

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-901 | T902, T903, T905 |
| RF-902 | T901, T904 |
| RF-903 | T903, T905 |
| RF-904 | T905 (decorre de T903/T904; sem código próprio — C-902) |
| RNF-901 | T903 |
| RNF-902 | T903 |
| RN-901 | T905 (smoke Windows) |

## 3. Contratos

Canal novo `annotation-overlay:toolbar-rect` (renderer do overlay → main), registrado em
`003/contracts/desktop-ipc.md` na T901. Nenhum contrato existente muda.

## 4. Tarefas fora do Scope Lock

Nenhuma. Todos os paths das tasks estão em `Allowed Paths` do plan; `nativeWindowTracker.ts`, `cursorPresence.ts`,
`doubleCtrlDetector.ts`, `renderer/media/**`, `renderer/pages/**` e `package.json` estão proibidos em todas.

## 5. Riscos

- WSLg/Weston pode não compor transparência nem aceitar atalho global X11 — limitação do ambiente registrada no converge.
- Escala de DPI diferente de 100% — verificação manual se disponível.

## 6. Resultado

- [ ] FAIL
- [x] PASS — próxima execução: T901.

## 7. Rodada 2 — C-904 (2026-11-05)

### Inconsistências

Nenhuma. A T905 mostrou que `getCursorScreenPoint()` congela sob XWayland (`evidencias/t905-wslg-hit-test.log`); a
C-904 foi aprovada após spike no WSLg e propagada na ordem spec (RF-901, RNF-902, critérios) → plan (item 5, contexto,
riscos, Allowed Paths, dependências, decision log) → checklist → tasks (T907–T909; T905 depende de T909). A T903 não é
desfeita: o hit-test continua como alternativa, o que mantém RF-901 coberto se `libXext` faltar. C-903 segue igual
(retângulo `null` → região vazia). Nenhum `NEEDS CLARIFICATION`.

### Cobertura

| Requisito | Task |
|---|---|
| RF-901 | T902, T903 (alternativa), T907, T908, T909, T905 |
| RF-902 | T901, T904 |
| RF-903 | T903, T905 |
| RF-904 | T905 (decorre do clique aceito na barra — C-902) |
| RNF-901 | T903, T909 |
| RNF-902 | T903 (alternativa), T909 |
| RN-901 | T905 (smoke Windows) |

### Contratos

Sem mudança: o canal `annotation-overlay:toolbar-rect` e o tipo `AnnotationToolbarRect` atendem a C-904.

### Scope Lock

T907–T909 só tocam paths permitidos (`x11InputShape.ts` e teste foram incluídos no plan). `nativeWindowTracker.ts`
segue proibido; o defeito de `XSetErrorHandler` achado nele (T905) fica para tarefa/feature própria. Nenhuma
dependência nova no `package.json`.

### Riscos

- Electron reaplicar a forma de entrada: mitigado no T909 (main único dono, reaplica após `setBounds`/exibição).
- `BadWindow` no Xlib: chamada só com janela viva.
- WSLg não mantém janelas Linux acima de apps do Windows: limitação do ambiente, para o converge.

### Resultado

- [ ] FAIL
- [x] PASS — próxima execução: T907.
