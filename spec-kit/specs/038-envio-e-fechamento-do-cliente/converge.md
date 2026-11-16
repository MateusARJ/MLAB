# Converge: Envio e Fechamento do Cliente sem Corrida

Feature: `038-envio-e-fechamento-do-cliente`
Mode: READ-ONLY sobre o código (só este arquivo e o `tasks.md` são escritos)
Data: 2026-11-15
Commits avaliados: `8d234cf` (artefatos), `b2fbf42` (T3801)
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-3801 e C-3802), `plan.md`, `tasks.md` (T3801 a T3803)
- código: `signaling/client.go` (`safeSend`, `closeWithCode`, campos `sendMu` e `closed`), `signaling/client_test.go`
- suítes:
  - `go vet ./...` e `go test -count=1 ./...` em `apps/backend`: todos os pacotes verdes;
  - `go test -tags smoke -run TestSmoke ./cmd/server/`: verde (~49 s);
  - `gofmt -l` vazio nos arquivos Go alterados (conferido sem o CRLF da cópia de trabalho e no container Linux);
  - `go test -race` num container `golang:1.26` (Linux, o mesmo Go do CI):
    - `-count=50 -run 'TestClient_|TestServeWS_ConexaoDuranteEncerramento'`: zero `DATA RACE`, e os testes
      `TestClient_*` passam em todas as execuções;
    - `./internal/signaling/ ./cmd/server/` (o passo do CI Linux), 5 execuções: zero `DATA RACE`;
  - prova do defeito: na `development` @ `a0b9243`, `go test -race -count=3 ./internal/signaling/` acusa 2
    `DATA RACE` entre `closechan` (`client.go`, via `hub.go` `onRegister`) e `chansend` (`safeSend`, via
    `handler.go` `serveWS`), como na CI do PR #26.

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-3801 | `client.go` (`safeSend` e `closeWithCode` sob `sendMu`; `closed` descarta o envio); `TestClient_EnvioDepoisDoFechamentoEDescartado`; `TestClient_EnviosConcorrentesAoFechamento` |
| RF-3802 | `client.go` (`select` com `default` sob o lock); `TestClient_BufferCheioDescartaSemBloquear` |
| RF-3803 | `client.go` (`closeOnce` mantido); `TestClient_SegundoFechamentoSemEfeito` |
| RNF-3801 | nenhuma operação bloqueante sob `sendMu`; zero `DATA RACE` com `-race` no container Linux |
| RNF-3802 | nenhum tipo, campo ou código novo; `hub.go`, `handler.go` e `message.go` intocados |
| RNF-3803 | nenhuma dependência nova |

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
- `TestServeWS_ConexaoDuranteEncerramento` ainda falha às vezes por `i/o timeout`, com ou sem esta feature. A causa é
  outra e está no #114 (seção 7).

## 6. Novas tasks necessárias

- Nenhuma nesta feature.

## 7. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| #114 | `bug`, `desvio`, `area:backend` | não para esta feature; sim para o PR de release #26 | a primeira mensagem do cliente pode ser descartada antes do registro no hub (o `readPump` começa antes do `register`); deixa instável o `TestServeWS_ConexaoDuranteEncerramento` (~4% sem `-race` na `development`). Fica para feature própria |
| #112 | `bug`, `desvio`, `area:ci`, `bloqueante` | não para esta feature; sim para o PR #26 | cota de artefatos do Actions esgotada |

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| PATCH | 1.15.8 | Correção de concorrência no backend; sem capacidade nova nem mudança de contrato (C-3802). |

## 9. Resultado

- [ ] OPEN
- [x] CONVERGED: envio e fechamento do canal do cliente são serializados, e o detector de race não acusa corrida no
  pacote `signaling`. A instabilidade restante do teste de ponta a ponta é o #114.
