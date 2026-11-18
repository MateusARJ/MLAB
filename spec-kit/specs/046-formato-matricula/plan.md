# Plan: Formato Exato da Matrícula do Aluno

Feature: `046-formato-matricula`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-4601 a C-4603)

## 1. Summary

```text
antes:  ^[0-9]+[A-Za-z]{1,4}[0-9]+$     trim                 2025116TADS0 aceita
depois: ^[0-9]{7}[A-Za-z]{4}[0-9]{4}$   trim + maiúsculas    2025116TADS0 recusada (400 / erro no web)
```

1. Testes primeiro: `TestJoinValidation` (backend) e `Join.test.tsx` (web) com os casos da spec §8.
2. Backend `handler.go`: nova `studentIDRegex`, `strings.ToUpper(strings.TrimSpace(...))` e mensagem do `400`.
3. Web `Join.tsx`: nova `STUDENT_ID_REGEX`, mensagem e envio de `studentId.trim().toUpperCase()`.
4. Notas de emenda: RN-306/C-303 da 003, contratos `room-api.md`/`auth.md` e o espelho RF011.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Regex | `^[0-9]{7}[A-Za-z]{4}[0-9]{4}$`, igual no Go e no TS | RF-4601 |
| Normalização | servidor autoritativo; web também normaliza | RF-4602, RNF-4602 |
| Mensagem | mesma redação no web e no `error` do backend | RF-4603 |
| Versão | PATCH, 2.1.3 | C-4603 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Fixture de teste existente fora do formato | teste vermelho | busca feita: backend/web/e2e já usam `2025116TADS000x`; desktop não valida |
| Regex divergente entre Go e TS | erro só num lado | mesma string literal nos dois; testes nos dois lados |

## Scope Lock

### IN

- validação e normalização da matrícula no join (backend e web), seus testes e as notas de emenda.

### OUT

- desktop, sinalização, sessão única, outros campos do join.

### Allowed Paths

- `apps/backend/internal/room/handler.go`
- `apps/backend/internal/room/room_test.go`
- `apps/web/src/pages/Join.tsx`
- `apps/web/src/pages/Join.test.tsx`
- `spec-kit/specs/046-formato-matricula/**`
- `spec-kit/specs/003-classroom-interaction/spec.md` e `clarify.md` (só notas de emenda)
- `spec-kit/specs/001-screen-share-core/contracts/room-api.md` e `auth.md` (só o formato da matrícula)
- `docs/requirements/functionals/RF011-identificacao-obrigatoria-de-aluno-nome-e-matricula.md`
- `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json` (somente pelo `npm run bump`)

### Prohibited Paths

- `apps/desktop/**`, `apps/backend/internal/signaling/**`, `apps/backend/internal/webrtc/**`
- `packages/*/src/**`, `spec-kit/docs/adrs/**`, `.github/**`

### Dependencies

- Nenhuma nova (`regexp`/`strings` da stdlib Go; Vitest já usado).

### Non-Goals

- validar ano, período ou sigla de curso existente;
- máscara de digitação no campo.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: validação no servidor (RNF-4602); nenhuma regra de autorização muda.
- [x] Princípio III: SFU intocada.
- [x] Princípio IV: nenhuma meta de desempenho declarada.
- [x] Princípio V: contratos anotados na mesma feature.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: mudança restrita ao join.
- [x] Princípio VIII: converge ao final (T4604).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-16 | Formato 7 + 4 letras + 4 | C-4601 |
| 2026-11-16 | Minúsculas aceitas e normalizadas | C-4602 |
| 2026-11-16 | Uma feature, um PR, IDs `460x`, PATCH | C-4603 |
