# Context Loading

Paths relativos à raiz do repositório. `spec.md`, `clarify.md` etc. referem-se a `spec-kit/specs/<feature>/`.

Carregamento progressivo obrigatório por fase.

## Constitution

Ler:
- `AGENTS.md` (raiz)
- `spec-kit/.specify/memory/constitution.md`

## Specify

Ler:
- `AGENTS.md` (raiz)
- `spec-kit/.specify/memory/constitution.md`
- contexto de produto fornecido pelo usuário
- apenas specs relacionadas, se a feature for evolução de uma existente

## Clarify

Ler:
- `spec.md`
- documentos de produto diretamente relacionados
- contratos relacionados, quando citados pela spec

## Plan

Ler:
- `spec.md`
- `clarify.md`
- `constitution.md`
- contratos existentes afetados
- árvore real do código somente nos caminhos relevantes

## Checklist / Tasks

Ler:
- `spec.md`
- `clarify.md`
- `plan.md`
- contratos/modelo de dados quando existirem

## Analyze

Ler:
- `spec.md`
- `clarify.md`
- `plan.md`
- `tasks.md`
- `constitution.md`
- apenas documentos de contrato referenciados

## Implement

Ler:
- tarefa corrente
- artefatos upstream necessários para aquela tarefa
- arquivos-alvo reais
- `AGENTS.md` §14 (desvios) e §15 (branch, commit e PR)
- `.github/ISSUE_TEMPLATE/bug-desvio.md`, quando surgir um desvio

## Converge / Pull Request

Ler:
- `spec.md`, `plan.md`, `tasks.md` da feature
- `docs/versionamento.md` (escopo de MAJOR/MINOR/PATCH e incremento no PR)

Nunca carregue toda a pasta `spec-kit/.specify/` sem necessidade.
