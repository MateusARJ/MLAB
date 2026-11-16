# Converge: Leitura Sincronizada do Status do Hub

Feature: `036-status-hub-sincronizado`
Mode: READ-ONLY sobre o código (só este arquivo e o `tasks.md` são escritos)
Data: 2026-11-15
Commits avaliados: `b915d7c` (artefatos), `581bb54` (T3601), `e5d276a` (T3602), `89671fc` (T3603)
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-3601 a C-3604), `plan.md`, `tasks.md` (T3601 a T3605)
- código: `signaling/hub.go` (`statusMu`, `writeStatus`, `isClosed`), `signaling/handler.go` (`getOrCreateHub`),
  `signaling/hub_status_test.go`, `.github/workflows/build-all.yml`
- suítes:
  - `go vet ./...` e `go test ./...` em `apps/backend`: todos os pacotes verdes;
  - `go test -count=50 -run TestHandler_GetOrCreateHubConcorrenteAoEncerramento ./internal/signaling/`: verde;
  - `gofmt -l` vazio em `hub.go`, `handler.go` e `hub_status_test.go` (conferido sem o CRLF da cópia de trabalho);
  - `build-all.yml` validado como YAML (`js-yaml`).

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-3601 | `hub.go`: `writeStatus` é a única atribuição de `h.status` (`setStatus`, `onPublisherTimeout`, `onRoomClose`); `isClosed` sob `RLock`; `handler.go` usa `hub.isClosed()`; `TestHandler_GetOrCreateHubConcorrenteAoEncerramento` |
| RNF-3601 | `build-all.yml`: passo `go test -race ./internal/signaling/ ./cmd/server/` na perna `ubuntu-latest` (commit `89671fc`) |
| RNF-3602 | testes existentes do pacote `signaling` verdes sem alteração; `onStatusChanged`/`onClosed` chamados depois de `writeStatus` soltar o lock |
| RNF-3603 | nenhuma dependência nova |

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta | Evidência |
|---|---|---|
| RNF-3601 | execução do `-race` | o detector não roda localmente (Windows sem cgo; WSL sem Go/gcc; Docker parado). O `build-all.yml` só roda em PR para a `main` e por `workflow_dispatch`, e o `workflow_dispatch` também dispara o job de release, então não foi usado. A evidência fica para o PR de release `development → main`. |

## 3. Divergências (código ≠ spec/plan/contrato)

| Item | Plan diz | Código faz | Encaminhamento |
|---|---|---|---|
| — | — | — | nenhuma |

- A divergência da issue #102 (leitura de `hub.status` fora da goroutine do hub) está resolvida por esta feature.

## 4. Código sem requisito (implementado fora de spec/task)

| Comportamento | Onde | Encaminhamento |
|---|---|---|
| — | — | nenhum |

## 5. Testes faltantes

- `go test -race` não executado localmente (ver seção 2).

## 6. Novas tasks necessárias

- Nenhuma nesta feature. A janela TOCTOU segue na issue #107.

## 7. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| #107 | `bug`, `desvio`, `area:backend` | não | cliente pode ser registrado em hub encerrado entre `getOrCreateHub` e `register` (C-3602); fica para feature própria |

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| PATCH | 1.15.6 | Correção de concorrência no backend, sem mudança de capacidade nem de contrato (C-3604). |

## 9. Resultado

- [ ] OPEN
- [x] CONVERGED — o handler lê o status do hub sob o mutex próprio, sem data race; o CI Linux passa a rodar `-race`
  na sinalização. A execução do `-race` fica para o PR de release, e a janela TOCTOU segue na issue #107.
