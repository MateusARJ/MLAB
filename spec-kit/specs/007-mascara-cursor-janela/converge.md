# Converge: Ocultação do Cursor na Transmissão de Janela Específica

Feature: `007-mascara-cursor-janela`
Mode: READ-ONLY sobre o código (só este arquivo e o `tasks.md` são escritos)
Data: 2026-11-12
Commits avaliados: `5a64177` (T701), `2dead52` (T702), `09f14ca` (T703), `2986261` (T704), `e5dc464` (T707),
`66db0ef` (T708), `0690174` (T709), `2a2e1dc` (T710), `a08c959` e `0d9a2a6` (T705); integração da `development` em
`09b0eef` (3e5e657, 1.12.1)
Status: CONVERGED

## Entradas

- `spec.md` (RF-701 a RF-708, RNF-701 a RNF-703), `clarify.md` (C-701 a C-705), `plan.md`, `tasks.md` (T701 a T710),
  `analyze.md` (PASS, revalidações 5a a 5d)
- código: `apps/desktop/src/renderer/media/cursorMask.worker.ts`, `cursorMaskPolicy.ts`, `cursorMaskFrame.ts`,
  `createCursorMaskedTrack.ts` e os testes de cada um
- suítes: `npx turbo run build test lint --force` no monorepo (13 de 13 tarefas; desktop com 25 arquivos e 244 testes)
- medição: `docs/metrics/cursor-mask-2026-11.md` (rodadas 1 e 2); smoke A12 em `docs/metrics/smoke-runbook.md`

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-701 | `shouldMaskCursor` e `CursorTrail.maskRect` (rastro de 150 ms) em `cursorMaskPolicy.ts`, com testes de rastro, expiração e transição; worker mascara em memória (`buildMemMaskedFrame`) ou no canvas (`maskCursorRegion`); smoke A12 e teste do professor: cursor oculto sem mancha |
| RF-702 | `decideFramePath` → `compose: false` com cursor visível ou `rect: null` e sem anotação (testes); repasse `writer.write(frame)` sem cópia; placa no repasse só a cada 250 ms |
| RF-703 | `FrameBudgetGuard` (8 ms, EMA 0,1, 10 amostras, 5 → 60 s) com relógio injetado nos testes; worker mede composição + `await writer.write` (T708) e a atualização da placa |
| RF-704 | quadro composto em `displayWidth` × `displayHeight`; medição: resolução constante nas duas rodadas e keyframes só no ritmo de 10 s |
| RF-705 | tela cheia sem mudança de código; US-20 / RF-310 da 003 emendados (T704) |
| RF-706 | placa preservando o rastro e região suja; preenchimento pelo entorno só sem pixel limpo (`cursorMaskFrame.ts`, testes `I420`/`NV12`/`RGBA`); teste do professor sem quadrado borrado parado |
| RF-707 | `ringChangeRatio` (anel de 12 px, tolerância 2, limiar 3 %, 500 ms) com testes; harness e teste do professor sobre vídeo |
| RF-708 | `shouldDrawSpotlight` e `drawSpotlight` em `decideFramePath` (9 testes); worker desenha a lupa só com `path.drawSpotlight`; teste manual do professor em 2026-11-11 |
| RNF-702 | kill-switch `mlab.cursorMask=off` e fallback para a faixa bruta mantidos (`createCursorMaskedTrack.test.ts`) |
| RNF-703 | `createCursorMaskedTrack.ts` registra `mask-suspended`, `mask-resumed` e `fatal` com `[CursorMask]`, com teste |

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta | Evidência |
|---|---|---|
| RNF-701 | A/B na mesma rodada em 1080p, com o FPS alvo registrado; `chrome://gpu` e log `[CursorMask]` | Rodada 2 (aluno no celular, 1366×768): média de 43,3 fps, mediana 46, nenhum segundo abaixo de 20, sem keyframe extra. A base só foi medida na rodada 1, com o aluno no mesmo notebook, onde a 007 ficou abaixo (22,8 contra 40,2). Ressalvas aceitas pelo responsável em 2026-11-12 (T705). |

## 3. Divergências (código ≠ spec/plan/contrato)

| Item | Spec/contrato diz | Código faz | Encaminhamento |
|---|---|---|---|
| — | — | — | nenhuma |

## 4. Código sem requisito (implementado fora de spec/task)

| Comportamento | Onde | Encaminhamento |
|---|---|---|
| — | — | nenhum; `hasAnyAnnotation`, sem uso depois da T710, foi removido |

## 5. Testes faltantes

- Nenhum teste automatizado de quadro para o worker (`VideoFrame`/`OffscreenCanvas` não rodam no jsdom). As decisões
  ficam nas funções puras testadas (`cursorMaskPolicy.ts`, `cursorMaskFrame.ts`); o worker é coberto pelo harness, pelo
  smoke A12 e pelos testes manuais.
- O caminho "cursor oculto com anotação ativa" (quadro mascarado em memória como base do canvas das anotações) só foi
  coberto por revisão de código e pelo cenário A misturado da rodada 2.

## 6. Novas tasks necessárias

- Nenhuma na 007.
- Trabalho futuro, fora do escopo: ocultação na tela cheia por troca dinâmica de faixa com `replaceTrack` (opção B,
  C-702), com protótipo e medição próprios; medição A/B completa de RNF-701 em 1080p, se o desempenho voltar a ser
  questionado.

## 7. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| #70 | `bug`, `desvio`, `area:desktop` | Não | resolvida pela T710 (C-705, RF-708); fecha quando o merge chegar à `main` |

Nenhum desvio novo encontrado durante a 007.

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| PATCH | 1.12.2 | Correção em `apps/desktop` para cumprir a US-20 / RF-310 da 003 (regressão do `29c54d0`, issue #28) e a lupa no modo janela (#70); commits `fix` e `refactor`, sem `feat`, sem mudança de contrato nem capacidade nova. |

## 9. Resultado

- [ ] OPEN
- [x] CONVERGED — RF-701 a RF-708, RNF-702 e RNF-703 atendidos; RNF-701 aceito com as ressalvas da T705 (seção 2).
