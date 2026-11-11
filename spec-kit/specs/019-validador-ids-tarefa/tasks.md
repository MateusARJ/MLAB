# Tasks: Validador Aceita IDs de Tarefa com 3 ou Mais Dígitos

Feature: `019-validador-ids-tarefa`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: DONE

Regras:
- `npm run spec:check` com PASS antes de cada `[x]`;
- um commit atômico por task, com `Ref: T19x` e `Refs #50`.

### T191 — Corrigir o validador
[x] T191
Allowed Paths: `spec-kit/.specify/scripts/validate_spec.py`, `spec-kit/README.md`
Prohibited Paths: `apps/**`, `packages/**`, `package.json`, `package-lock.json`, `scripts/spec-check.js`, `.github/**`,
`tasks.md` de outras features
Checks:
- [x] Regex `T\d{3,}[a-z]?` no laço de blocos (RF-191).
- [x] Cabeçalho `### T<dígito>` fora do padrão → `FAIL` com o ID (RF-192).
- [x] Descrição do gate no `spec-kit/README.md` atualizada.
- [x] `npm run spec:check` com PASS em todas as features (RNF-191): 17 features. Commit `7f7bd68`.

### T192 — Teste de regressão do validador
[x] T192
Depends On: T191
Allowed Paths: `spec-kit/.specify/scripts/test_validate_spec.py`, `spec-kit/README.md`
Prohibited Paths: `spec-kit/.specify/scripts/validate_spec.py`, `apps/**`, `packages/**`, `package.json`,
`package-lock.json`, `.github/**`
Checks:
- [x] Casos: `T1101` sem paths → 1; `T1101` com paths → 0; `T101` e `T101a` com paths → 0; `T101` sem paths → 1;
  `### T12` e `### T101ab` → 1; `### Testes manuais` sem paths → 0.
- [x] Os casos de 4 dígitos e de malformado falham contra o validador anterior (3 de 7). Commit `f076298`.
- [x] `py -m unittest discover -s spec-kit/.specify/scripts -p "test_*.py"` verde; comando documentado no README.

### T193 — Converge
[x] T193
Depends On: T192
Allowed Paths: `spec-kit/specs/019-validador-ids-tarefa/**`
Prohibited Paths: `apps/**`, `packages/**`, `package.json`, `package-lock.json`, `spec-kit/specs/011-https-lan/**`
Checks:
- [x] Validador sobre cópia da `011-https-lan` exportada da `edicao/https-lan` → PASS (C-193).
- [x] `converge.md` com evidências, desvios e impacto de versão (nenhum).
- [x] `npm run spec:check` com PASS.
