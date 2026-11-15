# Converge: Conexão Recusada em Sala Encerrada pelo Hub

Feature: `037-registro-em-hub-encerrado`
Mode: READ-ONLY sobre o código (só este arquivo e o `tasks.md` são escritos)
Data: 2026-11-15
Commits avaliados: `4822748` (artefatos), `3c823e0` (T3701), `585f289` (T3702), `c783848` (T3703), `df3ab4c` (T3704)
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-3701 a C-3704), `plan.md`, `tasks.md` (T3701 a T3706)
- contrato: `001/contracts/signaling.md` (seção "Conexão a sala encerrada")
- código: `signaling/hub.go` (`onRegister`), `signaling/handler.go` (`serveWS`, `getOrCreateHub`),
  `signaling/hub_closed_test.go`, `signaling/hub_status_test.go`
- suítes:
  - `go vet ./...` e `go test ./...` em `apps/backend`: todos os pacotes verdes;
  - `go test -tags smoke -run TestSmoke ./cmd/server/`: verde (~57 s);
  - `go test -count=20 -run TestServeWS_ConexaoDuranteEncerramento ./internal/signaling/`: verde;
  - `gofmt -l` vazio nos arquivos Go alterados (conferido sem o CRLF da cópia de trabalho);
  - prova do defeito: os dois testes do `onRegister` falham sem a guarda (o professor recebia `session-state`,
    `participants-update` e `publish-approved`), e o teste de ponta a ponta falha com conexões presas sem
    `room-closed` quando a guarda é desligada.

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-3701 | `hub.go` (guarda no início do `onRegister`); `TestHub_RegistroAposEncerramento_AlunoRecebeRoomClosed`; `TestHub_RegistroAposEncerramento_ProfessorNaoReabreSessao` |
| RF-3702 | `handler.go` (`getOrCreateHub` devolve `ok=false` com hub encerrado e o mantém como marcador); `TestHandler_GetOrCreateHubConcorrenteAoEncerramento`; `TestHandler_HandshakeComHubEncerrado` |
| RF-3703 | `handler.go` (consulta ao store sob `h.mu` na criação); `TestHandler_GetOrCreateHub_ConsultaOStore` |
| RF-3704 | `handler.go` (`serveWS` obtém o hub antes do upgrade e responde `410`); `TestHandler_HandshakeComHubEncerrado`; `TestServeWS_ConexaoDuranteEncerramento` |
| RNF-3701 | ordem `Handler.mu` → store; store não chama o handler; `-race` no CI Linux (036/T3603) |
| RNF-3702 | contrato só com nota (commit `3c823e0`); nenhum tipo, campo ou código novo |
| RNF-3703 | nenhuma dependência nova (`gorilla/websocket` já era usado) |

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta | Evidência |
|---|---|---|
| RNF-3701 | execução do `-race` | o detector não roda localmente (Windows sem cgo); o passo do CI Linux roda no PR de release `development → main` |

## 3. Divergências (código ≠ spec/plan/contrato)

| Item | Plan diz | Código faz | Encaminhamento |
|---|---|---|---|
| — | — | — | nenhuma |

- A US-3601 da 036 (hub novo depois do encerramento) foi substituída, como previsto em C-3702; o teste da 036 foi
  ajustado na T3703.

## 4. Código sem requisito (implementado fora de spec/task)

| Comportamento | Onde | Encaminhamento |
|---|---|---|
| — | — | nenhum |

## 5. Testes faltantes

- `go test -race` não executado localmente (ver seção 2).
- Verificação manual com o app desktop não foi executada; a corrida foi exercitada com clientes WebSocket reais no
  teste de ponta a ponta.

## 6. Novas tasks necessárias

- Nenhuma nesta feature.

## 7. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| #109 | `bug`, `desvio`, `area:backend` | não | a goroutine `run()` do hub continua viva depois do encerramento; o marcador da 037 mantém o hub no mapa. Fica para feature própria |

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| PATCH | 1.15.7 | Correção de comportamento no backend: conexão a sala encerrada é recusada com `410` ou `room-closed`, que já existiam; sem capacidade nova nem mudança de contrato (C-3704). |

## 9. Resultado

- [ ] OPEN
- [x] CONVERGED — nenhuma conexão entra numa sessão encerrada: o hub recusa o registro com `room-closed`, o handler
  não recria hub de sala encerrada nem cria hub de sala fora do store, e o handshake responde `410`.
