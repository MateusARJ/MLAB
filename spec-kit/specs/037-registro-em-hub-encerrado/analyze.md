# Analyze: Conexão Recusada em Sala Encerrada pelo Hub

Feature: `037-registro-em-hub-encerrado`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma entre os artefatos da feature.

- Spec, clarify (C-3701 a C-3704) e plan concordam: guarda no `onRegister`, hub encerrado como marcador, consulta ao
  store na criação, `410` antes do upgrade, PATCH.
- A US-3601 da 036 (hub novo depois do encerramento) é substituída de forma explícita (C-3702); o RF-3601 da 036
  (leitura sincronizada) continua e é usado aqui (`isClosed`).
- RN-13 e RF-18 (001) não mudam; o contrato só ganha nota sobre mensagens e respostas que já existem.

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-3701 | T3701, T3702, T3704 |
| RF-3702 | T3703, T3704 |
| RF-3703 | T3703 |
| RF-3704 | T3701, T3703, T3704 |
| RNF-3701 | T3703 |
| RNF-3702 | T3701 |
| RNF-3703 | todas: nenhuma dependência nova |

## 3. Contratos

- `001/contracts/signaling.md`: nota de comportamento (T3701). Sem tipo, campo ou código novo; web e desktop já tratam
  `room-closed`/fechamento.

## 4. Tarefas fora do Scope Lock

Nenhuma. T3702 toca só `hub.go` e `hub_closed_test.go`; T3703 só `handler.go` e os dois testes; T3704 só
`hub_closed_test.go`; T3701 e T3705 só documentos; T3706 só manifests via `npm run bump`.

## 5. Riscos

- Deadlock: ordem `Handler.mu` → store verificada (RNF-3701).
- Regressão no teste da 036: ajuste previsto na T3703.

## 6. Resultado

- [ ] FAIL
- [x] PASS: próxima execução, T3701.
