# MLab — Spec Kit

Kit de desenvolvimento orientado por especificação para um sistema de compartilhamento de tela em aulas ao vivo.

## O que este kit adiciona

- `AGENTS.md` como regra operacional central;
- constitution com gates obrigatórios;
- carregamento progressivo de contexto;
- templates de spec/clarify/plan/checklist/tasks/analyze/contracts/ADR;
- comandos agnósticos de agente em `.specify/commands/`;
- validador local de gates;
- feature inicial de referência (`001-screen-share-core`) baseada no cenário professor (app desktop) → SFU → 40+ alunos (web).

## Estrutura

```text
.
├── AGENTS.md
├── docs/
│   └── adrs/
│       ├── 0001-monorepo-turborepo.md   ← APROVADA
│       └── 0002-desktop-app-framework.md ← APROVADA
├── .specify/
│   ├── commands/
│   ├── memory/
│   │   ├── constitution.md
│   │   ├── context-loading.md
│   │   ├── engineering-principles.md
│   │   └── project-context.md
│   ├── scripts/
│   └── templates/
├── specs/
│   ├── README.md
│   └── 001-screen-share-core/
│       ├── spec.md          ← READY-FOR-PLAN
│       ├── clarify.md       ← CLOSED (C-01 a C-06)
│       ├── plan.md          ← READY
│       ├── tasks.md         ← READY-FOR-T005
│       ├── analyze.md       ← PASS
│       ├── data-model.md    ← READY
│       ├── research.md      ← RESOLVED
│       ├── quickstart.md    ← DRAFT
│       ├── checklists/
│       │   └── requirements.md  ← APPROVED
│       └── contracts/
│           ├── auth.md          ← READY
│           ├── room-api.md      ← READY
│           ├── signaling.md     ← READY
│           └── media-session.md ← DRAFT (a fechar em T005)
└── README.md
```

## Arquitetura do Sistema

```text
apps/desktop (Professor — Electron)
  └─ captura tela + áudio
  └─ WebRTC publish → SFU (Pion/Go)
                          └─ subscribe → apps/web (Aluno — Navegador)
                          └─ subscribe → apps/web (Aluno 2)
                          └─ ...
                          └─ subscribe → apps/web (Aluno 40+)

apps/backend (Go)
  ├─ auth (JWT)
  ├─ room (CRUD, link único)
  ├─ signaling (WebSocket)
  ├─ chat (tempo real)
  └─ webrtc (SFU Pion)
```

## Fluxo SDD

```text
constitution
 -> specify
 -> clarify   ← CLOSED
 -> plan      ← READY
 -> checklist ← APPROVED
 -> tasks     ← READY-FOR-T005
 -> analyze   ← PASS
 -> implement (após T005)
 -> converge
```

## Estado atual

A feature `001-screen-share-core` está em **READY-FOR-T005**.

Próximo passo: executar T005 (revalidação formal de todos os artefatos, fechar `media-session.md` e detalhar reconexão) para liberar a geração das tarefas de implementação de código (T006+).

## Validação

Requer Python 3.10+ (`py` no Windows, `python3` no Linux/macOS). Rode a partir da raiz do repositório:

```bash
npm run spec:check                                     # todas as features
npm run spec:check -- spec-kit/specs/001-screen-share-core   # uma feature
```

O validador falha quando: falta artefato obrigatório, o `plan.md` não tem Scope Lock completo,
o `analyze.md` não está em `Status: PASS`, a checklist não está `APPROVED`, existe
`NEEDS CLARIFICATION` em documento fechado ou alguma tarefa `### Txxx` não declara
`Allowed Paths:` e `Prohibited Paths:`.

## Decisões Arquiteturais Aprovadas

| ADR | Decisão |
|---|---|
| ADR 0001 | Monorepo modular com Turborepo |
| ADR 0002 | Electron + React como framework do app desktop do professor |
| ADR 0003 | Estratégia de testes automatizados |
| ADR 0004 | Arquitetura de segurança e testes de segurança |
