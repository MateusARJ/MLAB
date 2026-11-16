# Converge: Registro do Cliente antes da Leitura

Feature: `039-registro-antes-da-leitura`
Mode: READ-ONLY sobre o código (só este arquivo e o `tasks.md` são escritos)
Data: 2026-11-15
Commits avaliados: `2c4e1e0` (artefatos), `ecce633` (T3901)
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-3901 e C-3902), `plan.md`, `tasks.md` (T3901 a T3903)
- código: `signaling/client.go` (`newClient`, `startReading`), `signaling/handler.go` (`serveWS`),
  `signaling/handler_register_test.go`
- suítes:
  - `go vet ./...` e `go test -count=1 ./...` em `apps/backend` (Windows): todos os pacotes verdes;
  - `gofmt -l` vazio nos arquivos Go alterados (conferido sem o CRLF da cópia de trabalho);
  - num container `golang:1.26` (Linux, o mesmo Go do CI):
    - `go test -count=200 -run TestServeWS_ConexaoDuranteEncerramento ./internal/signaling/`: verde (na
      `development`, o #114 mediu 2 falhas em 50);
    - `go test -race -count=50 -run 'TestServeWS_ConexaoDuranteEncerramento|TestServeWS_PrimeiraMensagemDepoisDoRegistro'
      ./internal/signaling/`: verde, zero `DATA RACE`;
    - `go test -race ./internal/signaling/ ./cmd/server/` (o passo do CI Linux): verde, zero `DATA RACE`;
  - prova do defeito: com `client.go` e `handler.go` da `development` @ `ecf1583`,
    `TestServeWS_PrimeiraMensagemDepoisDoRegistro` falha já na rodada 1 (`resposta ao subscribe-request não chegou:
    i/o timeout`); com a correção, passa em 5 × 20 rodadas no Windows e em 50 × 20 no Linux com `-race`.

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-3901 | `client.go` (`newClient` só inicia o `writePump`; `startReading`); `handler.go` (`startReading` depois do `register`); `TestServeWS_PrimeiraMensagemDepoisDoRegistro` |
| RF-3902 | `TestHub_RegistroAposEncerramento_*`, `TestServeWS_ConexaoDuranteEncerramento` e testes de sessão única verdes |
| RF-3903 | `ice-servers` continua depois do `register` (`handler.go`) |
| RNF-3901 | 200 execuções sem falha e `-race` sem corrida no container Linux |
| RNF-3902 | nenhum tipo, campo ou código novo; `hub.go` e `message.go` intocados |
| RNF-3903 | nenhuma dependência nova |

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
- Repetições longas de `TestServeWS_ConexaoDuranteEncerramento` no Windows falham por esgotamento de portas efêmeras
  (`connectex: ... apenas uma utilização de cada endereço de soquete`), limite do ambiente local, não do código; por
  isso a medição de 200 execuções é no Linux (plan §3).

## 6. Novas tasks necessárias

- Nenhuma nesta feature.

## 7. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| #109 | `bug`, `desvio`, `area:backend` | não | goroutine do hub encerrado continua viva; feature própria, depois desta (mexe nos mesmos arquivos) |

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| PATCH | 1.15.9 | Correção de concorrência no backend; sem capacidade nova nem mudança de contrato (C-3902). |

## 9. Resultado

- [ ] OPEN
- [x] CONVERGED: a leitura do cliente só começa depois do registro, e a primeira mensagem não é mais descartada. O
  teste de ponta a ponta da 037 fica estável no Linux.
