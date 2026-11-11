# Tasks: Validador Aceita IDs de Tarefa com 3 ou Mais Dígitos

Feature: `019-validador-ids-tarefa`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: READY

Regras:
- `npm run spec:check` com PASS antes de cada `[x]`;
- um commit atômico por task, com `Ref: T19x` e `Refs #50`.

### T191 — Corrigir o validador
[ ] T191
Allowed Paths: `spec-kit/.specify/scripts/validate_spec.py`, `spec-kit/README.md`
Prohibited Paths: `apps/**`, `packages/**`, `package.json`, `package-lock.json`, `scripts/spec-check.js`, `.github/**`,
`tasks.md` de outras features
Checks:
- [ ] Regex `T\d{3,}[a-z]?` no laço de blocos (RF-191).
- [ ] Cabeçalho `### T<dígito>` fora do padrão → `FAIL` com o ID (RF-192).
- [ ] Descrição do gate no `spec-kit/README.md` atualizada.
- [ ] `npm run spec:check` com PASS em todas as features (RNF-191).

### T192 — Teste de regressão do validador
[ ] T192
Depends On: T191
Allowed Paths: `spec-kit/.specify/scripts/test_validate_spec.py`, `spec-kit/README.md`
Prohibited Paths: `spec-kit/.specify/scripts/validate_spec.py`, `apps/**`, `packages/**`, `package.json`,
`package-lock.json`, `.github/**`
Checks:
- [ ] Casos: `T1101` sem paths → 1; `T1101` com paths → 0; `T101` e `T101a` com paths → 0; `T101` sem paths → 1;
  `### T12` e `### T101ab` → 1; `### Testes manuais` sem paths → 0.
- [ ] Os casos de 4 dígitos e de malformado falham contra o validador anterior (prova do bug).
- [ ] `py -m unittest discover -s spec-kit/.specify/scripts -p "test_*.py"` verde; comando documentado no README.

### T193 — Converge
[ ] T193
Depends On: T192
Allowed Paths: `spec-kit/specs/019-validador-ids-tarefa/**`
Prohibited Paths: `apps/**`, `packages/**`, `package.json`, `package-lock.json`, `spec-kit/specs/011-https-lan/**`
Checks:
- [ ] Validador sobre cópia da `011-https-lan` exportada da `edicao/https-lan` → PASS (C-193).
- [ ] `converge.md` com evidências, desvios e impacto de versão (nenhum).
- [ ] `npm run spec:check` com PASS.
