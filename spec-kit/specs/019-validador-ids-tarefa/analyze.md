# Analyze: Validador Aceita IDs de Tarefa com 3 ou Mais Dígitos

Feature: `019-validador-ids-tarefa`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma. Spec, clarify (C-191 a C-194) e plan concordam: aceitar `T\d{3,}[a-z]?`, falhar em cabeçalho malformado,
provar com `unittest`, sem incremento de versão. A faixa `19x` (`RF-19x`, `C-19x`, `T19x`) não colide com outras
features (verificado por busca em `spec-kit/` e `docs/`).

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-191 | T191 (regex), T192 (casos `T1101`, `T101`, `T101a`) |
| RF-192 | T191 (checagem), T192 (casos `T12`, `T101ab`, `Testes manuais`) |
| RNF-191 | T191 (`spec:check` em todas as features), T192 (só biblioteca padrão) |

## 3. Contratos

Nenhum muda.

## 4. Tarefas fora do Scope Lock

Nenhuma. T191 e T192 tocam só `spec-kit/.specify/scripts/` e o `spec-kit/README.md`; T193 só
`spec-kit/specs/019-validador-ids-tarefa/**`.

## 5. Riscos

- Falso positivo em títulos começando com `T`: RF-192 exige dígito logo após o `T`, e o caso está no teste.

## 6. Resultado

- [ ] FAIL
- [x] PASS: próxima execução, T191.
