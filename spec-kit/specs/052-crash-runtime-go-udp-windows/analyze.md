# Analyze: Crash do Runtime Go na Leitura UDP do Windows

Feature: `052-crash-runtime-go-udp-windows`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma entre os artefatos da feature.

- Spec, clarify (C-5201 a C-5203) e plan concordam: Go 1.26.11 pela diretiva `go`, saída de crash por
  `SetCrashOutput` no `MLAB_LOG_FILE`, reação do app fora (053), PATCH.
- O workflow do CI fica fora do Scope Lock e não precisa mudar: ele lê a versão do `go.mod`.

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-5201 | T5201 |
| RF-5202, RF-5203 | T5202 |
| RNF-5201 | T5201, T5202 |
| RNF-5202 | T5201 (`go.sum`), T5202 (só biblioteca padrão) |
| RNF-5203 | T5202 |

## 3. Contratos

- Nenhum contrato muda. O contrato `034/contracts/backend-embarcado.md` (variáveis de ambiente) não ganha variável.

## 4. Tarefas fora do Scope Lock

Nenhuma. A T5201 toca só `go.mod`/`go.sum`; a T5202 só `cmd/server`; a T5203 só documentos da feature; a T5204 só os
manifests, via `npm run bump`.

## 5. Riscos

- Regressão por patch do Go, escrita intercalada no log e toolchain local diferente: mitigados no plan §3.

## 6. Resultado

- [ ] FAIL
- [x] PASS: a próxima execução é a T5201.
