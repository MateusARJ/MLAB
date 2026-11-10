# Instruções para Agentes de IA — MLab

Este arquivo governa todo o repositório. O projeto utiliza Spec-Driven Development (SDD) com inspiração e compatibilidade conceitual com o GitHub Spec Kit. Nenhum agente pode tratar código como fonte primária de requisitos.

## 1. Fontes de verdade e hierarquia

A ordem de autoridade é obrigatória:

1. `AGENTS.md` (raiz) — regras operacionais do agente.
2. `spec-kit/.specify/memory/constitution.md` — princípios e gates do projeto.
3. `spec-kit/specs/<feature>/spec.md` — comportamento e requisitos aprovados.
4. `spec-kit/specs/<feature>/clarify.md` — ambiguidades resolvidas.
5. `spec-kit/specs/<feature>/plan.md` — arquitetura e decisões técnicas da feature.
6. `spec-kit/specs/<feature>/contracts/` — contratos entre módulos/serviços.
7. `spec-kit/specs/<feature>/tasks.md` — ordem e escopo de implementação.
8. `spec-kit/specs/<feature>/analyze.md` e `checklists/` — validação antes da implementação.
9. Código existente — evidência do estado atual, nunca autorização automática para alterar comportamento.

`docs/requirements/**` e `docs/requirements.md` são um **espelho derivado** das specs: detalham RF/RNF/RN
com o mesmo ID, mas nunca criam requisito novo. Em caso de conflito, vale `spec-kit/specs/<feature>/spec.md`,
e o arquivo em `docs/requirements/` deve ser corrigido na mesma tarefa que alterou a spec.

Antes de qualquer tarefa, leia `spec-kit/.specify/memory/context-loading.md` e carregue somente o contexto exigido pela fase corrente.

## 2. Escopo do sistema

O sistema é uma plataforma de transmissão de tela para aula ao vivo, composta por:

- **App desktop do professor** (Electron + React): o professor instala o app, informa o nome (sem login — ADR 0006), cria salas, compartilha a tela e transmite áudio. O app inicia o backend embarcado. Ref: ADR 0002.
- **Web app dos alunos** (React + Vite): os alunos acessam via navegador usando um link único do professor, se identificam com Nome e Matrícula e assistem à transmissão. Design responsivo (foco em desktop, mobile funcional).
- **Backend Go** (HTTP/WebSocket + SFU Pion): autenticação, salas, sinalização, chat em tempo real e encaminhamento de mídia via SFU.
- Alunos consumindo a mídia em tempo real sem publicar câmera ou microfone.
- Chat de texto em tempo real acessível a todos os participantes da sala (estilo Jitsi).
- Operação primária em rede local offline, com estado em memória e TURN opcional (ADR 0005). Não há banco de dados; persistência só com nova spec e nova ADR.

### Estrutura do repositório (Monorepo Turborepo — ADR 0001)

```text
mlab/
├── AGENTS.md       ← este arquivo (regras canônicas); lido direto pelo Claude Code
├── turbo.json
├── package.json
├── apps/
│   ├── desktop/    ← Electron + React (professor)
│   ├── web/        ← React + Vite (alunos)
│   └── backend/    ← Go (API + SFU)
├── packages/
│   ├── types/      ← DTOs TypeScript compartilhados
│   └── ui/         ← Componentes React compartilhados
├── docs/           ← requisitos detalhados, métricas, testes de carga
└── spec-kit/
    ├── .specify/   ← constitution, comandos, templates, validador
    ├── specs/      ← features (spec, clarify, plan, tasks, analyze, contracts)
    └── docs/adrs/  ← decisões arquiteturais
```

Todos os paths citados neste arquivo são relativos à raiz do repositório.

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
- agente precisar inventar comportamento não especificado;
- bug bloqueante encontrado durante a tarefa (seção 14).

Nunca resolva uma lacuna silenciosamente.

### Regra anti-deriva

- Todo commit `feat`, `fix`, `perf` ou `refactor` que altere comportamento deve corresponder a uma tarefa `### Txxx` existente em `spec-kit/specs/<feature>/tasks.md`. Commit sem tarefa correspondente viola esta seção.
- Pedido de funcionalidade nova feito diretamente no chat não é exceção: o agente cria ou atualiza os artefatos SDD antes de implementar, ou para e informa quais artefatos faltam.
- Todo Pull Request informa a tarefa no campo "Task do Spec-Kit" do template.
- `npm run spec:check` deve passar antes do merge de qualquer PR que altere `apps/` ou `packages/`.

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
- Renderer process: React + TypeScript; UI de entrada por nome, dashboard e sala.
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

- O MLab não tem banco de dados: salas, chat, arquivos e sessões vivem em memória e somem quando o backend
  embarcado encerra (ADR 0005).
- Qualquer persistência exige nova spec e nova ADR antes de implementar.

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

ADRs aprovadas existentes (fonte: `spec-kit/docs/adrs/`; manter esta lista sincronizada):
- `spec-kit/docs/adrs/0001-monorepo-turborepo.md` — Turborepo como estrutura do repositório.
- `spec-kit/docs/adrs/0002-desktop-app-framework.md` — Electron como framework do app do professor.
- `spec-kit/docs/adrs/0003-estrategia-de-testes-automatizados.md` — estratégia de testes automatizados.
- `spec-kit/docs/adrs/0004-arquitetura-de-seguranca-e-testes-de-seguranca.md` — arquitetura e testes de segurança.
- `spec-kit/docs/adrs/0005-operacao-lan-offline.md` — LAN offline como modo primário, TURN opcional, estado em memória.
- `spec-kit/docs/adrs/0006-descontinuacao-do-login-e-sessao-local.md` — login removido; sessão do professor por nome com chave de host; segredo JWT aleatório por execução.
- `spec-kit/docs/adrs/0007-versionamento-semantico.md` — versionamento semântico (`MAJOR.MINOR.PATCH`) a partir da 1.7.1, com incremento no PR da mudança.
- `spec-kit/docs/adrs/0008-https-na-lan-com-ca-local.md` — HTTPS na LAN com CA local. Vale **só para a edição isolada "MLab HTTPS"** (branch `edicao/https-lan`, não mergeada na `development`; guia em `docs/https-lan.md`).
- `spec-kit/docs/adrs/0009-remocao-da-claim-email-do-professor.md` — remove a claim `email` fixa do JWT do professor; substitui o item 5 da ADR 0006.
- `spec-kit/docs/adrs/0010-sessao-unica-recusa-nova-entrada.md` — matrícula já conectada recusa a nova entrada (`409`/`4002`); substitui a ADR 0004 §2.1.C.
- `spec-kit/docs/adrs/0011-fluxo-de-entrega-somente-main.md` — fim da `development`: branches e PRs partem da `main` e voltam a ela; release só pela tag.
- `spec-kit/docs/adrs/0012-licenca-apache-2-0.md` — Apache 2.0 a partir da 2.3.1; releases antigas (MIT) apagadas do GitHub, tags mantidas.

Fluxo:

1. parar;
2. criar `spec-kit/docs/adrs/NNNN-*.md` a partir de `spec-kit/.specify/templates/adr-template.md`;
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

Um PR que altera `apps/` ou `packages/` só está pronto com o incremento de versão da seção 13 (ou a justificativa de
"sem incremento").

## 11. Regra de alteração dos artefatos

Um agente não deve editar simultaneamente vários artefatos para "fazer tudo caber". Quando uma mudança afeta um artefato anterior, siga a direção da dependência:

```text
spec -> clarify -> plan -> checklist -> tasks -> analyze -> implementation
```

Depois de mudar um artefato upstream, todos os artefatos downstream afetados devem ser revalidados.

## 12. Padrão Obrigatório de Mensagens de Commit e Pull Request

Todo commit e todo Pull Request no repositório devem seguir obrigatoriamente a seguinte convenção:

- **Commits estritamente atômicos por feature ou fix**: É terminantemente PROIBIDO agrupar múltiplas features, fixes ou refatorações distintas em um único commit. Cada commit deve representar uma única entrega isolada e indivisível (ex: um commit para `implementa reproducao de video no aluno`, outro para `link fixo por professor`, outro para `suporte a ngrok e ip de rede`).
- **Prefixo estritamente em inglês**: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`.
- **Escopo opcional entre parênteses**: ex: `(desktop)`, `(web)`, `(backend)`, `(types)`, `(infra)`.
- **Restante da mensagem restritamente em português**: toda a descrição, corpo explicativo e justificativa devem ser redigidos exclusivamente em português.

### Formato
`<tipo>(<escopo>): <descrição em português no imperativo>`

Mudança incompatível (MAJOR, seção 13): `<tipo>(<escopo>)!: <descrição>`, com um parágrafo no corpo começando com
`Quebra de compatibilidade:`.

### Exemplos válidos (isolados por feature/fix)
- `feat(web): implementa reproducao de video no aluno`
- `feat(backend): link fixo por professor`
- `feat(network): suporte a ngrok e ip de rede`
- `fix(desktop): corrige layout fixo sem rolagem na tela de transmissao`
- `docs(specs): atualiza checklist de requisitos da sala de aula`
- `chore(repo): configura templates de commit e pull request`

Templates oficiais configurados no repositório:
- Commit: `.gitmessage` e `.github/.gitmessage` (ativo via `git config commit.template .gitmessage`)
- Pull Request: `.github/pull_request_template.md`

## 13. Versionamento semântico

Fonte: `docs/versionamento.md` (ADR 0007). O MLab segue `MAJOR.MINOR.PATCH` com versão única no monorepo, a partir
da 1.7.1.

- Todo PR para a `main` que altera o que é entregue (`apps/`, `packages/`) termina com **um** commit
  `chore(release): versao X.Y.Z`, gerado por `npm run bump -- patch|minor|major`, seguido de `npm run version:check`.
- O nível segue o escopo de `docs/versionamento.md` §2:
  - **MAJOR**: quebra de compatibilidade (funcionalidade removida ou fluxo incompatível, contrato incompatível,
    requisito de sistema maior, configuração ou dados incompatíveis);
  - **MINOR**: funcionalidade nova compatível (US/RF novo, adição compatível em contrato, nova opção ou formato);
  - **PATCH**: correção, segurança, desempenho ou refatoração sem mudança de capacidade nem de contrato;
  - **sem incremento**: só `docs`, `test`, `ci`, `style`, `spec-kit/**` ou ferramentas que não mudam o instalador.
- Num PR com vários commits vale o maior nível. Registre o nível e a justificativa no `converge.md` e no PR.
- Na dúvida sobre MAJOR, pare e pergunte (seção 4). Nunca edite `"version"` à mão, nunca crie tag ou release.
- Nenhum build (`npm run make*`) altera a versão.

## 14. Desvios encontrados durante o trabalho

Desvio é qualquer bug, erro, teste instável, regressão ou incoerência entre código e artefatos que o agente encontra
**fora do escopo da tarefa em andamento** (feature, fix, docs, refatoração ou qualquer outra). Nenhum desvio fica
registrado só na conversa.

1. **Registrar como issue no repositório MLab**, pelo template `.github/ISSUE_TEMPLATE/bug-desvio.md`, com título no
   padrão da seção 12 e as labels:
   - tipo: `bug`, `enhancement` ou `documentation`;
   - origem: `desvio`;
   - área: `area:desktop`, `area:web`, `area:backend`, `area:types`, `area:ci` ou `area:spec-kit`;
   - `bloqueante`, somente quando o item 3 se aplica.
2. **Evitar duplicata:** antes de abrir, pesquisar (`gh issue list --search "<termo>" --state all`). Se já existir
   issue aberta, comentar nela com a nova evidência em vez de abrir outra.
3. **Classificar o impacto na tarefa atual:**
   - **Não bloqueante** — a tarefa pode ser cumprida e verificada sem corrigir o desvio. O agente abre a issue, cita o
     número no PR (campo "Desvios encontrados") e no `converge.md` (seção "Desvios registrados") e **continua** a
     tarefa.
   - **Bloqueante** — o desvio impede cumprir ou verificar a tarefa, invalida seus testes/checks ou obrigaria o agente
     a inventar comportamento. O agente **para imediatamente**, sem commit parcial da tarefa, abre a issue com a label
     `bloqueante` e responde ao usuário com: o que estava fazendo, por que parou, a evidência e o número da issue.
4. **Não corrigir o desvio dentro da tarefa atual.** A correção segue o fluxo da seção 3 em tarefa própria, respeitando
   o Scope Lock (seção 5).
5. Se a issue não puder ser criada (ex.: falha do `gh`), o agente para e entrega ao usuário o texto pronto da issue.

## 15. Fluxo de branch, commit e Pull Request

Vale para todo trabalho que altera o repositório — feature, fix, docs, spec-kit, refatoração, CI, build ou chore.

- **Branch nova por entrega**, criada a partir da `main` atualizada (`git pull` antes). Nunca commitar diretamente
  na `main` (ADR 0011).
- **Nome da branch:** `<tipo>/<descricao-curta-em-kebab-case>`, com o mesmo `<tipo>` dos commits (seção 12):
  `feat/`, `fix/`, `docs/`, `refactor/`, `perf/`, `test/`, `build/`, `ci/`, `chore/`, `style/`.
- **Commits** atômicos pelo template `.gitmessage` (seção 12); referenciar a tarefa (`Ref: Txxx`) e, quando houver, a
  issue (`Refs #N`).
- **Um PR por branch**, para a `main`, pelo template `.github/pull_request_template.md`, preenchendo tarefa do
  Spec-Kit, impacto de versão (seção 13) e desvios encontrados (seção 14). O merge é feito pelo responsável, com
  merge commit, depois dos três builds do CI; a release é só a tag (`docs/versionamento.md` §5).
- **Push forçado** somente na própria branch, sem PR em revisão ou com aviso no PR, e sempre com `--force-with-lease`.
