# Spec: E2E A19 com a Recusa da Matrícula Já Conectada

Status: READY
Feature ID: `042-e2e-a19-sessao-unica`
Origem: issue #126 (desvio encontrado na 028/T2810). Atualiza um teste e2e; não muda regra de negócio, contrato,
código de produção nem ADR.

## 1. Objetivo

Fazer o e2e A19 do aluno verificar a regra de sessão única em vigor (RN-04, ADR 0010, 027/RF-2701): a segunda aba
com a mesma matrícula é recusada na entrada e a primeira continua ao vivo.

## 2. Contexto

Verificado em 2026-11-16 na `development` @ `0873ec8` (2.0.0):

- `apps/web/e2e/aluno.e2e.ts` (A19) ainda espera a regra anterior à ADR 0010: a segunda aba entra e a primeira cai com
  `4001`, voltando à entrada com o aviso "outra aba ou dispositivo".
- `apps/backend/internal/room/handler.go` (`handleJoin`) responde `409` quando `Hub.HasConnectedStudent` é verdadeiro;
  o `4001` só vale para o mesmo participante (mesmo token), em `signaling/hub.go`.
- A página de entrada mostra "Esta matrícula já está conectada nesta transmissão." no `409`
  (`apps/web/src/pages/Join.test.tsx`, teste da 027).
- O teste também depende de tempo: `joinAsStudent` (`apps/web/e2e/fixtures.ts`) só espera a URL `/ao-vivo`, não o
  registro do WebSocket da primeira aba no hub. Por isso o A19 antigo às vezes passava.
- O hub faz broadcast de `participant-joined` (com `student_id`) aos demais clientes da sala depois de registrar o
  aluno (`signaling/hub.go`, `onRegister`); o fixture do professor já tem `waitFor`.

## 3. Escopo

### Incluído

- Reescrever o A19 em `apps/web/e2e/aluno.e2e.ts` para a recusa da ADR 0010, sem depender de tempo.

### Não incluído

- Mudanças em `apps/web/src/**`, `apps/backend/**`, `apps/desktop/**`, `packages/**` e no fixture `fixtures.ts`.
- Os relatórios históricos de smoke em `docs/metrics/` (registros datados de execuções anteriores).

## 4. Atores

- **Aluno:** entra pela primeira aba e tenta entrar de novo pela segunda, com a mesma matrícula.
- **Professor (fixture):** recebe `participant-joined` e serve de sinal de que o hub registrou a primeira aba.

## 5. User Stories

### US-4201 — E2E da sessão única confiável

Como mantenedor, quero que o A19 verifique a regra de sessão única em vigor de forma determinística, para que o
`npm run e2e` só falhe quando a regra quebrar.

- Dado um aluno ao vivo na aba 1, cujo registro no hub o professor já recebeu, quando a aba 2 envia a entrada com a
  mesma matrícula, então a aba 2 fica em `/entrar` com o aviso "Esta matrícula já está conectada nesta transmissão."
  e a aba 1 continua em `/ao-vivo`.

## 6. Requisitos Funcionais

- RF-4201: o A19 espera o `participant-joined` da matrícula da aba 1 no professor antes da entrada da aba 2.
- RF-4202: o A19 verifica que a aba 2 continua em `/entrar` com o alerta do `409`.
- RF-4203: o A19 verifica que a aba 1 continua em `/ao-vivo` depois da recusa.

## 7. Requisitos Não Funcionais

- RNF-4201 — estabilidade: `npx playwright test -g "A19" --repeat-each=3 --retries=0` verde.
- RNF-4202 — contrato e produção: nenhum arquivo fora de `apps/web/e2e/aluno.e2e.ts` e dos artefatos da feature muda.
- RNF-4203 — dependências: nenhuma nova.

## 8. Estados e Erros

| Situação | Evento | Resultado esperado no teste |
|---|---|---|
| aba 1 ao vivo e registrada no hub | aba 2 envia a entrada com a mesma matrícula | aba 2 em `/entrar` com o alerta do `409` |
| aba 2 recusada | — | aba 1 continua em `/ao-vivo` |

## 9. Edge Cases

- Entrada da aba 2 antes do registro do WS da aba 1: evitada pela espera do `participant-joined` (RF-4201).

## 10. Dados/Contratos impactados

- Nenhum.

## 11. Critérios de Sucesso

- A19 verde três vezes seguidas sem retry; e2e do aluno verde.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-4201 e C-4202).
