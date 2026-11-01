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

O arquivo de regras canônico é o [`AGENTS.md`](../AGENTS.md) na raiz do repositório.

```text
spec-kit/
├── AGENTS.md                ← ponteiro para ../AGENTS.md
├── docs/
│   ├── adrs/                ← 0001 a 0006 aprovadas
│   └── plano-remediacao-speckit-seguranca.md
├── .specify/
│   ├── commands/
│   ├── memory/              ← constitution, context-loading, princípios, contexto
│   ├── scripts/             ← validate_spec.py (npm run spec:check)
│   └── templates/           ← inclui converge-template.md
└── specs/
    ├── README.md
    └── 001-screen-share-core/
        ├── spec.md, clarify.md, plan.md, tasks.md, analyze.md
        ├── data-model.md, research.md, quickstart.md
        ├── checklists/requirements.md
        └── contracts/       ← auth, room-api, signaling, media-session
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
constitution -> specify -> clarify -> plan -> checklist -> tasks -> analyze -> implement -> converge
```

## Estado atual

| Feature | Estado | Converge |
|---|---|---|
| `001-screen-share-core` | artefatos emendados (ADRs 0005/0006), analyze PASS | OPEN — falta medição real de desempenho e smoke manual |
| `002-security-hardening` | T201–T208 concluídas | OPEN — falta smoke manual; S9 e teste de carga real aguardam decisão |
| `003-classroom-interaction` | retroativa, T301–T314 concluídas | — |

Histórico do realinhamento: [`docs/plano-remediacao-speckit-seguranca.md`](docs/plano-remediacao-speckit-seguranca.md).

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
| ADR 0005 | Operação em LAN offline como modo primário (TURN opcional, estado em memória) |
| ADR 0006 | Descontinuação do login; sessão local do professor vinculada ao host |
