# Plan: E2E A19 com a Recusa da Matrícula Já Conectada

Feature: `042-e2e-a19-sessao-unica`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-4201 e C-4202)

## 1. Summary

```text
aba 1: joinAsStudent(...)                 → /ao-vivo
prof:  waitFor('participant-joined', student_id === MATRICULA)
aba 2: formulário de entrada, mesma matrícula
       → POST /rooms/{slug}/join = 409    → /entrar + alerta "Esta matrícula já está conectada nesta transmissão."
aba 1: continua em /ao-vivo
```

1. `apps/web/e2e/aluno.e2e.ts`: A19 renomeado e reescrito; a aba 2 preenche o formulário diretamente, pois o
   `joinAsStudent` exige `/ao-vivo`.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Sincronização | `prof.waitFor('participant-joined', ...)` | C-4201 |
| Aba 2 | formulário preenchido no teste (rótulos "Nome Completo" e "Matrícula", botão "Entrar na aula") | RF-4202 |
| Versão | sem incremento | C-4202 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| `participant-joined` sem `student_id` para o professor | espera estoura o tempo | o campo existe em `ParticipantJoinedPayload`; se faltar, parar e registrar desvio |
| Rótulos do formulário mudarem | teste quebra | mesmos rótulos usados pelo `joinAsStudent` |

## Scope Lock

### IN

- o teste A19 em `apps/web/e2e/aluno.e2e.ts`.

### OUT

- código de produção (web, backend, desktop, packages);
- fixture `apps/web/e2e/fixtures.ts`;
- relatórios históricos de smoke em `docs/metrics/`.

### Allowed Paths

- `apps/web/e2e/aluno.e2e.ts`
- `spec-kit/specs/042-e2e-a19-sessao-unica/**`

### Prohibited Paths

- `apps/web/src/**`, `apps/web/e2e/fixtures.ts`, `apps/backend/**`, `apps/desktop/**`, `packages/**`
- `package.json`, `package-lock.json`, `apps/*/package.json`
- `spec-kit/specs/027-matricula-unica-na-transmissao/**`, `spec-kit/docs/adrs/**`, `.github/**`, `docs/**`

### Dependencies

- Nenhuma nova. Playwright e o fixture `prof`, já usados.

### Non-Goals

- mudar a regra de sessão única;
- cobrir o `4001` do mesmo token (já coberto no smoke do backend da 027).

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: nenhuma regra de autorização muda.
- [x] Princípio III: SFU intocada.
- [x] Princípio IV: nenhuma meta de desempenho declarada.
- [x] Princípio V: nenhum contrato muda.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: mudança restrita a um teste.
- [ ] Princípio VIII: converge ao final (T4202).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-16 | Sincronizar pelo `participant-joined` no professor | C-4201 |
| 2026-11-16 | Uma feature, um PR, IDs `420x`, sem incremento | C-4202 |
