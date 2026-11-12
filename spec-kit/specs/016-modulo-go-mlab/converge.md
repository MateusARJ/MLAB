# Converge: Nome do Módulo Go do Backend

Feature: `016-modulo-go-mlab`
Mode: READ-ONLY sobre o código (só este arquivo, o `tasks.md` e o `analyze.md` são escritos)
Data: 2026-11-10
Commit avaliado: `a7bcb29`
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-161 a C-163), `plan.md`, `tasks.md` (T161–T163)
- código: `apps/backend/go.mod` e os 10 `.go` com import interno
- suítes: `go build ./...`, `go vet ./...` e `go test -count=1 ./...` em `apps/backend` (6 pacotes verdes, já sob
  `github.com/MateusARJ/MLAB/apps/backend/...`)
- build: `npm run build:backend:win --workspace=apps/desktop` gerou `apps/backend/bin/server.exe`

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-161 | `a7bcb29`: `go.mod` com `module github.com/MateusARJ/MLAB/apps/backend`; `git grep screenshare/classroom -- apps packages` vazio |
| RNF-161 | diff de `a7bcb29`: 16 linhas trocadas, todas a diretiva `module` ou linhas de import; `go.sum` intocado; build, vet, testes e `build:backend:win` verdes |

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

- `npm run make:win` (instalador completo) não foi rodado nesta sessão; o binário do backend embarcado, que é a única
  parte afetada, foi gerado por `build:backend:win`.
- `room/files.go` e `signaling/hub.go` continuam fora do `gofmt` em pontos que não são imports; a correção está na
  feature 014 (issue #41, PR #56). A 016 não os formatou para não misturar escopos.

## 6. Novas tasks necessárias

- Nenhuma na 016.

## 7. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| — | — | — | nenhum |

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| PATCH | 1.10.1 | Refatoração sem mudança de capacidade nem de contrato; o binário do backend embarcado muda (C-163). |

## 9. Resultado

- [ ] OPEN
- [x] CONVERGED — o módulo Go se chama `github.com/MateusARJ/MLAB/apps/backend`, sem mudança de comportamento.
