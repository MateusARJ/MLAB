# Clarify: Transmissão de Tela em Sala

Feature: `001-screen-share-core`
Status: CLOSED

Todas as ambiguidades bloqueantes foram resolvidas. A feature está liberada para plan e implementação.

---

## C-01 — Autenticação

> **Supersessão parcial (2026-11-01):** a parte do professor (credenciais e-mail/senha armazenadas em PostgreSQL) foi superada pela [ADR 0006](../../docs/adrs/0006-descontinuacao-do-login-e-sessao-local.md): não há login; o professor informa só o nome e o token exige chave de host. A parte do aluno (Nome + Matrícula, JWT com `room_id`) permanece válida.

- **Contexto:** a autorização do professor e do aluno precisa ser verificável no servidor.
- **Decisão necessária:** método de autenticação da primeira versão.
- **Opções consideradas:** sessão baseada em cookie; JWT; provedor externo.
- **Resposta aprovada:** JWT.
  - Professor: credenciais de login (e-mail/senha ou equivalente) armazenadas no PostgreSQL. O JWT emitido após login contém `role: professor` e `room_id` quando aplicável.
  - Aluno: ao entrar via link único, informa Nome Completo e Matrícula. O servidor emite um JWT com `role: aluno`, `name`, `student_id` e `room_id`. Não há senha de aluno nesta versão. A identificação serve para controle de presença e exibição no chat.
  - Sem integração com banco de dados da instituição nesta versão; a matrícula é apenas um campo de texto identificador.
- **Impacto:** contratos de token (`contracts/auth.md`), login do professor e entrada do aluno.

---

## C-02 — Limite da Sala

- **Contexto:** o requisito é 40+ alunos, mas o limite operacional influencia recursos e UX.
- **Decisão necessária:** limite inicial.
- **Opções consideradas:** 30; 50; 100; configurável.
- **Resposta aprovada:** 50 participantes por sala (configurável via variável de ambiente no backend). O alvo de design é 40 alunos simultâneos; 50 é a margem de segurança operacional.
- **Impacto:** contrato de entrada (`contracts/room-api.md`) e política de recursos da SFU.

---

## C-03 — Implementação da SFU

- **Contexto:** a topologia precisa ser SFU para não sobrecarregar o upload do professor.
- **Decisão necessária:** usar Pion diretamente ou um SFU pronto (LiveKit, mediasoup, Janus).
- **Opções consideradas:** Pion (Go); LiveKit; mediasoup; Janus.
- **Resposta aprovada:** Pion WebRTC em Go, implementando um SFU customizado.
  - Justificativa: o backend já é Go; Pion é a biblioteca WebRTC nativa para Go; permite controle total sobre a lógica de encaminhamento e métricas; adequado para fins acadêmicos e de aprendizado.
  - Nenhum decode/encode por participante: o SFU apenas encaminha pacotes RTP.
- **Impacto:** plan, módulo `apps/backend/internal/webrtc`, dependências Go e testes de carga.

---

## C-04 — TURN

> **Supersessão (2026-11-01):** pela [ADR 0005](../../docs/adrs/0005-operacao-lan-offline.md), o modo primário é LAN offline e o TURN passa a ser **opcional**, habilitado por variável de ambiente para uso fora da rede local. Quando habilitado, as credenciais continuam efêmeras (HMAC-SHA1, 24h).

- **Contexto:** alunos acessam de redes e provedores de internet diferentes, podendo estar atrás de NAT/Firewall.
- **Decisão necessária:** uso de TURN no primeiro deploy.
- **Opções consideradas:** obrigatório; opcional; adiar.
- **Resposta aprovada:** TURN obrigatório desde o primeiro deploy de testes externos.
  - Um servidor TURN (ex: coturn) deve ser configurado junto à infraestrutura do SFU.
  - Credenciais TURN são geradas pelo backend e incluídas na resposta de join; nunca hardcoded.
  - Para testes locais (rede interna), pode ser desabilitado via variável de ambiente.
- **Impacto:** infraestrutura do servidor, contrato de sinalização (`iceServers`), configuração do WebRTC no cliente.

---

## C-05 — Estrutura do Repositório

- **Contexto:** o projeto possui três artefatos de runtime distintos (app desktop, web app, backend Go).
- **Decisão necessária:** como organizar o repositório.
- **Resposta aprovada:** Monorepo modular com Turborepo.
  - `apps/desktop/` — Electron + React (professor).
  - `apps/web/` — React + Vite (alunos).
  - `apps/backend/` — Go (API + SFU).
  - `packages/types/` — DTOs TypeScript compartilhados.
  - `packages/ui/` — Componentes React compartilhados (opcional).
- **Referência:** ADR 0001 (`docs/adrs/0001-monorepo-turborepo.md`) — APROVADA.
- **Impacto:** todos os Allowed Paths em tasks/plan usam `apps/` e `packages/`; CI usa `turbo run build test lint`.

---

## C-06 — Framework do App Desktop do Professor

- **Contexto:** o professor precisa de um app instalável para transmitir a tela e usar o microfone.
- **Decisão necessária:** framework do app desktop.
- **Opções consideradas:** Electron; Tauri; Wails.
- **Resposta aprovada:** Electron com React + TypeScript.
  - Main process: TypeScript/Node.js com `desktopCapturer`.
  - Renderer process: React + TypeScript; acessa Electron via IPC/contextBridge.
  - Build tool: `electron-vite`.
  - Distribuição: `electron-builder` (Windows `.exe`, macOS `.dmg`, Linux `.AppImage`).
- **Referência:** ADR 0002 (`docs/adrs/0002-desktop-app-framework.md`) — APROVADA.
- **Impacto:** `apps/desktop/**` adicionado como Allowed Path; CI inclui build Electron.

---

## C-07 — Metodologia do teste de carga (emenda de 2026-11-01)

- **Contexto:** `docs/load-test/load_test.go` (T020) comparava valores fixos com as metas, sem subir o SFU
  (`converge.md` §2). O dono do produto aprovou substituí-lo por um teste real (T034).
- **Resposta aprovada:**
  - O teste sobe o `SFUService` real, com a configuração de produção (faixa UDP padrão, IP físico), um publisher
    Pion que envia RTP VP8 sintético no perfil 1080p@30 (~4 Mbps) e 40 assinantes Pion. Tudo no mesmo processo; o
    tráfego passa pela pilha UDP do sistema operacional.
  - Fica em `apps/backend/internal/webrtc/` (o pacote `internal` só é importável de dentro de `apps/backend`),
    atrás da build tag `loadtest`, para não pesar no `go test ./...` do dia a dia.
  - **Mede:** FPS e bitrate recebidos por assinante, perda pós-NACK, tempo de entrada, latência de encaminhamento do
    SFU, upload do publisher, CPU/memória do processo.
  - **Não mede** (continua manual, com app e rede reais): RTT e latência ponta a ponta (RNF-08), captura/encode/decode
    (RNF-01/02 no app), CPU isolada do backend (RNF-15 — o processo de teste inclui os 41 clientes).
  - Critérios que reprovam o teste: algum assinante sem mídia, FPS mínimo < 25 ou perda ≥ 2% em algum assinante.
    Os demais números são registrados, não reprovados.
  - `docs/load-test/load_test.go` é apagado (não mede nada); `docs/load-test/README.md` aponta para o teste real.
- **Impacto:** nova task T034; T020 marcada como substituída.

---

## Resultado

CLOSED — todas as decisões C-01 a C-07 foram respondidas e aprovadas (C-07 por emenda de 2026-11-01).
A feature `001-screen-share-core` está liberada para atualização de `plan.md` e geração de tasks de implementação após T005.
