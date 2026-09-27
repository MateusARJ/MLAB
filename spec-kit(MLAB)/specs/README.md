# Specs

Cada feature possui sua própria pasta. O conjunto mínimo é:

```text
specs/<feature>/
├── spec.md
├── clarify.md
├── plan.md
├── checklist.md
├── tasks.md
├── analyze.md
├── contracts/
└── checklists/
```

Artefatos adicionais do Spec Kit atual podem ser adicionados quando forem necessários:

```text
research.md
 data-model.md
 quickstart.md
```

## Ordem

```text
specify -> clarify -> plan -> checklist -> tasks -> analyze -> implement -> converge
```

Não implemente uma feature com `analyze.md` em FAIL ou com checklist pendente.
