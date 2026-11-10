# Spec: Remoção da Claim `email` do JWT do Professor

Status: READY
Feature ID: `015-remove-claim-email`
Origem: issue #42 (desvio registrado durante a #40). Decisão: ADR 0009 (aprovada em 2026-11-10), que substitui o
item 5 da ADR 0006.

## 1. Objetivo

Parar de emitir e de ler a claim `email` no JWT do professor. Ela é resto do login removido pela ADR 0006, sempre
vale `professor@mlab.local` e só alimenta dois fallbacks que não rodam na prática.

## 2. Contexto

Verificado em 2026-11-10 na `development` @ `6795abb`:

- `internal/auth/handler.go` assina o token com `SignProfessorToken(profID, "professor@mlab.local", name)`;
  `internal/auth/jwt.go` (`ProfessorMapClaims`, `SignProfessorToken`) recebe `email` e grava a claim;
- `internal/room/handler.go` (criação de sala) usa `slugFromEmail(claims["email"])` (`internal/room/store.go`) quando
  o nome do professor não vem na requisição nem na claim `name`;
- `internal/signaling/handler.go` (`extractName`) usa `claims["email"]` como nome quando falta a claim `name`;
- `POST /auth/session` sempre grava `name` (com `"Professor"` quando o nome vem vazio), então os dois fallbacks não
  rodam com tokens emitidos pelo próprio backend;
- nada em `apps/desktop`, `apps/web` ou `packages` lê `email`;
- `contracts/auth.md` da feature 001 documenta a claim "por compatibilidade".

## 3. Escopo

### Incluído

- emissão do token do professor sem `email`;
- remoção da leitura de `email` em `room` e `signaling`, e de `slugFromEmail`;
- emenda do contrato `spec-kit/specs/001-screen-share-core/contracts/auth.md`;
- ajuste dos testes de `auth`, `room` e `signaling`.

### Não incluído

- mudança na regra do slug (RN-06) ou da sessão do professor (RN-01, RF-12);
- os testes que garantem que `POST /auth/login` continua removido (`auth_test.go` e `cmd/server/smoke_test.go`
  enviam `email` no corpo de propósito);
- `apps/desktop`, `apps/web`, `packages`.

## 4. Requisitos

- RF-151: o token emitido por `POST /auth/session` tem as claims `sub`, `role`, `name`, `iat` e `exp`, e não tem
  `email` (ADR 0009).
- RF-152: o backend não lê a claim `email`. Sem nome na requisição e sem claim `name`, o segmento do professor no
  slug é `professor`; o nome exibido no signaling é `"Participante"`.
- RNF-151: com nome presente, o comportamento observável não muda (slug `{titulo}/{nome}`, nome no chat e na
  sinalização); sem dependência nova.

## 5. Critérios de Sucesso

- Teste do `POST /auth/session` confirma a ausência de `email` no token.
- `git grep -n '"email"\|slugFromEmail' -- apps/backend` só encontra os testes do `/auth/login` removido.
- `go build ./...`, `go vet ./...` e `go test -count=1 ./...` em `apps/backend` verdes.
- `npm run spec:check` com PASS para `015-remove-claim-email`.
