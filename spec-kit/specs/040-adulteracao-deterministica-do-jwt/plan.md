# Plan: Adulteração Determinística do JWT no Teste de Segurança

Feature: `040-adulteracao-deterministica-do-jwt`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-4001 e C-4002)

## 1. Summary

```text
header.payload.signature
        │
        └─ base64url → JSON → role: aluno → professor → JSON → base64url
header.payload'.signature   (payload' ≠ payload, assinatura original)
```

1. `internal/auth/auth_security_test.go`: `TestAuthSecurity_ClaimManipulation` monta o token adulterado trocando a
   claim `role` e confere que ele difere do original antes de exigir a recusa.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Adulteração | troca de `role` no payload, assinatura mantida | C-4001 |
| Codificação | `base64.RawURLEncoding` (JWT sem padding) | RF-4001 |
| Garantia | `tampered != original` checado no teste | RF-4002 |
| Código de produção | intocado | spec §3 |
| Versão | sem incremento (só teste) | C-4002 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| O claim `role` deixar de existir no token do aluno | teste quebra com mensagem clara | o teste confere `role = aluno` antes de trocar |

## Scope Lock

### IN

- `TestAuthSecurity_ClaimManipulation`.

### OUT

- código de produção do backend, web e desktop;
- outros testes de segurança.

### Allowed Paths

- `apps/backend/internal/auth/auth_security_test.go`
- `spec-kit/specs/040-adulteracao-deterministica-do-jwt/**`

### Prohibited Paths

- `apps/backend/internal/auth/jwt.go`, `apps/backend/internal/auth/middleware.go`,
  `apps/backend/internal/auth/handler.go`, `apps/backend/internal/auth/model.go`, `apps/backend/internal/auth/id.go`
- `apps/backend/internal/signaling/**`, `apps/backend/internal/room/**`, `apps/backend/internal/webrtc/**`,
  `apps/backend/cmd/**`, `apps/web/**`, `apps/desktop/**`, `packages/**`
- `package.json`, `package-lock.json`, `spec-kit/docs/adrs/**`, `.github/**`

### Dependencies

- Nenhuma nova. Go stdlib (`encoding/base64`, `encoding/json`, `strings`).

### Non-Goals

- mudar `ParseToken` ou a validação de assinatura;
- incremento de versão.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: nenhuma regra de autorização muda; o teste continua cobrindo ADR 0004 §2.2.1.
- [x] Princípio III: SFU intocada.
- [x] Princípio IV: nenhuma meta de desempenho declarada.
- [x] Princípio V: nenhum contrato muda.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: um teste, uma troca de claim.
- [ ] Princípio VIII: converge ao final (T4002).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-15 | Trocar `role` no payload em vez de um caractere da assinatura | C-4001 |
| 2026-11-15 | Uma feature, um PR, IDs `400x`, sem incremento | C-4002 |
