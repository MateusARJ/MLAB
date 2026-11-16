# Converge: Término da Goroutine do Hub Encerrado

Feature: `041-termino-do-hub-encerrado`
Mode: READ-ONLY sobre o código (só este arquivo e o `tasks.md` são escritos)
Data: 2026-11-15
Commits avaliados: `a50194d` (artefatos), `7b7c70c` (T4101)
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-4101 a C-4103), `plan.md`, `tasks.md` (T4101 a T4103)
- código: `signaling/hub.go` (`done`, `run`, `release`, `closeSession`, `terminated`, `sendSignal`, `enroll`,
  `deliver`, `leave`, `Broadcast*`, timer), `signaling/client.go` (`readPump`), `signaling/handler.go` (`serveWS`),
  `signaling/hub_lifecycle_test.go`
- suítes:
  - `go vet ./...` e `go test -count=1 ./...` em `apps/backend` (Windows): todos os pacotes verdes;
  - `go test -tags smoke -run TestSmoke ./cmd/server/`: verde (~49 s);
  - `gofmt -l` vazio nos arquivos Go alterados (conferido sem o CRLF da cópia de trabalho);
  - num container `golang:1.26` (Linux, o mesmo Go do CI):
    - `go test -race -count=10 ./internal/signaling/`: verde, zero `DATA RACE`;
    - `go test -race -count=50 -run 'TestHub_Termina|TestHub_EnviosDepois|TestServeWS_HubEncerrado'`: verde;
    - `go test -count=200 -run 'TestServeWS_ConexaoDuranteEncerramento|TestServeWS_PrimeiraMensagemDepoisDoRegistro'`:
      verde (sem regressão da 037 e da 039);
    - `go test -race -count=5 ./internal/signaling/ ./cmd/server/` (o passo do CI Linux): verde, zero `DATA RACE`;
  - prova do defeito: `TestServeWS_HubEncerradoNaoDeixaGoroutine` sobre o código anterior (039) falha com
    `goroutines: 3 antes, 23 depois de encerrar 20 salas`, uma `run()` por sala.

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-4101 | `hub.go` (`run` confere `isClosed` depois de cada evento e fecha `done`); `TestHub_TerminaDepoisDoEndSession`, `TestHub_TerminaDepoisDeBroadcastRoomClosed`, `TestHub_TerminaDepoisDoTimeoutDeReconexao`, `TestServeWS_HubEncerradoNaoDeixaGoroutine` |
| RF-4102 | `hub.go` (`release`); `confereEstadoLiberado` nos três testes de término |
| RF-4103 | `hub.go` (`terminated`, `sendSignal`, `enroll`, `deliver`, `leave`, `BroadcastFileShared`); `client.go`; `handler.go`; `TestHub_EnviosDepoisDoTerminoNaoBloqueiam` |
| RF-4104 | `TestHandler_HandshakeComHubEncerrado`, `TestHub_GetOrCreateHub*` e `TestServeWS_ConexaoDuranteEncerramento` verdes |
| RNF-4101 | zero `DATA RACE` no container Linux |
| RNF-4102 | nenhum tipo, campo ou código novo; `message.go` intocado |
| RNF-4103 | nenhuma dependência nova |

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta | Evidência |
|---|---|---|
| — | — | nenhum |

## 3. Divergências (código ≠ spec/plan/contrato)

| Item | Plan diz | Código faz | Encaminhamento |
|---|---|---|---|
| — | — | — | nenhuma |

## 4. Código sem requisito (implementado fora de spec/task)

| Comportamento | Onde | Encaminhamento |
|---|---|---|
| — | — | nenhum |

## 5. Testes faltantes

- O CI Linux só roda no PR `development → main`; a verificação com `-race` foi feita num container com o mesmo Go.
- O timeout de reconexão é coberto pelo envio direto de `sigPublisherTimeout`, sem esperar os 30 s do timer
  (`publisherReconnectTimeout` é constante).

## 6. Novas tasks necessárias

- Nenhuma nesta feature.

## 7. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| — | — | — | nenhum desvio novo |

Observação: a primeira versão da T4101 conferia o término no início do laço de `run()`, e o `-race` acusou corrida com
testes antigos que chamam `onRoomClose()` direto, com a `run()` viva. O término passou a ser conferido depois de cada
evento (C-4101); corrigido dentro da tarefa, antes do commit.

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| PATCH | 1.15.10 | Correção de vazamento no backend; sem capacidade nova nem mudança de contrato (C-4103). Sobre a 1.15.9 da 039; se a `development` mudar de versão antes do merge, o bump é refeito. |

## 9. Resultado

- [ ] OPEN
- [x] CONVERGED: cada sala encerrada libera a goroutine e o estado do hub, e nenhum envio ao hub terminado bloqueia.
