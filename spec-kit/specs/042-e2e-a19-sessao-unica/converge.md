# Converge: E2E A19 com a Recusa da Matrícula Já Conectada

Feature: `042-e2e-a19-sessao-unica`
Status: DONE
Branch: `test/e2e-a19-sessao-unica`, a partir da `development` @ `0873ec8` (2.0.0)

## 1. Evidências

- `npm run build`: verde.
- `cd apps/web && npx playwright test -g "A19" --project=desktop --repeat-each=3 --retries=0`: 3 passed.
- `cd apps/web && npx playwright test` (completo): 12 passed, 1 failed. A falha é o A13 no projeto `desktop`, que não
  foi alterado (desvio #127); isolado, o A13 passou 4/4 (`--repeat-each=4 --retries=0`).

## 2. Requisitos

| Requisito | Evidência |
|---|---|
| RF-4201 | `aluno.e2e.ts` (A19): `prof.waitFor('participant-joined', (p) => p.student_id === MATRICULA)` antes da aba 2 |
| RF-4202 | A19: alerta "Esta matrícula já está conectada nesta transmissão." e URL `/entrar` na aba 2 |
| RF-4203 | A19: aba 1 em `/ao-vivo` depois da recusa |
| RNF-4201 | 3 execuções seguidas sem retry, verdes |
| RNF-4202 | diff da T4201 só em `apps/web/e2e/aluno.e2e.ts` e no `tasks.md` da feature |
| RNF-4203 | nenhuma dependência nova |

## 3. Desvios registrados

- #127 — `fix(web): e2e A13 cai com 4001 de sessao duplicada sem outra aba aberta`. Não bloqueante: o A13 não foi
  tocado e o A19 passou.

## 4. Trabalho restante

- Nenhum nesta feature.

## 5. Impacto de versão

**Sem incremento** (C-4202): só teste e artefatos do Spec Kit, sem mudança no que o instalador entrega
(`docs/versionamento.md` §2).
