# Converge: Join em Sala Encerrada Responde 409

Feature: `029-join-sala-encerrada`
Mode: READ-ONLY sobre o código (só este arquivo, o `tasks.md` e a evidência do `001/converge.md` são escritos)
Data: 2026-11-14
Commits avaliados: `96e21bc` (artefatos), `08ba885` (T2901 + T2902)
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-2901 a C-2903), `plan.md`, `tasks.md` (T2901 a T2903)
- contrato: `001/contracts/room-api.md` (`409 Room closed` no `join`), RN-08 da 001, espelho `RN008`
- código: `apps/backend/internal/room/handler.go` (`handleJoin`)
- suítes:
  - `go vet ./...` e `go test -count=1 ./...` em `apps/backend`: todos os pacotes verdes;
  - `go test -tags smoke -run TestSmoke ./cmd/server/`: verde;
  - `gofmt -l` vazio nos arquivos Go alterados (conferido sem o CRLF da cópia de trabalho);
  - `TestJoinSalaEncerrada` falhou antes da correção (`esperado 409, obtido 404`) e passa depois.

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-2901 | `room/handler.go` (`handleJoin`, ramo `StatusClosed` → `http.StatusConflict`); `TestJoinSalaEncerrada` (409, mensagem, sem token, nenhum participante) |
| RF-2902 | `TestJoinSalaEncerrada` (checker de matrícula conectada sempre `true` → ainda o 409 de sala encerrada) |
| RF-2903 | `TestJoinSalaEncerrada` (id inexistente → 404) |
| RNF-2901 | mensagem inalterada; `apps/web` e o E2E usam só o texto do `error` |
| RNF-2902 | nenhuma dependência nova |

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta | Evidência |
|---|---|---|
| — | — | nenhum |

## 3. Divergências (código ≠ spec/plan/contrato)

| Item | Spec/contrato diz | Código faz | Encaminhamento |
|---|---|---|---|
| Encerramento só pelo hub (timeout de 30 s ou `end-session` sem a REST `close`) | sala encerrada rejeita entradas (RN-08) | sala segue ativa no store; `join` → `200` | issue #94 (desvio, não bloqueante) |
| `GET /rooms/{id}/info` de sala encerrada | `200` com `status: closed` | `404` | issue #95 (desvio, não bloqueante) |

- A divergência da issue #86 (`409` × `404` no `join`) está resolvida por esta feature.
- `001/converge.md` citava `room_test.go` como evidência da RN-08 sem teste correspondente; agora aponta
  `TestJoinSalaEncerrada`.

## 4. Código sem requisito (implementado fora de spec/task)

| Comportamento | Onde | Encaminhamento |
|---|---|---|
| — | — | nenhum |

## 5. Testes faltantes

- E2E do aluno (`apps/web/e2e`, Playwright) não foi executado. O teste de sala encerrada usa a REST `close`, que remove
  a sala; o aluno recebe `404 "sala não encontrada"`, caminho que esta feature não altera.

## 6. Novas tasks necessárias

- Nenhuma na 029. Follow-ups em #94 e #95.

## 7. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| #94 | `bug`, `desvio`, `area:backend` | não | encerramento pelo hub não marca a sala como encerrada no store |
| #95 | `documentation`, `desvio`, `area:spec-kit` | não | contrato do `/info` lista `closed` no `200`; código responde `404` |

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| PATCH | 1.15.1 | Correção que alinha o código ao contrato existente, sem mudança de capacidade nem de contrato (C-2903). |

## 9. Resultado

- [ ] OPEN
- [x] CONVERGED — o `join` de sala encerrada responde `409` com a mensagem de sempre, antes da matrícula conectada e
  da sala cheia; sala inexistente segue com `404`.
