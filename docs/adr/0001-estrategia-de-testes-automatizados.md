# ADR 0001: Estratégia de Testes Automatizados no Monorepo

* **Status:** Aceito
* **Data:** 2026-09-14
* **Autores:** Antigravity AI & Equipe de Engenharia
* **Componentes Impactados:** `apps/backend`, `apps/desktop`, `apps/web`, `packages/types`

---

## 1. Contexto

O projeto ScreenShare Classroom é composto por um monorepo contendo um backend em Go (com sinalização WebSocket e SFU Pion WebRTC), um aplicativo desktop em Electron + React (para o professor) e uma aplicação web em React + Vite (para os alunos).

Para manter uma alta velocidade de desenvolvimento e prevenir regressões durante a evolução do sistema, é necessário estabelecer uma estratégia clara de testes automatizados unitários e de integração que possa ser executada em milissegundos sem depender de infraestrutura externa (banco de dados ativo, servidores TURN ou dispositivos de mídia reais).

---

## 2. Decisão

Decidimos adotar uma estratégia de testes automatizados pragmática, co-localizada e orientada a stubs/mocks, dividida em quatro camadas principais:

### 2.1. Backend Go (`apps/backend`)

- **Ferramentas:** Pacote nativo `testing` do Go + `net/http/httptest` + `gorilla/websocket`.
- **Testes Unitários:** Testar funções puras, gerador de slugs, validação de tokens JWT e serviços de sala diretamente em arquivos `*_test.go` co-localizados nos pacotes `auth`, `room`, `chat` e `webrtc`.
- **Testes de Integração de Sinalização:** Utilizar `httptest.NewServer` com upgrade de WebSocket para simular handshakes, troca de mensagens SDP/ICE, gerenciamento de Hubs e reconexão.
- **Mocks do WebRTC:** Mocar as `PeerConnection` e `TrackLocalStaticRTP` do Pion para testar o repasse de mídia em memória sem alocar interfaces físicas de rede.

### 2.2. Frontend Web (`apps/web`)

- **Ferramentas:** Vitest + React Testing Library + jsdom.
- **Testes de Componente e Rota:** Testar formulário de entrada (`Join.test.tsx`), tratamento de erro de Autoplay Policy e botões de Fullscreen/PiP.
- **Mocks de APIs do Navegador:** Mocar `navigator.mediaDevices.getUserMedia`, `RTCPeerConnection` e `WebSocket` global no ambiente jsdom.

### 2.3. Frontend Desktop (`apps/desktop`)

- **Ferramentas:** Vitest + React Testing Library.
- **Testes de Componente e IPC:** Testar telas de Login, Dashboard e Room.
- **Mocks do Electron:** Mocar as APIs expostas pelo `contextBridge` (`desktopCapturer.getSources`, `systemPreferences.getMediaAccessStatus`).

### 2.4. Execução Contínua e Performance dos Testes

- Todos os testes devem rodar em ambiente totalmente isolado e offline.
- Tempo limite de execução (SLA):
  - Backend Go: `< 2 segundos` (`go test ./...`)
  - Frontends: `< 3 segundos` (`npm run test`)

---

## 3. Consequências

### Positivas
- **Velocidade de Feedback:** Desenvolvedores recebem confirmação imediata da integridade do código em poucos segundos.
- **Zero Flakiness:** Testes sem dependência de hardware real ou conectividade externa não falham por instabilidade de rede.
- **Fácil Integração em CI/CD:** Os testes podem ser executados nativamente em qualquer runner de CI (GitHub Actions).

### Mitigações
- Para validar a escala real de 40+ espectadores simultâneos, uma suíte de testes de carga sintética separada é mantida na tarefa T020 (`docs/load-test/`), sem bloquear os testes unitários diários.
