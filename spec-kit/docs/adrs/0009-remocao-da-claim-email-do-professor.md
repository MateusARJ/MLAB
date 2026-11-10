# ADR 0009 — Remoção da claim `email` do JWT do professor

Status: APROVADA
Data: 2026-11-10
Feature impactada: `015-remove-claim-email` (issue #42); emenda o item 5 da ADR 0006
Numeração: 0009 porque a 0008 já está reservada pela `0008-https-na-lan-com-ca-local.md` da edição HTTPS
(`edicao/https-lan`), que não vai para a `development`.

## Contexto

A ADR 0006 removeu o login por e-mail e senha. No item 5 da decisão, ela manteve as claims do JWT do professor
(`sub`, `role`, `email` fixo, `name`, `exp`) para preservar a derivação do link fixo do professor (T032).

Hoje a claim `email` sempre vale `professor@mlab.local` (`apps/backend/internal/auth/handler.go`), e é lida em dois
pontos:

- `apps/backend/internal/room/handler.go`: fallback do slug do professor (`slugFromEmail`) quando o nome não vem na
  requisição nem na claim `name`;
- `apps/backend/internal/signaling/handler.go` (`extractName`): fallback do nome exibido quando falta a claim `name`.

Os dois caminhos estão mortos: `POST /auth/session` sempre grava `name` no token, com `"Professor"` quando o nome vem
vazio. Nenhum código em `apps/desktop`, `apps/web` ou `packages` lê `email`. O `contracts/auth.md` da feature 001
ainda documenta a claim como "mantida por compatibilidade".

## Problema

A claim é um resto do login removido. Ela sugere que o professor tem um e-mail ou uma conta, o que não é verdade
(ADR 0006, RF-12), e mantém código e testes de um fallback que não roda. Removê-la muda o contrato de autenticação,
o que exige ADR (AGENTS.md §9) e contradiz o item 5 da ADR 0006.

## Opções consideradas

### Opção A — Manter a claim `email` fixa

- Sem mudança de contrato.
- Mantém um dado falso no token e código morto em `auth`, `room` e `signaling`.

### Opção B — Remover a claim `email`

- As claims do professor passam a ser `sub`, `role`, `name`, `iat` e `exp`.
- O slug do professor continua `{titulo}/{nome}` (RN-06). Sem nome na requisição e no token, o segmento passa a ser
  `professor`, o mesmo valor que `professor@mlab.local` produzia.
- Sem a claim `name`, o nome exibido no signaling passa a ser `"Participante"`, o fallback que já existe.

## Decisão

**Opção B.** A claim `email` deixa de ser emitida e lida. Esta ADR substitui o item 5 da ADR 0006: as claims do JWT
do professor são `sub`, `role`, `name`, `iat` e `exp`, com TTL inalterado.

## Consequências

### Positivas

- O token deixa de carregar um e-mail fictício, coerente com a sessão sem conta da ADR 0006.
- Sai código morto (`slugFromEmail` e os ramos de fallback) e os testes dele.

### Negativas

- Muda o contrato `contracts/auth.md`. O impacto é nulo na prática: o token é emitido e lido pelo mesmo backend
  embarcado, o segredo JWT é aleatório a cada execução (ADR 0006, item 4), então nenhum token emitido por uma
  versão anterior sobrevive à atualização, e nenhum cliente lê `email`.

## Impacto em specs/contracts/tasks

- `spec-kit/specs/001-screen-share-core/contracts/auth.md`: remover `email` do exemplo de payload e da descrição.
- `spec-kit/docs/adrs/0006-descontinuacao-do-login-e-sessao-local.md`: nota no item 5 apontando para esta ADR.
- `AGENTS.md` §9: incluir esta ADR na lista de ADRs aprovadas.
- Nova feature `spec-kit/specs/015-remove-claim-email/` (spec, clarify, plan, tasks), com refactor em
  `internal/auth`, `internal/room` e `internal/signaling`.
- Versão: PATCH (`docs/versionamento.md` §2). Contrato interno ao mesmo binário, sem quebra para nenhum consumidor.

## Aprovação humana

- Responsável: MateusARJ
- Data: 2026-11-10
