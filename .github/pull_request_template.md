<!--
REGRA OBRIGATÓRIA DE TÍTULO DO PR:
O título DEVE seguir o padrão: <tipo>(<escopo>): <mensagem objetiva estritamente em português>
Prefixos em inglês: feat, fix, docs, style, refactor, perf, test, build, ci, chore
Exemplos:
  - feat(desktop): adiciona seletor de tela cheia e gravação em mp4/webm
  - fix(backend): corrige validação de credenciais do professor
  - docs(spec): atualiza requisitos de captura e transmissão
-->

## Objetivo

<!-- Explique de forma objetiva o que este Pull Request entrega e por que a alteração é necessária no MLab. -->

## Alteracoes realizadas

- 

## Areas afetadas

- [ ] App Desktop do Professor (`apps/desktop` — Electron + React)
- [ ] Web App dos Alunos (`apps/web` — React + Vite)
- [ ] Backend & SFU (`apps/backend` — Go + Pion WebRTC)
- [ ] Pacotes Compartilhados (`packages/types`, `packages/ui`)
- [ ] Documentação ou Especificações (`spec-kit`, `docs/`)
- [ ] Configuração, deploy ou infraestrutura (Turborepo, electron-builder, scripts de build)

## Mudanca sensivel

<!-- Identifica mudanças críticas de arquitetura, segurança ou transmissão de mídia no MLab. -->

- [ ] Arquitetura (exige aprovação prévia de ADR)
- [ ] WebRTC / SFU Pion (pipeline de mídia ou sinalização)
- [ ] Autenticação ou autorização (JWT, chave de host, tokens de sala)
- [ ] Contratos entre módulos (`contracts/`: API HTTP, WebSocket ou IPC)
- [ ] Infraestrutura, TURN opcional ou portas de rede (ex.: UDP 5353 do mDNS)
- [ ] Regra de negócio crítica (RN-01 a RN-020)
- [ ] Documento oficial do projeto (`AGENTS.md`, `spec.md`, `constitution`)
- [ ] Não se aplica

## Como validar

1. 

## Validacoes executadas

- [ ] Desktop: `npm run test --workspace=apps/desktop`
- [ ] Web: `npm run test --workspace=apps/web`
- [ ] Backend: `cd apps/backend && go test -v ./...`
- [ ] Monorepo Build: `npm run build`
- [ ] Validação manual do fluxo afetado (ex: `npm run dev`)
- [ ] Teste de integração / carga, quando aplicável
- [ ] Não se aplica; justificativa registrada em Observações

## Issue relacionada

<!-- Use Closes, Fixes ou Resolves quando o PR encerrar uma issue ou tarefa do Spec-Kit. -->

Closes #
- **Task do Spec-Kit (obrigatório):** (ex: `001/T022`, `002/S1`) — PR que altera comportamento sem task é bloqueado (`AGENTS.md` §4, regra anti-deriva)
- **Requisitos Vinculados:** (ex: `RF-004`, `RF-026`, `RNF-018`)
- **Desvios encontrados (obrigatório):** issues abertas durante este trabalho (`AGENTS.md` §14), ex: `#35 (não bloqueante)`, ou `nenhum`
- **Impacto de versão (obrigatório):** `MAJOR` | `MINOR` | `PATCH` | `nenhum` — versão resultante e justificativa pelo escopo de `docs/versionamento.md` §2 (ex: `PATCH → 1.7.2: corrige regressão do RF-310`)

## Checklist do autor

- [ ] Trabalhei em branch dedicada `<tipo>/<descricao>` criada a partir da `main` atualizada (`AGENTS.md` §15).
- [ ] Desvios encontrados fora do escopo foram abertos como issue com labels, sem correção neste PR (`AGENTS.md` §14).
- [ ] O título segue rigorosamente `tipo(escopo): mensagem objetiva em português` (com prefixo em inglês: `feat`, `fix`, etc.).
- [ ] A alteração está coesa e respeita o **Scope Lock** e as tarefas aprovadas do `AGENTS.md`.
- [ ] Alterou exclusivamente os caminhos autorizados (**Allowed Paths**).
- [ ] Todo comportamento novo ou alterado possui task em `tasks.md` e `npm run spec:check` passou.
- [ ] Incrementei a versão no nível certo (`npm run bump -- <nível>`, último commit) e `npm run version:check` passou, ou o PR não tem impacto no app.
- [ ] Revisei meu próprio diff.
- [ ] A barra de menus nativa do Electron e layouts essenciais permanecem íntegros.
- [ ] Atualizei testes e documentação quando necessário.
- [ ] Não incluí arquivos temporários, credenciais, chaves ou segredos.
- [ ] Associei a milestone ou tarefa correta.
- [ ] Marquei a mim mesmo no campo `Assignees`.
- [ ] Informei riscos, pendências e validações não executadas.

## Observacoes

<!-- Registre riscos, decisões técnicas, pendências, limitações ou justificativas. -->
