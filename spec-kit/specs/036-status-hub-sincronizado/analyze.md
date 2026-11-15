# Analyze: Leitura Sincronizada do Status do Hub

Feature: `036-status-hub-sincronizado`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma entre os artefatos da feature.

- Spec, clarify (C-3601 a C-3604) e plan concordam: mutex próprio, escrita única por `writeStatus`, leitura externa
  por `isClosed`, `-race` só no CI Linux, PATCH.
- RN-13 e RF-18 (001) não mudam; o aviso de status da 035 e o encerramento da 033 seguem iguais (RNF-3602).
- O plan da 035 listava esta correção como non-goal "se o `-race` acusar, vira desvio": é a issue #102, tratada aqui.

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-3601 | T3601, T3602 |
| RNF-3601 | T3603 |
| RNF-3602 | T3601 |
| RNF-3603 | todas: nenhuma dependência nova |

## 3. Contratos

- Nenhum contrato REST, WebSocket ou de `packages/types` muda.

## 4. Tarefas fora do Scope Lock

Nenhuma. T3601 toca só `hub.go` e `handler.go`; T3602 só `hub_status_test.go`; T3603 só `build-all.yml`; T3604 só
documentos da feature; T3605 só manifests via `npm run bump`.

## 5. Riscos

- Deadlock: callbacks fora do lock (T3601).
- Race preexistente revelada pelo `-race`: vira desvio (AGENTS §14), não é corrigida aqui.
- `workflow_dispatch` dispara release: proibido na T3603.

## 6. Resultado

- [ ] FAIL
- [x] PASS: próxima execução, T3601.
