# Analyze: Formato Exato da Matrícula do Aluno

Feature: `046-formato-matricula`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma entre os artefatos da feature.

- Spec, clarify (C-4601 a C-4603) e plan concordam: regex `^[0-9]{7}[A-Za-z]{4}[0-9]{4}$`, normalização em
  maiúsculas no servidor e no web, PATCH.
- O conflito com a RN-306/C-303 da 003 é intencional e registrado (C-4601); a T4601 anota as emendas.

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-4601 | T4601, T4602, T4603 |
| RF-4602 | T4601, T4602, T4603 |
| RF-4603 | T4601, T4602, T4603 |
| RNF-4601 | T4602, T4603 (sem dependência nova) |
| RNF-4602 | T4601 (teste no backend), T4602 |

## 3. Contratos

- `room-api.md` (`400` do join) e `auth.md` (claim `student_id`) recebem nota do formato e da caixa; nenhum campo
  novo ou removido.

## 4. Tarefas fora do Scope Lock

Nenhuma. O `chore(release)` toca só os `package.json`/`package-lock.json` pelo `npm run bump`.

## 5. Riscos

- Fixtures fora do formato: busca feita no plan §3; backend, web e e2e já usam 7 + 4 + 4.
- Os testes da T4601 ficam vermelhos até T4602/T4603 (testes primeiro, como na 045).

## 6. Resultado

- [ ] FAIL
- [x] PASS: a próxima execução é a T4601.
