# Spec: Nome do Módulo Go do Backend

Status: READY
Feature ID: `016-modulo-go-mlab`
Origem: issue #43 (desvio registrado durante a #40): o módulo Go do backend ainda se chama
`github.com/screenshare/classroom`, nome antigo do projeto.

## 1. Objetivo

Renomear o módulo Go de `apps/backend` para `github.com/MateusARJ/MLAB/apps/backend`, que corresponde ao repositório
real, sem mudar comportamento.

## 2. Contexto

Verificado em 2026-11-10 na `development` @ `6795abb`:

- `apps/backend/go.mod` declara `module github.com/screenshare/classroom`;
- 10 arquivos `.go` importam pacotes internos com esse prefixo: `cmd/server/main.go`,
  `internal/room/{files,files_test,handler,room_security_test,room_test}.go`,
  `internal/signaling/{handler,hub,signaling_security_test}.go` e `internal/webrtc/sfu.go`;
- `scripts/build-backend.js` e os scripts `build:backend*` compilam `./cmd/server` sem `-ldflags -X` com o caminho do
  módulo; nada fora de `apps/backend` importa o módulo;
- `docs/metrics/smoke-backend.jsonl` traz o nome antigo como registro histórico de execuções de teste.

## 3. Escopo

### Incluído

- a diretiva `module` do `go.mod` e todos os imports internos do backend.

### Não incluído

- reescrever registros históricos (`docs/metrics/**`);
- mudar nomes de pacote, diretórios ou comportamento;
- mudar dependências externas (`go.sum`).

## 4. Requisitos

- RF-161: o módulo Go de `apps/backend` se chama `github.com/MateusARJ/MLAB/apps/backend`, e nenhum arquivo de
  `apps/` ou `packages/` referencia `github.com/screenshare/classroom`.
- RNF-161: sem mudança de comportamento nem de dependência externa; `go build`, `go vet`, `go test` e o build do
  backend embarcado (`build:backend:win`) continuam funcionando.

## 5. Critérios de Sucesso

- `git grep screenshare/classroom -- apps packages` vazio.
- `go build ./...`, `go vet ./...` e `go test -count=1 ./...` em `apps/backend` verdes.
- `npm run build:backend:win --workspace=apps/desktop` gera o binário.
- `npm run spec:check` com PASS para `016-modulo-go-mlab`.
