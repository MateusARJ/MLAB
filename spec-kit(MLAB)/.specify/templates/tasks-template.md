# Tasks: [NOME DA FEATURE]

Feature: `[###-slug]`
Prerequisites: `spec.md`, `plan.md`, `analyze.md` com PASS

## Formato obrigatório

```text
[ ] T001 [P?] [US-01] Descrição objetiva
    Allowed Paths:
      - path/permitido
    Prohibited Paths:
      - path/proibido
    Depends On:
      - T000
    Checks:
      - comando ou validação
```

`[P]` somente quando a tarefa puder ser executada em paralelo sem compartilhar os mesmos arquivos nem depender de estado criado por outra tarefa.

## Gates

- nenhuma tarefa sem paths;
- nenhuma tarefa fora do Scope Lock;
- nenhuma tarefa mistura refatoração oportunista;
- cada tarefa deve possuir um resultado observável;
- marcar `[x]` somente depois dos checks.

## Backlog

### Phase 0 — Fundação

- [ ] T001 — criar estrutura mínima exigida pela feature

### Phase 1 — US-01

- [ ] T002 [US-01] ...

### Phase 2 — US-02

- [ ] T003 [US-02] ...

## Definition of Done da feature

- [ ] Todos os testes/checks passaram
- [ ] Scope Lock respeitado
- [ ] Contratos sincronizados
- [ ] Analyze pós-tasks = PASS
- [ ] Convergência registrada
