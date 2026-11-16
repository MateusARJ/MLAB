# Spec: Lint de Tipos do App Desktop sem Erros

Status: READY
Feature ID: `020-lint-tipos-desktop`
Origem: issue #51 (desvio registrado durante a T126 da 012): `tsc --noEmit` do `apps/desktop` falha com 14 erros.

## 1. Objetivo

Fazer o `npm run lint` do monorepo passar, para que um erro de tipo novo no app desktop apareça na hora em vez de se
perder entre erros antigos, e manter isso verificado no CI.

## 2. Contexto

O `lint` do desktop é `tsc --noEmit` (`apps/desktop/package.json`). O `vitest` não checa tipos, então os testes
passam com o código quebrado. Verificado em 2026-11-11 na `development` @ `1514dc1`: os mesmos 14 erros da issue.
Os demais `lint` do monorepo (`apps/web`, `packages/types`, `packages/ui` e o `go vet` do backend) já passam.

| Arquivo | Erros | Causa |
|---|---|---|
| `apps/desktop/src/main/main.ts` | 1 × TS6133 | import `systemPreferences` sem uso |
| `apps/desktop/src/renderer/media/cursorMask.worker.ts` | 9 × TS6133 | sobras do inpainting do cursor na CPU, removido de propósito no commit `29c54d0` (desempenho a 60 fps) |
| `apps/desktop/src/renderer/media/cursorMask.worker.ts` | 1 × TS2339 | `outCtx` atribuído só dentro de uma closure; o TypeScript o mantém como `null` e o `if (!outCtx)` o leva a `never` |
| `apps/desktop/src/renderer/pages/Room.test.tsx` | 2 × TS2345 | mocks de `useWebRTCPublisher` sem `stopPublishing` |
| `apps/desktop/src/renderer/pages/Room.tsx` | 1 × TS6133 | estado `isPrivacyShieldActive` sem leitor desde que o selo "Proteção de Privacidade Ativa" saiu da UI (commit `2a0e2c2`) |

## 3. Escopo

### Incluído

- remover o código morto apontado pelo `tsc` e o que só ele usava;
- corrigir o tipo do canvas de saída do worker sem `as` nem `!`;
- completar os mocks de `useWebRTCPublisher` em `Room.test.tsx`;
- rodar o `npm run lint` no workflow de CI.

### Não incluído

- afrouxar o `tsconfig` (`noUnusedLocals`, `noUnusedParameters`, `strict`);
- retomar a ocultação do cursor por inpainting (feature 007);
- mudar o canal IPC `active-window-unauthorized` (preload, main ou contrato);
- adotar ESLint.

## 4. Requisitos

- RF-2001: `tsc --noEmit -p apps/desktop` termina sem erros, e `npm run lint` na raiz termina com código 0.
- RF-2002: o selo "Proteção de Privacidade Ativa" não aparece na UI da sala, em nenhum modo de captura. O renderer
  não guarda estado nem assina evento só para esse selo.
- RF-2003: o workflow de CI executa `npm run lint` antes dos testes, e a etapa falha quando o lint falha.
- RNF-2001: nenhum comportamento visível muda. O worker continua repassando o quadro sem cópia quando não há
  sobreposição e continua desenhando traços e lupa quando há; a troca de janela autorizada continua igual.
- RNF-2002: nenhuma dependência nova e nenhum contrato muda.

## 5. Critérios de Sucesso

- `npx tsc --noEmit -p .` em `apps/desktop`: 0 erros (antes: 14).
- `npm run lint` na raiz: código 0.
- Suíte do desktop (`vitest`) verde, com uma asserção de que o selo não aparece durante a transmissão em modo janela.
- `build-all.yml` com a etapa de lint.
- Smoke manual: lupa com zoom e traços ainda chegam ao aluno; nenhum selo aparece ao focar janela não autorizada.
