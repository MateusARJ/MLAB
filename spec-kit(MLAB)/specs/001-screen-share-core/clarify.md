# Clarify: Transmissão de Tela em Sala

Feature: `001-screen-share-core`
Status: CLOSED

Todas as ambiguidades bloqueantes foram resolvidas. A feature está liberada para plan e implementação.

---

## C-01 — Autenticação

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

## Resultado

CLOSED — todas as decisões C-01 a C-06 foram respondidas e aprovadas.
A feature `001-screen-share-core` está liberada para atualização de `plan.md` e geração de tasks de implementação após T005.
