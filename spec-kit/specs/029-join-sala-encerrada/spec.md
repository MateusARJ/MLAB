# Spec: Join em Sala Encerrada Responde 409

Status: READY
Feature ID: `029-join-sala-encerrada`
Origem: issue #86 (desvio registrado na 027). Restaura a conformidade com a RN-08 da `001-screen-share-core` e com
`001-screen-share-core/contracts/room-api.md`; não muda regra, contrato nem ADR.

## 1. Objetivo

Fazer o `POST /rooms/{id}/join` responder o status que a spec e o contrato definem para sala encerrada (`409`), em vez
do `404` que o código passou a devolver.

## 2. Contexto

Verificado em 2026-11-14 na `development` @ `7bb2499`:

- RN-08 (`001/spec.md`): "salas encerradas (`closed`) rejeitam novas entradas com HTTP 409".
- `001/contracts/room-api.md`, erros do `join`: "`409 Room closed` — sala já encerrada."
- Espelho `docs/requirements/business-rules/RN008-rejeicao-de-acesso-a-salas-encerradas.md`: `409 Room closed`.
- `apps/backend/internal/room/handler.go` (`handleJoin`): para `room.Status == StatusClosed` responde
  `404` "esta transmissão já foi encerrada e o link não está mais disponível".
- O código respondia `409 "sala já encerrada"` até o commit `15a8171`, que trocou o status para `404` sem alterar spec
  nem contrato. A spec nunca mudou: o código derivou.
- `001/converge.md` cita `room_test.go` como evidência do `409` de sala encerrada, mas nenhum teste cobre esse caso.
- Consumidores: `apps/web/src/services/api.ts` (`joinRoom`) lança o campo `error` do corpo para qualquer status não-2xx;
  o E2E (`apps/web/e2e/aluno.e2e.ts`) só verifica o texto `/encerrada/i`. O desktop não chama o `join`.
- Alcance: `closeRoom` e a recriação de sala marcam `closed` e logo removem a sala do store (`DeleteRoom`); o slug sai
  do índice ao marcar `closed`. No fluxo normal o aluno recebe `404 "sala não encontrada"` (sala removida), o que está
  de acordo com o contrato. O ramo de sala encerrada só é alcançado por sala `closed` ainda presente no store.

## 3. Escopo

### Incluído

- Backend: status `409` no ramo de sala encerrada do `handleJoin`, com teste.
- Correção da evidência da RN-08 no `001/converge.md`.

### Não incluído

- Encerramento da sala pelo hub (timeout de reconexão ou `end-session` sem a REST `close`) não marcar a sala no store
  — desvio registrado em issue própria.
- `GET /rooms/{id}/info` responder `404` para sala encerrada enquanto o contrato lista `closed` no `200` — desvio
  registrado em issue própria.
- Mudanças no web, no desktop, em `packages/types` e nos contratos.

## 4. Atores

- **Aluno:** tenta entrar numa sala que o professor já encerrou.

## 5. User Stories

### US-2901 — Recusa de sala encerrada conforme o contrato

Como cliente da API do `join`, quero receber o status documentado para sala encerrada, para distinguir "sala
encerrada" de "sala inexistente" sem depender do texto da mensagem.

- Dado que a sala está `closed`, quando o aluno chama o `join` com nome e matrícula válidos, então recebe `409` com
  `{"error": "esta transmissão já foi encerrada e o link não está mais disponível"}`, sem participante registrado e sem
  token.
- Dado que a sala não existe (ou já foi removida), quando o aluno chama o `join`, então continua recebendo `404`.

## 6. Requisitos Funcionais

- RF-2901: `POST /rooms/{id}/join` (e `/{sala}/{prof}/join`) responde `409` com
  `{"error": "esta transmissão já foi encerrada e o link não está mais disponível"}` quando a sala encontrada está
  `closed`. Nenhum participante é registrado e nenhum token é emitido.
- RF-2902: a verificação do RF-2901 continua antes da recusa por matrícula conectada (`409 Student ID in use`) e da
  sala cheia (`429`).
- RF-2903: slug ou id inexistente continua respondendo `404 "sala não encontrada"`.

## 7. Requisitos Não Funcionais

- RNF-2901 — compatibilidade: o status volta ao que o contrato já define; a mensagem não muda, então o web segue
  exibindo o mesmo texto.
- RNF-2902 — dependências: nenhuma nova.

## 8. Estados e Erros

| Situação | Evento | Resultado |
|---|---|---|
| sala `closed` presente no store | `join` | `409` com a mensagem de sala encerrada (RF-2901) |
| sala `closed` e matrícula conectada | `join` | `409` de sala encerrada (RF-2902) |
| sala removida ou id/slug inexistente | `join` | `404 "sala não encontrada"` (RF-2903) |

## 9. Edge Cases

- Sala encerrada pela REST `close`: é removida logo depois, então o link passa a dar `404` (RF-2903); o `409` vale na
  janela entre marcar `closed` e remover.
- Os dois `409` do `join` se distinguem pelo campo `error`.

## 10. Dados/Contratos impactados

- Nenhum. `001/contracts/room-api.md`, a RN-08 e o espelho `RN008` já dizem `409`.
- `001/converge.md`: evidência da RN-08 passa a citar o teste novo.

## 11. Critérios de Sucesso

- Teste Go do `join`: sala `closed` → `409` com a mensagem, nenhum participante registrado; com a matrícula
  conectada, o `409` é o de sala encerrada; sala inexistente → `404`.
- `go test ./...` verde em `apps/backend`.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-2901 a C-2903).
