# Analyze: Mãos Levantadas na Barra de Marcação

Feature: `017-maos-na-barra-marcacao`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma. Spec, clarify (C-171 a C-179), plan e tasks concordam: indicador com ícone e badge `1`–`9`/`9+` dentro da
barra expandida e recolhida, borda fixa `#facc15`, nada com zero mãos, indicador só informativo, mesma visibilidade
da barra e canal IPC próprio só de ida, com o main descartando valores do overlay e valores inválidos.

- A spec §9 cita um tipo em `packages/types` "se o plan precisar"; o plan decidiu que não precisa (payload numérico,
  Princípio VII) e proíbe `packages/**`. Coerente.
- A faixa `17x` não colide com outra feature: as únicas ocorrências fora da 017 são as entradas novas do
  `desktop-ipc.md`, que apontam para a própria 017.
- Durante a revisão, a T173 não tinha check do RF-178 (visibilidade); o check foi acrescentado antes deste
  analyze.

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-171 | T173 |
| RF-172 | T173 |
| RF-173 | T173 |
| RF-174 | T173 |
| RF-175 | T173 |
| RF-176 | T171 (reenvio só na mudança), T172 |
| RF-177 | T173 |
| RF-178 | T173 |
| RF-179 | T171, T172 |
| RF-180 | T172 |
| RNF-171 | T171, T172 |
| RNF-172 | T171, T173 |
| RNF-173 | T173, T175 (regressão no Linux) |
| RNF-174 | T173, T175 (smoke) |
| RNF-175 | todas (`package.json` só pelo bump; `packages/**` proibido) |
| RN-171 | T174 (roteiro A15b), T175 (smoke) |
| RN-172 | T172 (fila inalterada), T173 (sem ação no indicador) |
| Estados §7 (recriação, valor inválido, fim de sessão) | T171, T173 |

## 3. Contratos

`003/contracts/desktop-ipc.md`: entradas novas `setAnnotationRaisedHands(count)` (renderer → main) e
`onAnnotationRaisedHands(cb)` (main → overlay), no canal `annotation-overlay:raised-hands`. Adição compatível,
registrada junto com estes artefatos, antes do código (Princípio V). `AnnotationSessionState`,
`annotation-overlay:sync-state`, HTTP e WebSocket não mudam.

## 4. Tarefas fora do Scope Lock

Nenhuma. Todos os paths das tasks estão em `Allowed Paths` do plan. `main.ts` e `preload.ts` são tocados só para o
canal novo (T171). `useWebRTCPublisher.ts`, `media/**`, `toolbarHitTest.ts`, `x11InputShape.ts`, `packages/**`,
`apps/backend/**` e `apps/web/**` estão proibidos.

## 5. Riscos

- `tsc --noEmit` do desktop já falha (#51): o gate das tasks é nenhum erro novo nos arquivos tocados.
- Indicador visível no vídeo em tela cheia: aceito (C-172), conferido no smoke A15b.
- Regressão da área de clique no Linux: indicador dentro de `toolbarRef` e retângulo reenviado; teste na T173 e
  regressão manual na T175, sem ambiente Linux real garantido (limite da 009, #32).

## 6. Resultado

- [ ] FAIL
- [x] PASS: próxima execução, T171.
