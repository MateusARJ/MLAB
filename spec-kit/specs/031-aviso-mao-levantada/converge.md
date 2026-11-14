# Converge: Aviso de Mão Levantada Clicável e Sincronizado com a Fila

Feature: `031-aviso-mao-levantada`
Mode: READ-ONLY sobre o código (só este arquivo, o `tasks.md` e a nota da `003/spec.md` são escritos)
Data: 2026-11-14
Commits avaliados: `713280d` (artefatos), `1805bb0` (T3101), `47e9eee` (T3102), `a348545` (T3103)
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-3101 a C-3104), `plan.md`, `tasks.md` (T3101 a T3104)
- contratos: `003/contracts/` sem mudança (`hand-updated`, `participants-update`, `lower-hand`)
- código: `apps/desktop/src/renderer/pages/Room.tsx` (`handToastOverlay`),
  `apps/desktop/src/renderer/hooks/handToast.ts`, `apps/desktop/src/renderer/hooks/useWebRTCPublisher.ts`
- suítes em `apps/desktop`:
  - `npm run lint` (`tsc --noEmit`): sem erros;
  - `npx vitest run`: 30 arquivos, 318 testes verdes;
  - o teste de camada falhou com o valor antigo (`ferramenta cursor: expected 10 to be greater than 15`) e passa com
    `zIndex: 20`.

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-3101 | `Room.tsx` (`handToastOverlay.zIndex: 20`); `RoomHandRaise.test.tsx` "deve manter o aviso de mão levantada acima do canvas de marcação com qualquer ferramenta ativa" (cursor, caneta, marcador, seta, retângulo, borracha, lupa) |
| RF-3102 | `RoomHandRaise.test.tsx` "deve abrir a aba de alunos e dispensar o aviso ao clicar em Ver Turma"; X coberto pelo teste existente do aviso |
| RF-3103 | `useWebRTCPublisher.ts` (`hand-updated` com `raised` falso → `clearHandToastOnLower`); `handToast.test.ts` |
| RF-3104 | `useWebRTCPublisher.ts` (`lowerStudentHand` → `clearHandToastOnLower`); `handToast.test.ts` |
| RF-3105 | `useWebRTCPublisher.ts` (`participants-update` → `clearHandToastOnParticipants`); `handToast.test.ts` (aluno ausente, mão abaixada, sem `hand_raised`) |
| RF-3106 | `handToast.test.ts` (outro aluno → mesmo objeto; aluno do aviso abaixa com outro de mão levantada → `null`) |
| RNF-3101 | regra em função pura (`handToast.ts`); teste de camada falha com `zIndex: 10` |
| RNF-3102 | nenhuma dependência nova |

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta | Evidência |
|---|---|---|
| — | — | nenhum |

## 3. Divergências (código ≠ spec/plan/contrato)

| Item | Spec/contrato diz | Código faz | Encaminhamento |
|---|---|---|---|
| — | — | — | nenhuma |

- A divergência da issue #90 (botões sem clique e aviso que não some) está resolvida por esta feature.

## 4. Código sem requisito (implementado fora de spec/task)

| Comportamento | Onde | Encaminhamento |
|---|---|---|
| — | — | nenhum |

## 5. Testes faltantes

- Clique real no app desktop: o desktop não tem Playwright (C-3104) e a verificação manual com professor e aluno
  conectados não foi feita nesta sessão. Fica para o responsável no PR, seguindo os passos de reprodução da issue #90.
- O hook `useWebRTCPublisher` não tem teste próprio; a regra que ele aplica está coberta em `handToast.test.ts`.

## 6. Novas tasks necessárias

- Nenhuma.

## 7. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| — | — | — | nenhum desvio novo encontrado |

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| PATCH | 1.15.2 | Correção no renderer do desktop, sem mudança de capacidade nem de contrato (C-3104). |

## 9. Resultado

- [ ] OPEN
- [x] CONVERGED — o aviso de mão levantada fica acima do canvas e responde aos dois botões com qualquer ferramenta, e
  some quando a mão que mostra é abaixada pelo aluno, pelo professor ou pela saída do aluno.
