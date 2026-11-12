# Plan: Remoção da Claim `email` do JWT do Professor

Feature: `015-remove-claim-email`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-151 a C-155)
ADR: `spec-kit/docs/adrs/0009-remocao-da-claim-email-do-professor.md`

## 1. Summary

1. **Contrato (antes do código):** tirar `email` do payload e da descrição do token do professor em
   `spec-kit/specs/001-screen-share-core/contracts/auth.md`, citando a ADR 0009.
2. **`internal/auth` (T151):** novas assinaturas (C-154) sem `email`; `handler.go` chama
   `SignProfessorToken(profID, name)`. Revisar todas as chamadas:
   - `internal/auth/auth_test.go` (3), `internal/auth/auth_security_test.go` (1);
   - `internal/room/files_test.go` (2), `internal/room/room_test.go` (4), `internal/room/room_security_test.go` (2).

   Chamadas que passavam só o e-mail passam a não passar nome, ou passam um nome explícito quando o teste depende
   dele. `TestSignAndParseProfessorToken` passa a exigir a ausência de `email`; `TestSessionEndpoint` também.
3. **`internal/room` (T152):** remover o ramo `claims["email"]` da criação de sala e `slugFromEmail`; remover
   `TestSlugFromEmail`. `TestCreateRoomFixedSlug` usa token sem nome e continua esperando `matematica/professor`,
   o que cobre o fallback (C-152).
4. **`internal/signaling` (T153):** remover o ramo `claims["email"]` de `extractName`; novo teste de `extractName`
   (com `name` → o nome; sem `name`, mesmo com `email` → `"Participante"`).
5. **Versão (T154):** PATCH; **converge (T155)**. O commit `chore(release)` fica por último no PR.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Claims do professor | `sub`, `role`, `name`, `iat`, `exp` | ADR 0009 |
| Assinaturas | `ProfessorMapClaims(professorID string, name ...string)`, `SignProfessorToken(professorID string, name ...string)` | C-154 |
| Fallback do slug | `professor` | C-152 |
| Fallback do nome no signaling | `"Participante"` | C-153 |
| Versão | PATCH | C-155 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Chamada antiga de 2 argumentos passa o e-mail como nome | teste com nome errado sem falha de compilação | revisão de todas as chamadas listadas; `git grep 'SignProfessorToken\|ProfessorMapClaims'` no check do T151 |
| Algum cliente ler `email` | quebra silenciosa | verificado: nenhum uso em `apps/desktop`, `apps/web`, `packages` |
| Fallback do slug mudar | link fixo diferente | `TestCreateRoomFixedSlug` cobre o caso sem nome |

## Scope Lock

### IN

- emissão e leitura da claim do professor em `auth`, `room` e `signaling`; testes desses pacotes; contrato `auth.md`.

### OUT

- regra do slug, sessão do professor, token do aluno, desktop, web e pacotes.

### Allowed Paths

- `apps/backend/internal/auth/jwt.go`
- `apps/backend/internal/auth/handler.go`
- `apps/backend/internal/auth/auth_test.go`
- `apps/backend/internal/auth/auth_security_test.go`
- `apps/backend/internal/room/handler.go`
- `apps/backend/internal/room/store.go`
- `apps/backend/internal/room/room_test.go`
- `apps/backend/internal/room/files_test.go`
- `apps/backend/internal/room/room_security_test.go`
- `apps/backend/internal/signaling/handler.go`
- `apps/backend/internal/signaling/handler_test.go` (novo)
- `spec-kit/specs/001-screen-share-core/contracts/auth.md`
- `spec-kit/specs/015-remove-claim-email/**`
- `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json` (só pelo `npm run bump`)

### Prohibited Paths

- `apps/backend/go.mod`, `apps/backend/go.sum`
- demais arquivos de `apps/backend` (incluindo `cmd/server/**`)
- `apps/desktop/src/**`, `apps/web/src/**`, `packages/*/src/**`
- `docs/requirements/**` (nenhum espelho cita as claims: verificado em RN001 e RF012)

### Dependencies

- Nenhuma nova.

### Non-Goals

- renomear ou acrescentar claims;
- mudar o TTL ou a validação do token;
- mexer nos testes do `/auth/login` removido.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED, ADR 0009 aprovada.
- [x] Princípio II: autorização no servidor intocada (`role` e `sub` continuam); nenhum dado do cliente passa a ser
  confiado.
- [x] Princípio III: SFU intocada.
- [x] Princípio IV: sem impacto de desempenho.
- [x] Princípio V: contrato `auth.md` emendado antes do código.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: remove código; nenhuma abstração nova.
- [ ] Princípio VIII: converge ao final.

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-10 | ADR 0009 aprovada | C-151 |
| 2026-11-10 | Fallbacks `professor` e `"Participante"` | C-152, C-153 |
| 2026-11-10 | Assinaturas sem `email` e revisão manual das chamadas | C-154 |
| 2026-11-10 | Versão: PATCH | C-155, AGENTS §13 |
