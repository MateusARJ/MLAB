# Plan: Crash do Runtime Go na Leitura UDP do Windows

Feature: `052-crash-runtime-go-udp-windows`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-5201 a C-5203)

## 1. Summary

1. `apps/backend/go.mod`: `go 1.26.0` → `go 1.26.11`. O CI (`.github/workflows/build-all.yml`, `setup-go` com
   `go-version-file`) passa a instalar a 1.26.11 sem mudar o workflow.
2. `apps/backend/cmd/server/lifecycle.go`: função `setCrashLog(path string) error`, que abre o arquivo em append e
   chama `debug.SetCrashOutput(f, debug.CrashOptions{})`. O runtime duplica o descritor, então o arquivo é fechado
   logo em seguida.
3. `apps/backend/cmd/server/main.go`: logo depois do `log.SetOutput`, chama `setCrashLog` quando `MLAB_LOG_FILE`
   está definido; em erro, registra um aviso e segue.
4. `apps/backend/cmd/server/lifecycle_test.go`: o teste executa o próprio binário de teste como subprocesso, que
   chama `setCrashLog` e provoca um `panic`; confere que o texto chega ao arquivo e ao stderr.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Versão do Go | 1.26.11, pela diretiva `go` | C-5201 |
| Saída de crash | `runtime/debug.SetCrashOutput` (Go ≥ 1.23) | RF-5202 |
| Arquivo | o mesmo `MLAB_LOG_FILE`, aberto em append | RF-5202 |
| Falha ao abrir | aviso no log e segue | RF-5203 |
| Versão do app | PATCH (2.2.1 → 2.2.2) | C-5203 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Patch da 1.26 mudar comportamento | regressão no backend | só correções de patch; `go vet` e `go test` completos |
| Duas aberturas do mesmo arquivo intercalarem escrita | linhas misturadas no crash | append nos dois; o crash é a última escrita do processo |
| Toolchain local diferente do CI | teste com outra versão | `GOTOOLCHAIN` baixa a 1.26.11 pela diretiva `go`; conferir `go version` |

## Scope Lock

### IN

- versão do Go do backend; saída de crash do runtime no log persistente.

### OUT

- reação do app desktop à queda (053); dependências Go; workflow do CI; frontend.

### Allowed Paths

- `apps/backend/go.mod`, `apps/backend/go.sum`
- `apps/backend/cmd/server/main.go`, `apps/backend/cmd/server/lifecycle.go`,
  `apps/backend/cmd/server/lifecycle_test.go`
- `spec-kit/specs/052-crash-runtime-go-udp-windows/**`
- só na T5204, via `npm run bump`: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`

### Prohibited Paths

- `apps/backend/internal/**`, `apps/desktop/**`, `apps/web/**`, `packages/**/src/**`
- `.github/**`, `spec-kit/docs/adrs/**`, `docs/**`

### Dependencies

- Nenhuma nova. Toolchain Go 1.26.11.

### Non-Goals

- Detectar, avisar ou reiniciar o backend a partir do app (053).
- Migrar para Go 1.27.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: nenhuma regra de autorização muda.
- [x] Princípio III: a SFU não muda de arquitetura; só o runtime que a executa.
- [x] Princípio IV: nenhuma meta de desempenho declarada.
- [x] Princípio V: nenhum contrato muda.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: mudança restrita à versão do toolchain e a uma chamada de diagnóstico.
- [ ] Princípio VIII: converge ao final (T5203).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-19 | Go 1.26.11 (última de patch da 1.26) | C-5201 |
| 2026-11-19 | Crash no `mlab-backend.log` por `SetCrashOutput`; reação do app vai para a 053 | C-5202 |
| 2026-11-19 | Branch e PR a partir da/para a `main`; IDs `520x`; PATCH | C-5203 |
