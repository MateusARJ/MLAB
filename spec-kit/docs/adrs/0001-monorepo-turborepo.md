# ADR 0001 — Monorepo Modular com Turborepo

Status: APROVADA
Data: 2026-09-11
Feature impactada: `001-screen-share-core` e repositório global

## Contexto

O projeto ScreenShare Classroom possui três artefatos de runtime distintos:
- App desktop do professor (Electron)
- Web app dos alunos (React + Vite)
- Backend Go (API REST + WebSocket + SFU Pion)

Era necessário decidir como organizar esses artefatos no repositório, considerando
compartilhamento de tipos TypeScript e CI unificado.

## Alternativas Consideradas

### 1. Multirepo (um repositório por app)
- **Prós:** isolamento total; permissões independentes por repo.
- **Contras:** sincronização de versões de contratos/tipos manual; CI separado e difícil de cruzar; overhead de manutenção.

### 2. Monólito único (tudo num package.json)
- **Prós:** simplicidade inicial.
- **Contras:** frontend e backend misturados; não escala quando os apps crescem independentemente; Go não se integra naturalmente em um único package.json.

### 3. Monorepo com Turborepo (escolhida)
- **Prós:** apps totalmente independentes com ciclos de build/test próprios; cache inteligente de build do Turborepo (não recompila o que não mudou); pipeline de CI unificado com `turbo run build test lint`; `packages/` para compartilhar tipos e componentes entre `apps/desktop` e `apps/web`.
- **Contras:** configuração inicial mais complexa; Go não é gerenciado nativamente pelo npm (resolvido com wrapper de scripts).

## Decisão

Turborepo como orquestrador do monorepo com a seguinte estrutura de apps e packages:

```text
screenshare/
├── turbo.json
├── package.json          ← workspace root (npm workspaces)
├── apps/
│   ├── desktop/          ← Electron + React (professor)
│   ├── web/              ← React + Vite (alunos)
│   └── backend/          ← Go (API + SFU); package.json é wrapper de scripts
└── packages/
    ├── types/            ← DTOs e tipos TypeScript compartilhados
    └── ui/               ← Componentes React compartilhados (opcional)
```

O backend Go não é gerenciado pelo npm. O `apps/backend/package.json` serve exclusivamente
como wrapper de scripts (`build`, `test`, `lint`) para o Turborepo orquestrar via `turbo.json`.

## Impactos

- Todos os `Allowed Paths` em `tasks.md` e `plan.md` devem referenciar `apps/` e `packages/` em vez de `frontend/` e `backend/`.
- O CI deve executar `turbo run build test lint` a partir da raiz do repositório.
- `turbo.json` e `package.json` raiz devem ser adicionados como arquivos de configuração.
- A spec de qualquer nova feature deve atualizar o Scope Lock com os novos caminhos.
