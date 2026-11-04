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
