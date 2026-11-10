# Converge: Remoção da Claim `email` do JWT do Professor

Feature: `015-remove-claim-email`
Mode: READ-ONLY sobre o código (só este arquivo e o `tasks.md` são escritos)
Data: 2026-11-10
Commit avaliado: `106a2a4`
Status: CONVERGED

## Entradas

- ADR 0009 (aprovada em 2026-11-10), `spec.md`, `clarify.md` (C-151 a C-155), `plan.md`, `tasks.md` (T151–T155)
- contrato: `spec-kit/specs/001-screen-share-core/contracts/auth.md` (emendado em `f351aa9`)
- código: `internal/auth/{jwt,handler}.go`, `internal/room/{handler,store}.go`, `internal/signaling/handler.go` e os
  testes desses pacotes
- suítes: `go build ./...`, `go vet ./...` e `go test -count=1 ./...` em `apps/backend` (6 pacotes verdes)

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-151 | `de9cae7`: `ProfessorMapClaims` grava só `sub`, `role`, `name`, `iat`, `exp`; `TestSessionEndpoint` (token real de `POST /auth/session`) e `TestSignAndParseProfessorToken` exigem a ausência de `email` |
| RF-152 | `62130c0`: sem ramo `claims["email"]` nem `slugFromEmail`; `TestCreateRoomFixedSlug` com token sem nome dá `matematica/professor`. `106a2a4`: `extractName` sem o ramo do e-mail; `TestExtractName` cobre "sem name e com email" → `"Participante"` |
| RNF-151 | testes de slug e nome com `name` presente (`TestCreateRoomFixedSlug` com nome, testes de `files`, `mdns`, `hub`) continuam verdes; `go.mod` e `go.sum` intocados |

`git grep -n '"email"\|slugFromEmail' -- apps/backend` só encontra os testes do `/auth/login` removido
(`cmd/server/smoke_test.go:47`, `internal/auth/auth_test.go:113`), as asserções de ausência da claim
(`auth_test.go:46,252`) e o caso "sem name e com email" de `TestExtractName`.

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

- Sem teste ponta a ponta com o app desktop; nenhum cliente lê `email` (verificado por busca em `apps/desktop`,
  `apps/web` e `packages`).

## 6. Novas tasks necessárias

- Nenhuma na 015.
- **Integração com o PR #57 (feature 016, renomeação do módulo Go):** o arquivo novo
  `internal/signaling/handler_test.go` importa `github.com/screenshare/classroom/internal/auth`. O PR que for
  mergeado por último precisa de rebase trocando esse import para `github.com/MateusARJ/MLAB/apps/backend/...` e
  refazendo o bump (os dois PRs sobem de 1.10.0 para 1.10.1).
- `internal/room/store.go` continua fora do `gofmt` no bloco `var` antigo; a correção está no PR #56 (feature 014).

## 7. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| — | — | — | nenhum |

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| PATCH | 1.10.1 | Refatoração sem mudança de capacidade; o contrato `auth.md` muda, mas o token é emitido e lido pelo mesmo backend, o segredo é aleatório por execução e nenhum cliente lê `email` (C-155). |

## 9. Resultado

- [ ] OPEN
- [x] CONVERGED — o token do professor não tem mais a claim `email`, e o backend não a lê.
