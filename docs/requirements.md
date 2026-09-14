# Requisitos — ScreenShare Classroom

> **Versão:** 1.0  
> **Última atualização:** 2026-09-14  
> **Status:** Aprovado

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Atores](#2-atores)
3. [Requisitos Funcionais](#3-requisitos-funcionais)
4. [Requisitos Não Funcionais](#4-requisitos-não-funcionais)
5. [Regras de Negócio](#5-regras-de-negócio)
6. [User Stories](#6-user-stories)
7. [Estados da Sala](#7-estados-da-sala)
8. [Edge Cases](#8-edge-cases)
9. [Fora do Escopo](#9-fora-do-escopo)
10. [Critérios de Sucesso](#10-critérios-de-sucesso)

---

## 1. Visão Geral

Sistema de compartilhamento de tela e áudio focado em aulas remotas, com suporte a
turmas de **40 ou mais alunos simultâneos** sem sobrecarregar a máquina do professor.

**Arquitetura-chave:** WebRTC + SFU (Selective Forwarding Unit) implementado com
**Pion** (Go). O professor envia a tela uma única vez (~3–6 Mbps) ao servidor; o SFU
distribui para todos os alunos sem retransmissão individual e sem recodificação
(*transcoding*).

**Monorepo:** Turborepo com três apps:

| App | Tecnologia | Usuário |
|---|---|---|
| `apps/desktop` | Electron + React | Professor |
| `apps/web` | React + Vite | Aluno (navegador) |
| `apps/backend` | Go + Pion WebRTC | — |

---

## 2. Atores

### Professor
- Acessa exclusivamente via **app desktop instalável** (Windows, macOS, Linux).
- Responsável por criar salas, gerar o link de acesso, iniciar/parar a transmissão e encerrar a sala.
- Autentica-se com e-mail e senha; recebe JWT com `role: professor`.

### Aluno
- Acessa via **navegador web** (sem instalação) através do link único fornecido pelo professor.
- Identifica-se com **Nome Completo** e **Matrícula** antes de entrar.
- Apenas assiste à tela e participa do chat — não transmite vídeo nem áudio.
- Recebe JWT com `role: aluno`, `name`, `student_id` e `room_id`.

---

## 3. Requisitos Funcionais

### Autenticação e Acesso

| ID | Requisito |
|---|---|
| RF-01 | O sistema deve identificar o papel do participante (`professor` ou `aluno`) via JWT. |
| RF-12 | O professor deve se autenticar com e-mail e senha no app desktop e receber um JWT de sessão. |
| RF-11 | O aluno deve informar **Nome Completo** e **Matrícula** ao acessar o link da sala; campos vazios impedem o acesso. |
| RF-13 | O professor deve poder gerar um **link único** de acesso à sala para os alunos. |

### Transmissão de Mídia

| ID | Requisito |
|---|---|
| RF-02 | Somente o professor autenticado e dono da sala pode publicar a tela. |
| RF-03 | Alunos possuem permissão apenas de espectador — sem publicação de câmera, microfone ou tela. |
| RF-04 | A captura de tela no app desktop usa `desktopCapturer` (Electron API); o professor pode selecionar qual tela ou janela compartilhar. |
| RF-10 | O professor pode transmitir áudio do microfone junto com a tela; pode ativar/desativar o microfone durante a transmissão. |
| RF-05 | A transmissão usa **WebRTC via SFU (Pion)** — o professor publica uma única upstream de mídia (tela + áudio). |
| RF-06 | A topologia **SFU** distribui a mídia para todos os espectadores sem recodificação por espectador. |

### Sala e Sinalização

| ID | Requisito |
|---|---|
| RF-07 | O sistema sinaliza o estado da sala e da transmissão (waiting, publishing, reconnecting, closed) via WebSocket para todos os participantes. |
| RF-14 | A criação e encerramento de sala são operações REST exclusivas do professor (JWT com `role: professor`). |
| RF-15 | O encerramento da sala encerra todas as tracks de mídia e desconecta os participantes via WebSocket (`room-closed`). |

### Chat

| ID | Requisito |
|---|---|
| RF-09 | O sistema suporta **chat de texto em tempo real** via WebSocket para todos os participantes da sala (professor e alunos). |
| RF-16 | Mensagens de chat exibem o nome completo e o papel (`professor`/`aluno`) do remetente. |
| RF-17 | Mensagens em branco são descartadas pelo servidor; o timestamp é gerado pelo servidor (nunca pelo cliente). |

### Reconexão

| ID | Requisito |
|---|---|
| RF-08 | O sistema coleta e expõe métricas mínimas de sessão: FPS, bitrate, RTT, perda de pacotes, tempo até primeiro frame. |
| RF-18 | Perda de conexão do **professor** dispara estado `reconnecting` para os alunos; o servidor aguarda **30 segundos** antes de encerrar a sala. |
| RF-19 | Perda de conexão do **aluno** é tratada com backoff exponencial no cliente (1 → 2 → 4 → … → máx 30 s); o aluno rejunta com o mesmo JWT (se válido). |

---

## 4. Requisitos Não Funcionais

| ID | Categoria | Requisito |
|---|---|---|
| RNF-01 | Qualidade de vídeo | Resolução alvo de **até 1920×1080 (Full HD)**. |
| RNF-02 | Qualidade de vídeo | Taxa de quadros alvo de **30 FPS** no cenário principal de aula. |
| RNF-03 | Escalabilidade | A arquitetura deve suportar e ser validada com **pelo menos 40 espectadores simultâneos** por sala (limite configurável; padrão: 50). |
| RNF-04 | Observabilidade | A sessão deve expor **bitrate, FPS, RTT e packet loss** para diagnóstico de qualidade. |
| RNF-05 | Segurança | Nenhum segredo (JWT secret, credenciais TURN) deve ser exposto ao cliente além do estritamente necessário. Comunicação obrigatoriamente **HTTPS/WSS** em produção. |
| RNF-06 | Responsividade | O web app dos alunos deve ser **responsivo**: desktop-first (≥1280 px) e mobile funcional (<768 px). |
| RNF-07 | Distribuição | O app desktop deve ser distribuível para **Windows, macOS e Linux** (electron-builder). |
| RNF-08 | Latência | Latência ponta a ponta alvo: **< 500 ms** em redes com RTT razoável (< 100 ms). |
| RNF-09 | Banda do professor | Upload do professor para o SFU: **3–6 Mbps** independente do número de alunos. |
| RNF-10 | Tecnologias | Backend: **Go 1.22+** com Pion WebRTC. Frontend: **TypeScript + React**. Banco: **PostgreSQL**. |
| RNF-11 | Controle de versão | Todo o projeto deve ser versionado via **Git** (monorepo). |
| RNF-12 | Infraestrutura | Requer servidor TURN externo (coturn) para ambientes com NAT/firewall. |

---

## 5. Regras de Negócio

### Autenticação e Autorização

| ID | Regra |
|---|---|
| RN-01 | Um JWT de professor (`role: professor`) é emitido **somente** após validação de e-mail e senha com bcrypt. |
| RN-02 | Um JWT de aluno (`role: aluno`) é emitido **somente** após o aluno fornecer Nome Completo e Matrícula não-vazios numa sala existente e não-encerrada. |
| RN-03 | O JWT de professor tem validade de **8 horas** (configurável via `PROFESSOR_TOKEN_TTL_H`). |
| RN-04 | O JWT de aluno tem validade de **6 horas** (configurável via `STUDENT_TOKEN_TTL_H`). |
| RN-05 | Apenas o **dono da sala** (campo `owner_id`) pode obter o link e encerrar a sala — outro professor não pode gerenciar salas alheias. |
| RN-06 | O JWT de aluno carrega `room_id`; o servidor valida que o token pertence à sala que o aluno tenta acessar via WebSocket. |

### Sala

| ID | Regra |
|---|---|
| RN-07 | Cada sala possui um **slug legível e único** (ex: `charlie-delta-7342`) gerado aleatoriamente no momento da criação. |
| RN-08 | O limite padrão de participantes por sala é **50** (configurável; máx absoluto: 200). Aluno acima do limite recebe `429 Participant limit reached`. |
| RN-09 | Uma sala encerrada (`status: closed`) não aceita novos participantes (`409 Room closed`). |
| RN-10 | Somente **um professor** pode publicar mídia por sala ao mesmo tempo. Uma segunda tentativa de `publish-request` de outro participante é rejeitada com `FORBIDDEN`. |

### Transmissão / WebRTC

| ID | Regra |
|---|---|
| RN-11 | O professor publica **uma única upstream** (tela + áudio) para o SFU; o SFU distribui para todos os alunos sem upstream individual por aluno. |
| RN-12 | O áudio do professor é transmitido como **track separada** do vídeo, permitindo mute independente. |
| RN-13 | Credenciais TURN são **temporárias** (válidas por 24 horas), geradas no momento do `ice-servers`, usando HMAC-SHA1 sobre o `TURN_SECRET` da ENV. Nunca hardcoded. |

### Reconexão

| ID | Regra |
|---|---|
| RN-14 | Ao detectar desconexão do professor, o servidor aguarda **30 segundos** (`PUBLISHER_RECONNECT_TIMEOUT_S`) antes de encerrar a sala. Durante esse período, os alunos recebem `session-state: reconnecting`. |
| RN-15 | Se o professor reconectar dentro do timeout de 30 s, o timer é cancelado e a transmissão retoma sem criar nova sala. |
| RN-16 | Se o timeout expirar, o servidor emite `room-closed` para todos os alunos e destrói as tracks no SFU. |
| RN-17 | O aluno que perde conexão tenta reconectar com **backoff exponencial** (1 s → 2 s → 4 s → … → máx 30 s). |
| RN-18 | Se o JWT do aluno expirou ao tentar reconectar, ele é redirecionado para a página de identificação **sem recriar a sala**. |

### Chat

| ID | Regra |
|---|---|
| RN-19 | O **rate limit de chat** é aplicado server-side por participante: máx **5 mensagens/5 segundos** e **30 mensagens/minuto**. |
| RN-20 | Violação do rate limit resulta em `error: { code: "CHAT_RATE_LIMITED" }` — o participante **não é desconectado**. |
| RN-21 | Mensagens em branco (conteúdo vazio após trim) são descartadas silenciosamente pelo servidor. |
| RN-22 | O **timestamp** das mensagens de chat é gerado pelo servidor (`sent_at`) — nunca pelo cliente. |
| RN-23 | O chat não possui histórico na versão inicial: alunos que entram na sala não recebem mensagens anteriores. |

---

## 6. User Stories

### US-01 — Login do professor

> **Como** professor, **quero** fazer login no app desktop, **para** acessar minhas salas.

**Critérios de aceitação:**
- O professor informa e-mail e senha no app.
- O backend valida e emite JWT com `role: professor`.
- A sessão é armazenada de forma segura (não em `localStorage` exposto).
- Logout encerra a sessão e invalida o token localmente.

---

### US-02 — Criar sala e gerar link único

> **Como** professor, **quero** criar uma sala e obter um link único, **para** compartilhar com os alunos.

**Critérios de aceitação:**
- Ao criar a sala, o professor recebe um slug único e um link de acesso (ex: `https://.../sala/charlie-delta-7342/entrar`).
- A sala inicia em estado `waiting`.
- O professor pode copiar o link com um clique.

---

### US-03 — Iniciar compartilhamento de tela e áudio

> **Como** professor, **quero** selecionar minha tela/janela e iniciar a transmissão com áudio, **para** que os alunos possam acompanhar a aula.

**Critérios de aceitação:**
- O app usa `desktopCapturer` para capturar a tela selecionada.
- O professor pode ativar/desativar o microfone durante a transmissão.
- Tela e áudio seguem pelo mesmo fluxo WebRTC.
- O professor pode interromper a transmissão a qualquer momento.

---

### US-04 — Identificação do aluno e entrada na sala

> **Como** aluno, **quero** inserir meu Nome Completo e Matrícula ao acessar o link, **para** ser identificado na sala e no chat.

**Critérios de aceitação:**
- A página solicita Nome Completo e Matrícula antes de exibir a transmissão.
- Campos vazios bloqueiam o acesso.
- O nome e matrícula aparecem no chat ao lado das mensagens.

---

### US-05 — Assistir à transmissão

> **Como** aluno, **quero** entrar na sala e assistir à tela do professor, **para** acompanhar a aula em tempo real.

**Critérios de aceitação:**
- Alunos entram sem publicar câmera/microfone.
- A transmissão ativa é exibida sem atualização manual.
- O áudio é reproduzido automaticamente (respeitando políticas do navegador).
- O encerramento da transmissão é refletido para os alunos.

---

### US-06 — Escala da sala (40+ alunos)

> **Como** professor, **quero** transmitir para 40 ou mais alunos **sem** sobrecarregar minha máquina.

**Critérios de aceitação:**
- A arquitetura usa SFU (Pion WebRTC).
- O professor publica uma única upstream de mídia.
- O SFU distribui para todos os espectadores.
- Limite operacional inicial: 50 participantes por sala.

---

### US-07 — Chat de texto em tempo real

> **Como** participante, **quero** enviar e receber mensagens na sala, **para** comunicar dúvidas sem interromper a transmissão.

**Critérios de aceitação:**
- Todos os participantes (professor e alunos) podem enviar e receber mensagens.
- Mensagens exibem nome e papel (`professor`/`aluno`) do remetente.
- Mensagens chegam em tempo real via WebSocket.
- Rate limit de 5 msgs/5 s e 30 msgs/min aplicado server-side.

---

### US-08 — Recuperação de conexão

> **Como** aluno/professor, **quero** que uma perda temporária de conexão seja tratada sem quebrar a sala.

**Critérios de aceitação:**
- O cliente exibe indicador de reconexão.
- Aluno reconecta automaticamente com backoff exponencial.
- Professor tem até 30 s para reconectar; após isso, a sala é encerrada para os alunos.

---

## 7. Estados da Sala

| Estado | Evento que ativa | Comportamento esperado |
|---|---|---|
| `waiting` | Sala criada, professor ainda não publicou | Aluno vê tela de espera |
| `publishing` | Professor enviou `publish-request` e publicou offer | Alunos recebem mídia e áudio |
| `reconnecting` | Professor perdeu conexão | Alunos recebem banner; SFU aguarda 30 s |
| `closed` | Professor encerrou via REST ou timeout de 30 s | Alunos recebem `room-closed`; acesso à mídia encerrado |

### Transições de estado (Professor)

```
waiting ──► publishing ──► reconnecting ──► publishing  (reconectou)
                                        └──► closed      (timeout 30 s)
         └──────────────────────────────────► closed      (POST /close)
```

---

## 8. Edge Cases

| # | Situação | Comportamento esperado |
|---|---|---|
| EC-01 | Professor cancela o diálogo de seleção de tela | App retorna ao Dashboard sem iniciar transmissão |
| EC-02 | Professor fecha a janela que estava sendo compartilhada | Track de vídeo encerra; professor pode selecionar outra janela |
| EC-03 | Professor desativa o microfone durante a transmissão | Track de áudio é pausada (muted); vídeo continua |
| EC-04 | Aluno entra antes do professor iniciar | Aluno aguarda em estado `waiting` |
| EC-05 | Aluno entra durante a transmissão ativa | Aluno recebe `session-state: publishing` e inicia assinatura imediatamente |
| EC-06 | Professor perde conectividade | `reconnecting` por 30 s → `closed` se não reconectar |
| EC-07 | Aluno perde conectividade | Backoff exponencial; rejunta se JWT válido |
| EC-08 | Aluno com JWT expirado ao reconectar | Redireciona para página de identificação (sem recriar sala) |
| EC-09 | Dois usuários tentam `publish-request` | Segundo recebe `FORBIDDEN` |
| EC-10 | Sala atinge o limite (50 por padrão) | Novo aluno recebe `429 Participant limit reached` |
| EC-11 | Token inválido ou expirado no WebSocket | Conexão recusada com `401` no upgrade HTTP |
| EC-12 | Aluno tenta entrar com campos vazios | `400 Bad Request` com mensagem clara |
| EC-13 | Link inválido ou sala encerrada | `404 Room not found` ou `409 Room closed` |
| EC-14 | Mensagem de chat em branco | Descartada silenciosamente pelo servidor |
| EC-15 | Participante ultrapassa rate limit do chat | Recebe `CHAT_RATE_LIMITED`; não é desconectado |

---

## 9. Fora do Escopo (v1.0)

- Câmera do professor ou dos alunos.
- Microfone dos alunos.
- Gravação das aulas no servidor.
- Upload de arquivos ou apresentações.
- Transcodificação por espectador.
- Integração com banco de dados oficial da instituição.
- Histórico de mensagens de chat.
- Painel administrativo completo.
- Múltiplos professores publicando ao mesmo tempo na mesma sala.

---

## 10. Critérios de Sucesso

| # | Critério |
|---|---|
| CS-01 | Uma sala com **40+ espectadores** recebe tela e áudio de um único professor. |
| CS-02 | O professor faz **um único upstream** (~3–6 Mbps) para o SFU independente do número de alunos. |
| CS-03 | Alvo operacional de **1080p/30 FPS** é mensurável em rede com RTT < 100 ms. |
| CS-04 | Métricas (bitrate, FPS, RTT, packet loss) permitem identificar degradação de qualidade. |
| CS-05 | Interrupção da captura encerra a publicação sem deixar track órfã no SFU. |
| CS-06 | Alunos entram via link único, se identificam e assistem **sem instalação de software**. |
| CS-07 | Chat entrega mensagens em tempo real para todos os participantes da sala. |
| CS-08 | Perda de conexão do professor é tratada com até 30 s de tolerância antes de encerrar a sala. |

---

## Referências

- [`spec-kit(MLAB)/specs/001-screen-share-core/spec.md`](../spec-kit(MLAB)/specs/001-screen-share-core/spec.md) — especificação detalhada
- [`spec-kit(MLAB)/specs/001-screen-share-core/contracts/`](../spec-kit(MLAB)/specs/001-screen-share-core/contracts/) — contratos de API e WebSocket
- [`spec-kit(MLAB)/specs/001-screen-share-core/plan.md`](../spec-kit(MLAB)/specs/001-screen-share-core/plan.md) — plano de arquitetura e decisões técnicas
