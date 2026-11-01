# Plano de Remediação — Spec Kit + Segurança

Data: 2026-11-01
Status: EXECUTADO (F0–F6) em 2026-11-01 — aprovado integralmente pelo dono do produto; pendências em `specs/002-security-hardening/converge.md`
Base: análise de 2026-10-31 (commit `4f3caad`, versão 1.5.7)
Revisão 2 (2026-11-01): **o login do professor (e-mail/senha) foi descontinuado por decisão do dono do produto** e será removido por completo — código, testes, tipos, contratos e requisitos. O sistema funciona exclusivamente com a sessão por nome (ADR 0006).

## 0. Princípios deste plano

1. **Zero regressão funcional.** Nenhuma feature existente é removida ou desativada — **exceto o login do professor**, descontinuado por decisão explícita (ver S3 e ADR 0006). O login já não é usado por nenhum cliente desde o commit `4f3caad`, então removê-lo não altera nenhum fluxo em uso. Toda outra feature hoje no código passa a ser documentada; nenhuma é "desfeita" para caber na spec antiga.
2. **A spec se ajusta à realidade aprovada, não o contrário.** Comportamentos já entregues que contradizem a spec viram *emendas* (com ADR quando o AGENTS.md exige), não reversões.
3. **O próprio plano respeita o SDD.** Correções de segurança são uma feature (`002-security-hardening`) com spec → clarify → plan (Scope Lock) → checklist → tasks → analyze → implement → converge.
4. **Fail-closed sem quebrar o fluxo.** Toda proteção nova é desenhada para que o caminho legítimo (app desktop local + alunos na LAN/ngrok) continue funcionando sem passos extras para o professor.
5. **Uma task = um commit atômico** no padrão do §12 (`tipo(escopo): descrição em português`).

## 1. Visão geral das fases

| Fase | Objetivo | Tipo | Altera código? |
|---|---|---|---|
| F0 | Baseline de regressão (testes sem cache + smoke manual) | verificação | não |
| F1 | Governança: AGENTS.md visível às IAs, paths, ADRs, validador | docs/kit | não (só `.specify`, raiz) |
| F2 | `converge` da feature 001 (registrar todos os gaps) | docs | não |
| F3 | ADRs 0005 e 0006 (LAN offline; sessão local do professor) | docs | não |
| F4 | Emendas da 001 + feature retroativa `003-classroom-interaction` | docs | não |
| F5 | Feature `002-security-hardening` (S1–S8) | código | sim |
| F6 | Converge final, matriz de regressão, release | verificação | não |

Ordem obrigatória: F0 → F1 → F2 → F3 → F4 → F5 → F6.
Motivo: o §4 do AGENTS.md bloqueia mudança de código que altere contrato não registrado. Os endpoints de arquivos e a `/auth/session` não têm contrato hoje, então F4 precisa registrá-los antes de F5 alterá-los.

**Fast track opcional:** S1 (segredo JWT) não altera contrato nenhum. Se você aprovar, ela pode entrar logo após F3 (spec 002 mínima + ADR 0006 aprovadas), antes do resto de F4.

Branches sugeridas (a partir de `main` atualizado com `master`):
- `docs/realinhamento-speckit` → F1–F4
- `fix/security-hardening` → F5

---

## F0 — Baseline de regressão

| ID | Ação | Saída |
|---|---|---|
| F0.1 | `npx turbo run test --force` (sem cache) e `go test -count=1 ./...` | log salvo em `docs/metrics/baseline-2026-11.md` |
| F0.2 | `npx turbo run build` e `npm run make:win` (empacotado) | build OK registrado |
| F0.3 | Executar a **Matriz de Smoke** (Anexo A) no app empacotado + 2 alunos (1 desktop, 1 mobile) | checklist preenchida com OK/FALHA |

Qualquer FALHA na baseline é registrada como pré-existente — não é atribuída às correções.

---

## F1 — Governança do Spec Kit

| ID | Ação | Arquivos | Critério de aceite |
|---|---|---|---|
| G1 | Tornar as regras visíveis às IAs: mover `AGENTS.md` para a raiz do repo (canônico) e criar `CLAUDE.md` na raiz contendo apenas `@AGENTS.md`. Em `spec-kit/AGENTS.md` deixar um ponteiro de uma linha. | `/AGENTS.md`, `/CLAUDE.md`, `spec-kit/AGENTS.md` | Uma sessão nova do Claude Code/Codex carrega as regras sem instrução manual |
| G2 | Unificar a base de paths: todos os paths do AGENTS.md passam a ser relativos à raiz (`spec-kit/.specify/...`, `spec-kit/specs/...`, `apps/...`). Trocar `screenshare/` por `mlab/` na árvore. | `/AGENTS.md`, `context-loading.md`, `project-context.md` | Nenhum path ambíguo; grep por `screenshare/` vazio nos docs de governança |
| G3 | Atualizar a lista de ADRs aprovadas (0001–0004 + futuras 0005/0006 quando aprovadas). | `/AGENTS.md`, `spec-kit/README.md` | Lista bate com `docs/adrs/` |
| G4 | Validador executável: documentar requisito Python 3.10+ e adicionar script raiz `"spec:check": "python spec-kit/.specify/scripts/validate_spec.py"` (com fallback `py` no Windows). | `package.json`, `spec-kit/README.md` | `npm run spec:check -- <feature>` roda nesta máquina |
| G5 | Criar `converge-template.md` (não existe) com seções: atendidos / parciais / divergências / testes faltantes / novas tasks. | `.specify/templates/converge-template.md` | Template referenciado por `commands/converge.md` |
| G6 | Corrigir status desatualizados: README do kit ("READY-FOR-T005" → estado real), checklist (`media-session.md` DRAFT → READY), `project-context.md` (gravação local não é mais não-objetivo; LAN offline). | arquivos citados | Nenhum status contraditório entre artefatos |
| G7 | Declarar a relação de `docs/requirements/**` (raiz) com `spec.md`: **espelho derivado** (spec é a fonte; arquivos RF/RN/RNF são detalhamento) — ver decisão D2. | `/AGENTS.md` §1, `docs/requirements.md` | Hierarquia explícita |
| G8 | Adicionar ao AGENTS.md uma regra anti-deriva: "commit de feature sem task correspondente em `tasks.md` viola o §4" e um item no template de PR: "Task SDD: Txxx". | `/AGENTS.md`, `.github/pull_request_template.md` | Template de PR exige referência de task |

Commits: `docs(agents): ...`, `chore(speckit): ...` — um por ID.

---

## F2 — Converge da feature 001

| ID | Ação | Arquivo |
|---|---|---|
| C1 | Criar `converge.md` comparando código × spec/plan/tasks. Registrar no mínimo: RN-06 (slug fixo), RN-18 (histórico de chat), US-01/RF-12/RN-01 (login descontinuado — código residual no backend a remover em S3), "upload de arquivos" fora de escopo, C-04 (TURN), C-01/RNF-10 (PostgreSQL), RNF-02/RNF-09 (60 fps / REMB 8 Mbps), e as ~15 features sem task. | `specs/001-screen-share-core/converge.md` |
| C2 | Marcar T014 (Login) como **REMOVIDA — feature descontinuada** e T029 (Permissions) como **SUPERSEDED**, sem desmarcar `[x]` (preservar histórico), com referência ao commit `4f3caad` e à ADR 0006. T008 recebe nota: "`POST /auth/login` e bcrypt removidos em 002/S3". | `tasks.md` |
| C3 | Expandir `analyze.md` para cobrir RF-14..RF-29, RNF-08..RNF-18 e RN-01..RN-20. Status volta para **FAIL** até F4 fechar os gaps (honestidade exigida pelo `converge`). | `analyze.md` |
| C4 | Marcar Princípio VIII no plan como "em andamento — ver converge.md". | `plan.md` |

---

## F3 — ADRs (exigem aprovação humana antes de F4)

### ADR 0005 — Operação LAN offline como modo primário
- **Contexto:** README e código já operam 100% em LAN (mDNS `mlab.local`, IP físico, ngrok opcional). C-04 diz TURN obrigatório; C-01 diz PostgreSQL.
- **Decisão proposta:** modo primário = LAN offline; TURN **opcional** (habilitado por env para cenários externos/ngrok); estado 100% em memória por processo (sem PostgreSQL nesta versão); backend embarcado e iniciado pelo app desktop.
- **Impacto:** emendas em C-01, C-04, RNF-10, `project-context.md`. Nenhuma mudança de código.

### ADR 0006 — Descontinuação do login e sessão local do professor vinculada ao host
- **Contexto:** o login por e-mail/senha não é mais viável para o produto (uso em laboratório, app instalado na máquina do professor, operação offline sem cadastro central). A UI de login já foi removida (`4f3caad`), mas o backend ainda mantém `POST /auth/login`, bcrypt, um store de professores e credenciais semeadas. Além disso, `/auth/session` emite JWT de professor para qualquer requisição (falha crítica).
- **Decisão proposta:**
  1. **O login é descontinuado e removido por completo** (endpoint, handler, store de professores, credenciais semeadas, bcrypt, tipos `LoginRequest`, testes e contratos). Não existe conta de professor no sistema.
  2. A identidade do professor é **posse do computador onde o app roda**: ele informa só o nome, e a emissão do token exige uma chave aleatória por execução (`MLAB_HOST_KEY`) gerada pelo processo principal do Electron, entregue ao backend por env e ao renderer por IPC.
  3. O segredo JWT é gerado aleatoriamente a cada execução do backend.
- **Alternativas rejeitadas:** manter o login (descontinuado pelo produto); manter `/auth/login` só para dev (código morto que precisa ser mantido e testado); checar só loopback (burlável via ngrok e via proxy do Vite, que chegam como `127.0.0.1`).
- **Supersede:** C-01 (parte do professor: "credenciais armazenadas no PostgreSQL") e ADR 0004 §2.1.A ("Hash de Senha: bcrypt"). A ADR 0004 recebe uma nota apontando para a 0006; os demais controles dela permanecem.
- **Impacto:** US-01, RF-12 e RN-01 reescritos; `contracts/auth.md` sem `POST /auth/login`; RF012/RN001 em `docs/requirements/` reescritos; README sem bcrypt.

---

## F4 — Emendas da 001 e feature retroativa 003

Seguir a direção `spec → clarify → plan → checklist → tasks → analyze` (§11).

### F4.1 — Emendas em `001-screen-share-core` (documentam o que já existe)
| Item | Emenda |
|---|---|
| US-01 | Reescrita: "Entrada do professor no app desktop" — informa o nome e recebe JWT `role: professor` (8h); sem e-mail, senha ou cadastro. "Logout" passa a ser "sair da sessão" (descarta o token local) |
| RF-12 | Reescrito: "o professor inicia sessão no app desktop informando apenas o nome; a emissão exige chave de host (ADR 0006)" |
| RN-01 | Reescrita: "JWT de professor emitido somente mediante chave de host válida (TTL 8h)"; remover bcrypt |
| C-01 | Nota de supersessão da parte do professor (ADR 0006) |
| `contracts/auth.md` | Remover `POST /auth/login`; documentar `POST /auth/session` (header `X-MLab-Host-Key`, body `{name}`, resposta `{token, expiresAt, name}`, erros 403/500) |
| `contracts/room-api.md` | Remover referências ao login como pré-condição; pré-condição passa a ser o token de `/auth/session` |
| `docs/requirements/functionals/RF012-*.md`, `business-rules/RN001-*.md` | Reescritos conforme acima (manter o ID, mudar título/conteúdo) |
| `docs/metrics/validation_report.md` | Nota de rodapé: menções ao login são históricas |
| RN-06 | Slug fixo/legível derivado do professor (`/sala/{sala}/{prof}`), reuso entre sessões (já em T032) |
| RNF-02 / RNF-09 | Perfis 1080p@30 (4 Mbps) e 1080p@60 (6 Mbps); teto REMB 8 Mbps |
| C-01 / C-04 / RNF-10 | Conforme ADR 0005 |
| "Não incluído" | Remover "upload de arquivos" daqui e movê-lo para a feature 003 |
| RN-18 | Movida para 003 com nova redação (histórico em memória com limite) |

### F4.2 — Nova feature `003-classroom-interaction` (retroativa)
Artefatos: `spec.md`, `clarify.md`, `plan.md` (Scope Lock), `contracts/`, `tasks.md`, `analyze.md`, `checklists/`.
Cada feature já entregue vira uma US com critérios **extraídos do comportamento atual e dos testes existentes**:

| US | Feature existente | Evidência |
|---|---|---|
| US-11 | Levantar/abaixar mão com fila ordenada | `hub_hand_test.go`, `RoomHandRaise.test.tsx` |
| US-12 | Fixar mensagens (limite 3) | commits `aafe300`, `611990c`, `1627d99` |
| US-13 | Chat privado aluno↔professor | commit `2a0e2c2` |
| US-14 | Máscara de palavrões (leet, repetição, acento, caps) | `profanity_test.go` |
| US-15 | Histórico de chat para quem entra depois (limite) | `hub.go` `chatHistory` |
| US-16 | Compartilhamento de arquivos (upload professor, download aluno) | `room/files.go` |
| US-17 | Validação de matrícula por regex | commit `bbd7caa` |
| US-18 | Áudio interno do computador | commit `89e35c8` |
| US-19 | Overlay de anotações, lupa, atalho duplo Ctrl | `FloatingAnnotationOverlay.test.tsx`, `doubleCtrlDetector.test.ts` |
| US-20 | Ocultação contextual do cursor, tracker nativo de janelas | `cursorVisibility.test.ts`, `nativeWindowTracker.test.ts` |
| US-21 | Proteção de conteúdo e captura para área de transferência | commit `82e8487` |
| US-22 | Link institucional `mlab.local` / mDNS | `mdns_test.go` |

Contratos novos (obrigatórios antes de F5):
- `contracts/files.md` — `POST/GET /rooms/{id}/files`, `GET .../download`, limites (já com a autenticação que S4 vai introduzir, marcada como "vigente a partir de 002/S4").
- `contracts/signaling-classroom.md` — eventos de mão, fixação, chat privado, histórico.
- `contracts/desktop-ipc.md` — canais IPC do preload (anotação, lupa, clipboard, permissões, host key).

Tasks da 003: `T301..T312` todas `[x]` com check "evidência: arquivo/teste/commit". Gaps encontrados (ex.: feature sem teste) viram tasks `[ ]` novas — **sem alterar comportamento**.

Saída de F4: `analyze.md` da 001 e da 003 em **PASS**; checklists APPROVED.

---

## F5 — Feature `002-security-hardening`

Spec mínima: RNF-SEC-01..08 abaixo. Scope Lock:
- **IN:** S1–S8 (incluindo a remoção completa do login em S3).
- **OUT:** qualquer mudança de UX, remoção de outra feature, troca de stack, persistência, renomear claims do JWT.
- **Non-Goals:** recriar qualquer forma de conta/senha de professor.
- **Allowed Paths:** `apps/backend/cmd/server/**`, `apps/backend/internal/{auth,room,signaling}/**`, `apps/backend/go.mod`, `apps/backend/go.sum`, `README.md` (apenas seções de bcrypt/licenças), `apps/desktop/src/main/**`, `apps/desktop/src/renderer/services/**`, `apps/desktop/src/renderer/pages/Room.tsx` (apenas chamadas fetch de arquivos), `apps/web/src/services/**`, `apps/web/src/hooks/useWebRTCSubscriber.ts`, `apps/web/src/pages/Room.tsx` (apenas `href` de download), `scripts/dev.js`, `turbo.json`, `packages/types/src/index.ts`, `spec-kit/specs/002-security-hardening/**`.
- **Prohibited Paths:** `apps/backend/internal/webrtc/**`, `apps/backend/internal/chat/**`, `apps/desktop/src/renderer/media/**`, `packages/ui/**`, `.github/workflows/**`.
- **Dependencies:** nenhuma nova (Go `crypto/rand`, `crypto/subtle`; Node `crypto`).

Regra de execução por task: rodar **todos** os testes (`turbo run test --force`, `go test -count=1 ./...`) + itens da Matriz de Smoke indicados. Task só recebe `[x]` com tudo verde.

### S1 — Remover segredo JWT hardcoded 🔴
- **Backend** `cmd/server/main.go`: se `JWT_SECRET` vazio → gerar 32 bytes com `crypto/rand` em memória (`hex`), logar "JWT_SECRET efêmero gerado para esta execução" **sem imprimir o valor**. Remover a constante `dev-secret-key-12345`.
- **Desktop** `src/main/main.ts:537`: deixar de passar a constante; repassar `JWT_SECRET` só se vier do ambiente.
- **Por que não quebra:** os tokens só são verificados pelo próprio backend; salas já são perdidas quando o backend reinicia (estado em memória), então invalidar tokens no restart não muda comportamento observável.
- **Testes novos:** `main_test.go` — sem env, o segredo gerado não é vazio, tem ≥ 32 bytes e difere entre duas inicializações; nenhum log contém o segredo.
- **Smoke:** A1, A2, A10, A16.
- Commit: `fix(backend): gera segredo jwt aleatorio por execucao e remove chave fixa`

### S2 — Proteger `/auth/session` com chave de host 🔴
- **Desktop main:** gerar `MLAB_HOST_KEY` (`crypto.randomBytes(32).toString('hex')`) na inicialização, salvo se já vier do ambiente (modo dev). Passar ao backend embarcado via env. Expor ao renderer via IPC `get-host-key` no `preload.ts` (registrar em `contracts/desktop-ipc.md`).
- **`scripts/dev.js`:** gerar a chave e exportar no env do turbo; adicionar `MLAB_HOST_KEY` em `globalPassThroughEnv` do `turbo.json`.
- **Backend** `auth/handler.go` `session`: exigir header `X-MLab-Host-Key` comparado com `subtle.ConstantTimeCompare`. Sem `MLAB_HOST_KEY` configurado → `403` (fail-closed) + log explicando como habilitar. Adicionar o header em `Access-Control-Allow-Headers`.
- **Renderer** `services/auth.ts`: obter a chave via `window.electronAPI.getHostKey()` e enviá-la no header.
- **Por que não quebra:** o professor continua entrando só com o nome; o app empacotado e o `npm run dev` geram e distribuem a chave automaticamente.
- **Ganho:** aluno na LAN, via ngrok ou via proxy do Vite não consegue mais obter token de professor → fecha também o sequestro do `/rooms/active` por sala falsa.
- **Testes novos:** sem header → 403; header errado → 403; header certo → 200 com `role: professor`; backend sem chave → 403. Atualizar `auth_test.go:220`. Teste do serviço do desktop com mock do IPC.
- **Smoke:** A1, A2, A3, A16 + tentativa manual `curl -X POST http://<ip>:8080/auth/session` a partir de outra máquina → 403.
- Commit: `fix(auth): exige chave de host na emissao de sessao do professor`

### S3 — Remoção completa do login do professor 🟠
Feature descontinuada (ADR 0006). Elimina de vez as credenciais semeadas `professor123` e todo o código morto associado.

**Backend (`apps/backend`)**
- `internal/auth/handler.go`: remover a rota `POST /auth/login` e a função `login`. `NewHandler()` deixa de receber o store.
- `internal/auth/store_inmemory.go`: **apagar o arquivo** (store de professores, seed `professor@mlab.local` / `professor@screenshare.local` / `professor123`).
- `internal/auth/model.go`: remover `Professor`, `PasswordHash`, `LoginRequest`, a interface `Store` e `ErrProfessorNotFound`. Renomear `LoginResponse` → `SessionResponse` (**mesmo JSON**: `token`, `expiresAt`, `name`).
- `cmd/server/main.go`: remover `auth.NewInMemoryStore()`; `auth.NewHandler()` sem argumento. **Não confundir** com `room.NewInMemoryStore()`, que permanece.
- `internal/auth/jwt.go`: `SignProfessorToken` e as claims ficam **inalteradas**, inclusive a claim `email` fixa usada pela `/auth/session`, porque `room/handler.go` usa `slugFromEmail` como fallback do slug do professor. Mudar isso quebraria o link fixo (T032) e está fora do escopo.
- `go.mod`/`go.sum`: `go mod tidy` para remover `golang.org/x/crypto` se o bcrypt era o único uso.
- **Testes:** apagar `TestInMemoryStore_FindProfessorByEmail` e qualquer teste de `/auth/login`; ajustar as referências a login/store em `auth_test.go`, `room_test.go`, `room_security_test.go` e `signaling_security_test.go` (hoje 12 ocorrências) para obter o token via `SignProfessorToken`, que é o que a sessão usa. Os testes de segurança do JWT (`ForgedSecret`, `ClaimManipulation`, `AlgorithmNoneAttack`, `MissingSecret`) **permanecem**. Novo teste: `POST /auth/login` → 404.

**Tipos compartilhados (`packages/types/src/index.ts`)**
- Remover `LoginRequest` (`email`, `password`). Renomear `LoginResponse` → `SessionResponse` e criar `SessionRequest { name: string }`.
- `apps/desktop/src/renderer/services/auth.ts`: atualizar o import (único consumidor). Nenhuma mudança de comportamento.

**Docs nesta task:** README raiz (remover "bcrypt" da árvore e a linha de licença do x/crypto, se a dependência sair).

- **Ordem:** S3 vem **depois** de S2, porque S2 já mexe em `handler.go`/`auth.ts`; assim os diffs não se sobrepõem.
- **Por que não quebra:** nenhum cliente chama `/auth/login` desde `4f3caad`; o formato JSON da sessão não muda; as claims do JWT não mudam.
- **Verificação extra:** `grep -rniE "auth/login|bcrypt|professor123|LoginRequest|PasswordHash" apps packages` → vazio (fora de `dist/`, que é regenerado no build).
- **Smoke:** A0, A1, A2, A3 (dev e empacotado).
- Commits (atômicos):
  - `refactor(backend): remove login de professor, store de credenciais e bcrypt`
  - `refactor(types): substitui tipos de login por tipos de sessao`

### S4 — Autenticar listagem/download de arquivos e limitar memória 🟠
- **Backend** `room/files.go` / `handler.go`: `GET /rooms/{id}/files` e `.../download` passam a exigir token (header `Authorization: Bearer` **ou** `?token=`, mesmo padrão já usado no WebSocket) com `room_id` igual à sala (aluno) ou `sub == owner_id` (professor). Resolver slug → ID canônico como `joinRoom` já faz.
- Limites: `http.MaxBytesReader` (50 MB + margem multipart, mantendo o limite atual por arquivo), teto por sala (proposta: 300 MB e 50 arquivos, configuráveis por env) → `413`. Liberar os arquivos da memória ao encerrar a sala (verificar se já ocorre; se sim, só cobrir com teste).
- **Web:** `useWebRTCSubscriber.ts:375` envia `Authorization` com `getStudentToken()`; `Room.tsx` (linhas ~925 e ~1023) acrescenta `?token=` ao `href` de download.
- **Desktop:** `Room.tsx:1237` adiciona `Authorization` na listagem (o upload já envia).
- **Testes novos:** sem token → 401; token de outra sala → 403; aluno da sala → 200; professor dono → 200; upload acima do teto → 413; arquivos liberados no close.
- **Smoke:** A13 (upload, listagem e download no desktop e no mobile).
- Commit: `fix(room): exige token da sala para listar e baixar arquivos e limita memoria`

### S5 — `/rooms/active` determinístico 🟡
- `store.go` `GetActiveRoom`: prioridade `publishing` > `waiting`; desempate por `CreatedAt` mais recente (hoje depende da ordem aleatória de iteração do map).
- **Testes:** 2 salas ativas → retorna sempre a esperada.
- **Smoke:** A9 (redirecionamento do aluno para a sala ativa).
- Commit: `fix(room): torna selecao de sala ativa deterministica`

### S6 — Allowlist de origem no WebSocket e no CORS 🟡
- Função única `isAllowedOrigin(origin, r)` aceitando: Origin vazio (clientes não-browser), `null`/`file://` (renderer Electron empacotado), mesmo host da requisição, `localhost`/`127.0.0.1`/`[::1]` em qualquer porta (dev Vite/electron-vite), `mlab.local`, hosts de `NGROK_URL`/`PUBLIC_URL`, IP de rede detectado.
- Usada em `signaling/handler.go` (`CheckOrigin`) e no `corsMiddleware` (refletir a origem permitida + `Vary: Origin` no lugar de `*`).
- **Testes:** matriz de origens aceitas/recusadas.
- **Risco:** médio (é a mudança com mais chance de afetar um cenário de rede). Mitigação: smoke completo de rede (A2, A9, A15, A16, A17) antes do `[x]`; se algum cenário falhar, a origem é acrescentada à allowlist — nunca voltar para `true`.
- Commit: `fix(signaling): valida origem do websocket e do cors por allowlist`

### S7 — Endurecimento do Electron 🟡
- `setWindowOpenHandler` → `deny` (links http/https abertos via `shell.openExternal`) e bloqueio de `will-navigate` para fora da origem do app, na janela principal e no overlay.
- `sandbox: true`: o preload hoje importa `clipboard`, que não está disponível em preload sandboxed. Mover `clipboard.writeText` para o processo principal via IPC `write-clipboard-text` (mesma API exposta ao renderer, implementação diferente). Só então ligar `sandbox: true` na janela principal e no overlay.
- **Gate:** se o empacotado no Windows/Linux falhar em qualquer item da matriz, manter `sandbox: false` e registrar exceção no `converge` da 002 (não bloqueia as demais tasks).
- **Smoke:** A4–A8, A11, A12 (captura, anotação, lupa, clipboard).
- Commits: `fix(desktop): bloqueia navegacao e janelas externas` · `refactor(desktop): move escrita na area de transferencia para o processo principal` · `fix(desktop): habilita sandbox no renderer`

### S8 — Remover path absoluto da máquina do desenvolvedor 🟢
- `main.ts:460`: remover `c:\Users\User\Documents\mlab\...`; os candidatos relativos já cobrem o cenário.
- **Smoke:** A1 em dev e empacotado.
- Commit: `chore(desktop): remove caminho absoluto local da busca do backend`

### Saída de F5
`specs/002-security-hardening/converge.md` com: RNF-SEC atendidos, exceções (ex.: sandbox, se for o caso), evidência de testes.

---

## F6 — Converge final e release

| ID | Ação |
|---|---|
| R1 | `turbo run test --force`, `go test -count=1 -race ./...`, `turbo run build`, `npm run make:win` (e Linux via WSL) |
| R2 | Matriz de Smoke completa (Anexo A) comparada com a baseline F0 — nenhum item OK → FALHA |
| R3 | Rodar `docs/load-test/load_test.go` (40 espectadores) para confirmar que S4/S6 não afetaram o join |
| R4 | `converge.md` de 001, 002 e 003 fechados; `analyze` PASS nas três; `npm run spec:check` limpo |
| R5 | `npm run bump` + release; README do kit com o estado final |

---

## Decisões que preciso de você

| # | Decisão | Recomendação |
|---|---|---|
| D1 | Renomear `spec-kit/` para `spec-kit/` (parênteses atrapalham shells e globs)? | Sim, junto com G2 (um commit `chore(speckit)` só de renomeação) |
| D2 | `docs/requirements/**` da raiz: espelho derivado da spec ou descontinuar? | Espelho derivado (preserva o trabalho e dá rastreabilidade) |
| D3 | Aprovar ADR 0005 (LAN offline, TURN opcional, sem PostgreSQL) | Aprovar — reflete o produto real |
| D4 | Aprovar ADR 0006 (remoção do login + sessão por nome com chave de host) | Aprovar — formaliza a descontinuação, mantém a UX e fecha a falha |
| D5 | Fast track da S1 antes do fim de F4? | Sim — risco zero de contrato, falha crítica |
| D6 | Limites de arquivos por sala (S4) | 300 MB / 50 arquivos, configuráveis |

---

## Anexo A — Matriz de Smoke (regressão funcional)

| # | Cenário | Origem |
|---|---|---|
| A0 | `POST /auth/login` retorna 404; não existe tela, campo ou menção a login/senha no app | ADR 0006 (a partir de S3; na baseline F0 o resultado esperado é o comportamento antigo) |
| A1 | Professor entra por nome e chega ao Dashboard (dev e empacotado) | sessão |
| A2 | Criar sala, copiar link fixo, link funciona em outro PC da LAN | T032/T033 |
| A3 | Encerrar sala → alunos recebem `room-closed` | RF-15 |
| A4 | Transmitir tela cheia imediata; trocar para janela específica sem reconectar | RF-26/27, RN-12 |
| A5 | Múltiplas janelas / tracker nativo / prevenção de oclusão | `72d1df4`, `9db5a84` |
| A6 | Microfone mute/unmute + áudio interno | RF-20, `89e35c8` |
| A7 | Perfis 1080p 30 e 60 fps | RNF-01/02 |
| A8 | Gravação local .webm e .mp4 (pausar, retomar, salvar via diálogo) | US-10 |
| A9 | Aluno abre `/` e é redirecionado para a sala ativa; entra com nome + matrícula válida; matrícula inválida bloqueada | T030, `bbd7caa` |
| A10 | Vídeo e áudio chegam ao aluno sem tela preta; autoplay "Ativar som"; fullscreen; PiP | RF-21/22, T031 |
| A11 | Overlay de anotações fora do app, lupa por botão e por duplo Ctrl | `5f963bc`, `17aa66d` |
| A12 | Cursor ocultado contextualmente; proteção de conteúdo; captura para área de transferência | `cae96ca`, `82e8487` |
| A13 | Upload de arquivo pelo professor; listagem e download pelo aluno (desktop e mobile) | files |
| A14 | Chat público com palavrão mascarado; chat privado; fixar até 3 mensagens; histórico para quem entra atrasado | 003 |
| A15 | Levantar/abaixar mão; fila ordenada; toast no professor | `15925bd` |
| A16 | Acesso via `mlab.local` (mDNS) e via IP | `f43a32b` |
| A17 | Acesso via ngrok (`NGROK_URL`) | T033 |
| A18 | Queda de rede do aluno → backoff; queda do professor → `reconnecting` 30s | RF-18/19 |
| A19 | Sessão duplicada do mesmo aluno → `4001` | RN-04 |
| A20 | Rate limit do chat → `CHAT_RATE_LIMITED` sem desconectar | RN-15/16 |
