# Instruções para Agentes de IA — MLab

Este arquivo governa todo o repositório. O projeto utiliza Spec-Driven Development (SDD) com inspiração e compatibilidade conceitual com o GitHub Spec Kit. Nenhum agente pode tratar código como fonte primária de requisitos.

## 1. Fontes de verdade e hierarquia

A ordem de autoridade é obrigatória:

1. `AGENTS.md` — regras operacionais do agente.
2. `.specify/memory/constitution.md` — princípios e gates do projeto.
3. `specs/<feature>/spec.md` — comportamento e requisitos aprovados.
4. `specs/<feature>/clarify.md` — ambiguidades resolvidas.
5. `specs/<feature>/plan.md` — arquitetura e decisões técnicas da feature.
6. `specs/<feature>/contracts/` — contratos entre módulos/serviços.
7. `specs/<feature>/tasks.md` — ordem e escopo de implementação.
8. `specs/<feature>/analyze.md` e `checklists/` — validação antes da implementação.
9. Código existente — evidência do estado atual, nunca autorização automática para alterar comportamento.

Antes de qualquer tarefa, leia `.specify/memory/context-loading.md` e carregue somente o contexto exigido pela fase corrente.

## 2. Escopo do sistema

O sistema é uma plataforma de transmissão de tela para aula ao vivo, composta por:

- **App desktop do professor** (Electron + React): o professor instala o app, faz login, cria salas, compartilha a tela e transmite áudio pelo microfone. Ref: ADR 0002.
- **Web app dos alunos** (React + Vite): os alunos acessam via navegador usando um link único do professor, se identificam com Nome e Matrícula e assistem à transmissão. Design responsivo (foco em desktop, mobile funcional).
- **Backend Go** (HTTP/WebSocket + SFU Pion): autenticação, salas, sinalização, chat em tempo real e encaminhamento de mídia via SFU.
- Alunos consumindo a mídia em tempo real sem publicar câmera ou microfone.
- Chat de texto em tempo real acessível a todos os participantes da sala (estilo Jitsi).
- PostgreSQL somente quando uma feature realmente exigir persistência.

### Estrutura do repositório (Monorepo Turborepo — ADR 0001)

```text
screenshare/
├── turbo.json
├── package.json
├── apps/
│   ├── desktop/    ← Electron + React (professor)
│   ├── web/        ← React + Vite (alunos)
│   └── backend/    ← Go (API + SFU)
└── packages/
    ├── types/      ← DTOs TypeScript compartilhados
    └── ui/         ← Componentes React compartilhados (opcional)
```

### Regra de arquitetura WebRTC

O sistema NÃO deve implementar uma malha P2P professor→aluno para o cenário de 30+ alunos.

O professor publica uma única upstream para a SFU. A SFU encaminha os pacotes aos espectadores. O servidor não deve decodificar e reencodar a tela por aluno como parte do fluxo normal.

```text
Professor (apps/desktop) -> WebRTC/SFU -> Aluno 1 (apps/web)
                                      -> Aluno 2
                                      -> ...
                                      -> Aluno 40+
```

Qualquer mudança dessa decisão exige ADR aprovada antes de implementação.

## 3. Fluxo obrigatório de desenvolvimento

Toda feature deve seguir exatamente esta ordem:

```text
constitution
  -> specify
  -> clarify
  -> plan
  -> checklist
  -> tasks
  -> analyze
  -> implement
  -> converge
```

Regras:

- `specify`: define WHAT/WHY; não escreve código.
- `clarify`: resolve ambiguidades que podem alterar comportamento, contratos, segurança, performance ou arquitetura.
- `plan`: define HOW, stack, arquitetura, riscos, contratos e `Scope Lock`.
- `checklist`: valida qualidade e completude dos requisitos antes de quebrar em tarefas.
- `tasks`: cria tarefas pequenas, ordenadas, testáveis e com paths permitidos/proibidos.
- `analyze`: é somente leitura e deve encontrar contradições, gaps, duplicações e cobertura insuficiente.
- `implement`: executa somente a próxima tarefa pendente.
- `converge`: compara código real com spec/plan/tasks e registra trabalho restante.

Não pule fase porque a implementação parece simples.

## 4. Regra de parada absoluta

O agente DEVE PARAR, sem implementar, quando qualquer uma das condições ocorrer:

- `spec.md` inexistente;
- `clarify.md` ausente quando houver ambiguidade relevante;
- `plan.md` sem `## Scope Lock`;
- `tasks.md` sem paths permitidos/proibidos por tarefa;
- existência de `NEEDS CLARIFICATION` em documento que deveria estar fechado;
- `analyze.md` não existir ou não terminar em `PASS`;
- checklist obrigatória possuir item não validado;
- tarefa atual alterar path proibido;
- tarefa introduzir dependência não autorizada pelo plan;
- código exigir mudança de contrato não registrada em `contracts/`;
- mudança arquitetural relevante não possuir ADR aprovada;
- requisito entrar em conflito com a constitution;
- agente precisar inventar comportamento não especificado.

Nunca resolva uma lacuna silenciosamente.

## 5. Scope Lock obrigatório

Cada `plan.md` deve conter uma seção `## Scope Lock` com:

- **IN**: funcionalidades, módulos e paths que a feature pode alterar;
- **OUT**: funcionalidades explicitamente proibidas;
- **Allowed Paths**: arquivos/diretórios permitidos;
- **Prohibited Paths**: arquivos/diretórios proibidos;
- **Dependencies**: dependências externas e internas previamente aprovadas;
- **Non-Goals**: comportamentos que não serão implementados nesta feature.

Uma tarefa nunca pode expandir o Scope Lock por conta própria.

## 6. Fronteiras de código

### App Desktop do Professor (apps/desktop)

- Electron + React + TypeScript.
- Main process: TypeScript/Node.js; acessa `desktopCapturer` e expõe ao renderer via IPC seguro (contextBridge).
- Renderer process: React + TypeScript; UI de login, dashboard e sala.
- Hooks orquestram estado, WebRTC lifecycle, captura de tela e áudio.
- Services encapsulam chamadas HTTP/WebSocket ao backend.
- Tipos/DTOs compartilhados via `packages/types`.
- Nenhum componente do renderer acessa APIs do Electron diretamente; tudo via IPC.

### Web App dos Alunos (apps/web)

- React + TypeScript + Vite.
- Componentes focam em apresentação.
- Hooks orquestram estado, WebRTC lifecycle (subscribe-only) e WebSocket (chat/sinalização).
- Services encapsulam chamadas HTTP/WebSocket.
- Design responsivo: desktop-first (1280px+), mobile funcional (< 768px).
- Tipos/DTOs compartilhados via `packages/types`.
- Nenhum componente inventa contrato de API.

### Backend (apps/backend)

- Go.
- Handlers HTTP não devem conter regra de negócio.
- Casos de uso ficam isolados de transporte.
- WebSocket/sinalização é separado da lógica de domínio.
- Integração WebRTC/SFU deve ficar em módulo próprio (`internal/webrtc`).
- Chat em tempo real via WebSocket (mesmo canal de sinalização ou canal dedicado).
- O servidor SFU não deve receber imagem em formato de frames para reencodificação por participante.

### Pacotes Compartilhados (packages/)

- `packages/types`: DTOs, enums e tipos de eventos WebSocket usados por `apps/desktop` e `apps/web`.
- `packages/ui`: componentes React compartilhados (opcional; só entra se houver consumidor real).
- Nenhum package pode importar de `apps/`.

### Persistência

- PostgreSQL somente onde a spec exigir persistência.
- Alteração de schema exige contrato e decisão registrada na feature.

## 7. Regras de WebRTC e desempenho

Requisitos de referência para a primeira arquitetura, sujeitos a medição no ambiente real:

- tela alvo: até 1920×1080;
- taxa alvo: 30 FPS para aula e produtividade;
- qualidade adaptativa deve ser preservada quando possível;
- suporte para 40+ espectadores em uma sala (limite configurável, padrão 50);
- baixa latência é requisito funcional de experiência, não justificativa para remover validações;
- métricas mínimas devem incluir FPS recebido, bitrate, packet loss, RTT e tempo de entrada na sala.

Não declarar que a meta foi atingida sem medição.

## 8. Segurança

- Tokens nunca devem ser hardcoded.
- Segredos e credenciais nunca entram em specs ou código de teste versionado.
- Professor e aluno devem possuir papéis distintos com capacidades explícitas.
- Aluno não pode publicar a track do professor nem assumir permissão de moderador.
- Validação de autorização deve ocorrer no servidor, mesmo que a UI esconda ações.
- Nunca confiar em dados enviados pelo navegador ou pelo app desktop.
- O renderer do Electron não deve ter acesso direto a APIs do Node.js; usar contextBridge.

## 9. ADR

ADR é obrigatória para:

- troca de SFU/stack WebRTC;
- mudança de codec padrão por decisão arquitetural;
- introdução de broker, CDN, TURN gerenciado ou infraestrutura relevante;
- alteração de autenticação/autorização;
- mudança global de contratos;
- mudança de arquitetura de monólito para serviços separados ou equivalente;
- troca de framework do app desktop ou web;
- qualquer decisão que invalide uma regra da constitution.

ADRs aprovadas existentes:
- `docs/adrs/0001-monorepo-turborepo.md` — Turborepo como estrutura do repositório.
- `docs/adrs/0002-desktop-app-framework.md` — Electron como framework do app do professor.

Fluxo:

1. parar;
2. criar `docs/adrs/NNNN-*.md` a partir do template;
3. registrar contexto, alternativas, decisão e impactos;
4. aguardar aprovação humana;
5. somente depois atualizar spec/plan/tasks, se necessário.

## 10. Definition of Done

Uma tarefa só pode ser marcada como concluída quando:

- corresponde a uma tarefa aprovada;
- respeita o Scope Lock;
- alterou somente paths permitidos;
- não inventou requisitos;
- testes/checks definidos na tarefa foram executados ou a impossibilidade foi registrada;
- contratos foram atualizados quando necessário;
- não há violação da constitution;
- a tarefa foi validada antes de marcar `[x]`.

## 11. Regra de alteração dos artefatos

Um agente não deve editar simultaneamente vários artefatos para "fazer tudo caber". Quando uma mudança afeta um artefato anterior, siga a direção da dependência:

```text
spec -> clarify -> plan -> checklist -> tasks -> analyze -> implementation
```

Depois de mudar um artefato upstream, todos os artefatos downstream afetados devem ser revalidados.

## 12. Padrão Obrigatório de Mensagens de Commit e Pull Request

Todo commit e todo Pull Request no repositório devem seguir obrigatoriamente a seguinte convenção:

- **Prefixo estritamente em inglês**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.
- **Escopo opcional entre parênteses**: ex: `(desktop)`, `(web)`, `(backend)`, `(types)`.
- **Restante da mensagem restritamente em português**: toda a descrição, corpo explicativo e justificativa devem ser redigidos exclusivamente em português.

### Formato
`<tipo>(<escopo>): <descrição em português no imperativo>`

### Exemplos válidos
- `feat(desktop): adiciona suporte a gravação local em .webm e .mp4`
- `fix(backend): corrige validação de senha bcrypt no login do professor`
- `docs(specs): atualiza checklist de requisitos da sala de aula`
- `test(desktop): adiciona testes para alternância de fontes de captura`
- `chore(repo): configura templates de commit e pull request`

Templates oficiais configurados no repositório:
- Commit: `.gitmessage` e `.github/.gitmessage` (ativo via `git config commit.template .gitmessage`)
- Pull Request: `.github/pull_request_template.md`
