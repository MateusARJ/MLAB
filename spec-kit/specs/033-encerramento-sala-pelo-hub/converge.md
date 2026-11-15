# Converge: Encerramento da Sala pelo Hub Reflete no Store

Feature: `033-encerramento-sala-pelo-hub`
Mode: READ-ONLY sobre o código (só este arquivo, o `tasks.md`, o espelho `RF015` e as evidências do `001/converge.md`
são escritos)
Data: 2026-11-15
Commits avaliados: `3f5c06a` (artefatos), `00ae08b` (T3301), `7cca5f7` (T3302), `f9f3ac6` (T3303)
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-3301 a C-3305), `plan.md`, `tasks.md` (T3301 a T3305)
- contrato: `001/contracts/room-api.md` (`GET /rooms/{roomId}/info`); RN-08, RN-13, RF-15 e RF-18 da 001
- código: `apps/backend/internal/room/handler.go` (`CloseRoomFromSession`), `apps/backend/cmd/server/main.go`
- suítes:
  - `go vet ./...` e `go test -count=1 ./...` em `apps/backend`: todos os pacotes verdes;
  - `go test -count=1 -tags smoke -run TestSmoke ./cmd/server/`: verde (A18 em ~31 s; subteste T3303 em ~1 s);
  - `gofmt -l` vazio nos arquivos Go alterados (conferido sem o CRLF da cópia de trabalho);
  - prova de falha: com o listener antigo (`ReleaseRoomFiles`), o subteste T3303 falha com `join` e `info` → `200`,
    reproduzindo a issue #94; com a correção, passa.

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-3301 | `room/handler.go` (`CloseRoomFromSession`); `main.go` (`SetRoomClosedListener`); `TestCloseRoomFromSession`; smoke A18 e T3303 |
| RF-3302 | `TestCloseRoomFromSession` (`join` por id e slug, `info` por id e slug, `/rooms/active` → 404); smoke `expectRoomGone` |
| RF-3303 | `001/contracts/room-api.md` (`/info` sem `closed` no 200; dois 404 documentados), commit `00ae08b` |
| RNF-3301 | `TestCloseRoomFromSession` (`mdnsStop` chamado uma vez; aviso repetido e aviso atrasado com sala nova não param o mDNS) |
| RNF-3302 | `TestCloseRoomFromSession` (repetição e sala inexistente sem falha) |
| RNF-3303 | nenhuma dependência nova |

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta | Evidência |
|---|---|---|
| — | — | nenhum |

## 3. Divergências (código ≠ spec/plan/contrato)

| Item | Spec/contrato diz | Código faz | Encaminhamento |
|---|---|---|---|
| Status da sala no store | `/info`, `/rooms/active` e `join` com `waiting \| publishing \| reconnecting` | sempre `waiting` | issue #101 (desvio, não bloqueante) |

- As divergências das issues #94 (encerramento pelo hub) e #95 (contrato do `/info`) estão resolvidas por esta feature.

## 4. Código sem requisito (implementado fora de spec/task)

| Comportamento | Onde | Encaminhamento |
|---|---|---|
| — | — | nenhum |

## 5. Testes faltantes

- `go test -race` não pôde ser executado (Windows sem cgo). A leitura de `hub.status` fora da goroutine do hub foi
  registrada na issue #102.
- Verificação manual com o app desktop (fechar o app à força e abrir o link após 30 s) não foi executada; o smoke cobre
  o mesmo caminho no servidor real.

## 6. Novas tasks necessárias

- Nenhuma na 033. Follow-ups em #101 e #102.

## 7. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| #101 | `bug`, `desvio`, `area:backend` | não | store nunca grava `publishing`/`reconnecting` |
| #102 | `bug`, `desvio`, `area:backend` | não | `getOrCreateHub` lê `hub.status` fora da goroutine do hub |

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| PATCH | 1.15.3 | Correção que alinha o backend à RN-13/RF-18 sem mudança de capacidade; a mudança no contrato do `/info` só documenta o que o servidor já respondia (C-3305). |

## 9. Resultado

- [ ] OPEN
- [x] CONVERGED — o encerramento pelo hub (timeout ou `end-session`) remove a sala do store como a REST `close`; o
  link passa a responder `404`; o contrato do `/info` descreve o que o servidor responde.
