# Plan: Validador Aceita IDs de Tarefa com 3 ou Mais Dígitos

Feature: `019-validador-ids-tarefa`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-191 a C-194)

## 1. Summary

Trocar a regex dos blocos de tarefa em `validate_spec.py` por `T\d{3,}[a-z]?`, rejeitar antes do laço os cabeçalhos
`### T<dígito>` fora do padrão e cobrir os dois casos com `unittest` da biblioteca padrão.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Padrão de ID | `^###\s+(T\d{3,}[a-z]?)\b` | RF-191, C-191 |
| ID malformado | varrer `^###\s+(T\d\S*)` (`re.M`); token que não casa `^T\d{3,}[a-z]?\b` → `FAIL` | RF-192, C-191 |
| Teste | `unittest` + `tempfile`, chamando `validate_spec.main()` com `sys.argv` trocado | C-192 |
| 011 | validador sobre uma cópia exportada da `edicao/https-lan` | C-193 |
| Versão | sem incremento | C-194 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Título comum começando com `T` (`### Testes`) tratado como tarefa | FAIL falso em feature válida | RF-192 exige dígito logo após o `T`; caso coberto no teste |
| Feature existente com cabeçalho fora do padrão | `spec:check` passa a falhar | verificado: os 126 cabeçalhos atuais seguem o padrão; `npm run spec:check` antes do commit |
| `\d{3,}` aceitar ID absurdo (`T000000`) | nenhum | só o formato é validado; a faixa é decisão de cada feature |

## Scope Lock

### IN

- regex e checagem de cabeçalho em `validate_spec.py`;
- teste do validador;
- descrição do gate no `spec-kit/README.md`.

### OUT

- CI, scripts npm, wrapper `scripts/spec-check.js`;
- renumeração de tarefas; edição da 011.

### Allowed Paths

- `spec-kit/.specify/scripts/validate_spec.py`
- `spec-kit/.specify/scripts/test_validate_spec.py`
- `spec-kit/README.md`
- `spec-kit/specs/019-validador-ids-tarefa/**`

### Prohibited Paths

- `apps/**`, `packages/**`
- `package.json`, `package-lock.json`, `scripts/spec-check.js`
- `.github/**`
- `tasks.md` de outras features

### Dependencies

- Nenhuma nova. Python 3.10+ e a biblioteca padrão, já exigidos pelo `spec:check`.

### Non-Goals

- executar o teste no CI ou via `npm`;
- validar faixa, unicidade ou ordem dos IDs;
- renumerar tarefas existentes.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: autorização intocada.
- [x] Princípio III: SFU intocada.
- [x] Princípio IV: sem impacto de desempenho.
- [x] Princípio V: nenhum contrato muda.
- [x] Princípio VI: Scope Lock e paths por task; o próprio gate do princípio é reforçado.
- [x] Princípio VII: nenhuma abstração nova.
- [ ] Princípio VIII: converge ao final.

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-11 | Aceitar `T\d{3,}[a-z]?` e falhar em cabeçalho malformado | C-191 |
| 2026-11-11 | Prova por `unittest` da biblioteca padrão | C-192 |
| 2026-11-11 | 011 verificada sobre cópia exportada, sem editar a edição | C-193 |
| 2026-11-11 | Versão: sem incremento | C-194, AGENTS §13 |
| 2026-11-11 | IDs desta feature com 3 dígitos (`T19x`), como as anteriores | — |
