# Converge: Uma Única Conexão de Sinalização por Entrada do Aluno

Feature: `044-conexao-unica-do-aluno`
Status: DONE
Branch: `fix/conexao-unica-do-aluno`, a partir da `development` @ `a972cb2` (2.1.0)

## 1. Evidências

- T4401, vermelho antes da correção: `npx vitest run src/hooks/useWebRTCSubscriber.test.ts` com 2 falhas, "expected
  ... to have a length of 1 but got 2" (StrictMode: o hook criava dois WebSockets com o mesmo token) e "length of +0
  but got 1" (desmontagem antes de conectar).
- T4402: `npx vitest run` em `apps/web` com 5 arquivos e 59 testes verdes; `npm run lint` (`tsc --noEmit`) verde.
- T4403: `npm run build` verde; `cd apps/web && npx playwright test --repeat-each=3 --retries=0` com **39 passed**,
  0 failed, incluindo A13 (desktop e mobile), A14, A20 e o primeiro teste depois que o servidor sobe, os que caíam
  com o `4001` falso no #127.
- Log do backend no mesmo e2e: nenhuma ocorrência de "substituindo conexão anterior" (`hub.go`, `onRegister`), ou
  seja, nenhum aluno abriu uma segunda conexão com o mesmo token.

## 2. Requisitos

| Requisito | Evidência |
|---|---|
| RF-4401 | `useWebRTCSubscriber.ts`: `setTimeout(connect, 0)` no efeito e `clearTimeout` no cleanup; testes da 044 verdes |
| RF-4402 | tratamento de `4001`, `4002`, `1000`/`4004` e backoff sem mudança; testes do `4001` e do `4002` verdes |
| RNF-4401 | e2e completo três vezes sem retry, verde |
| RNF-4402 | diff só em `apps/web/src/hooks/useWebRTCSubscriber{,.test}.ts`, artefatos da feature e o `chore(release)` |
| RNF-4403 | nenhuma dependência nova |

## 3. Desvios registrados

- Nenhum.

## 4. Trabalho restante

- Nenhum nesta feature. O #127 fica resolvido pelo PR desta branch.

## 5. Impacto de versão

**PATCH** (C-4402), 2.1.0 → 2.1.1: correção no web do aluno, sem mudança de capacidade nem de contrato
(`docs/versionamento.md` §2).
