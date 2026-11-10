# Converge: Formatação do Backend com gofmt

Feature: `014-gofmt-backend`
Mode: READ-ONLY sobre o código (só este arquivo e o `tasks.md` são escritos)
Data: 2026-11-10
Commit avaliado: `9b8c4a4`
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-141 a C-143), `plan.md`, `tasks.md` (T141, T142)
- código: os 9 arquivos de `apps/backend` listados na spec
- suítes: `go build ./...`, `go vet ./...` e `go test -count=1 ./...` em `apps/backend` (6 pacotes verdes)

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-141 | `git show HEAD:<arquivo>` passado ao `gofmt -l`, em todos os `.go` de `apps/backend` @ `9b8c4a4`: nenhum listado (antes: 9) |
| RNF-141 | `git diff -w --ignore-blank-lines` do commit `9b8c4a4` vazio; o diff completo tem 206 inserções e 211 remoções, só espaço e linhas em branco; `go.mod` e `package.json` intocados |

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta | Evidência |
|---|---|---|
| — | — | nenhum |

## 3. Divergências (código ≠ spec/plan/contrato)

| Item | Spec/contrato diz | Código faz | Encaminhamento |
|---|---|---|---|
| — | — | — | nenhuma |

## 4. Código sem requisito (implementado fora de spec/task)

| Comportamento | Onde | Encaminhamento |
|---|---|---|
| — | — | nenhum |

## 5. Testes faltantes

- Nenhum. A mudança é só de formatação, e a suíte do backend continua verde.
- Sem checagem de `gofmt` no CI (Non-Goal): o formato pode voltar a divergir.

## 6. Novas tasks necessárias

- Nenhuma na 014.

## 7. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| — | — | — | nenhum |

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| nenhum | 1.10.0 (sem mudança) | Só `style` e `spec-kit`; o binário e o instalador não mudam (C-143). |

## 9. Resultado

- [ ] OPEN
- [x] CONVERGED — o backend inteiro está no formato do `gofmt`, sem mudança de comportamento.
