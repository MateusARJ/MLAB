# Converge: Validador Aceita IDs de Tarefa com 3 ou Mais Dígitos

Feature: `019-validador-ids-tarefa`
Mode: READ-ONLY sobre o código (só este arquivo e o `tasks.md` são escritos)
Data: 2026-11-11
Commits avaliados: `7f7bd68` (T191), `f076298` (T192)
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-191 a C-194), `plan.md`, `tasks.md` (T191 a T193)
- código: `spec-kit/.specify/scripts/validate_spec.py`, `spec-kit/.specify/scripts/test_validate_spec.py`,
  `spec-kit/README.md`
- suítes: `py -m unittest discover -s spec-kit/.specify/scripts -p "test_*.py"` (7 testes) e `npm run spec:check`
  (17 features)

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-191 | `7f7bd68`: regex `T\d{3,}[a-z]?`; testes `test_four_digit_task_without_paths_fails`, `test_four_digit_task_with_paths_passes`, `test_three_digit_tasks_with_paths_pass`, `test_three_digit_task_without_paths_fails` |
| RF-192 | `7f7bd68`: `FAIL: cabeçalho de tarefa fora do padrão ...`; testes `test_two_digit_header_fails`, `test_header_with_two_letters_fails`, `test_non_task_header_starting_with_t_is_ignored` |
| RNF-191 | só `re`, `sys`, `pathlib`, `unittest`, `tempfile`, `io`, `contextlib`; `npm run spec:check` com PASS nas 17 features (001 a 019) |

Prova do bug: contra o validador anterior (`5600c61`), 3 dos 7 testes falham (4 dígitos sem paths, `T12` e `T101ab`
dão PASS). Com a correção, os 7 passam.

Terceiro critério da issue (C-193): cópia de `spec-kit/specs/011-https-lan` exportada por `git archive` da
`edicao/https-lan` @ `30b957c`:

| Validador | 011 intacta | 011 sem o `Allowed Paths:` da T1101 |
|---|---|---|
| anterior (`5600c61`) | PASS | **PASS** (bug) |
| corrigido | PASS | `FAIL: tarefa T1101 sem Allowed Paths/Prohibited Paths` |

As T1101 a T1106 da 011 já declaram os dois paths; nada precisa ser completado na edição.

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

- O `unittest` não roda no CI nem via `npm` (Non-Goal): depende de execução manual.

## 6. Novas tasks necessárias

- Nenhuma na 019. A `edicao/https-lan` recebe a correção no próximo rebase sobre a `development`.

## 7. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| — | — | — | nenhum |

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| nenhum | 1.12.0 (sem mudança) | Só `spec-kit/**`; o instalador não muda (C-194). |

## 9. Resultado

- [ ] OPEN
- [x] CONVERGED — o gate de paths vale para IDs com 3 ou mais dígitos, e cabeçalho de tarefa malformado falha.
