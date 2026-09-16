# MLab

<p align="center">
  <img src="MLAB-logo.png" alt="MLab Logo" width="160" />
</p>

Plataforma de transmissão de tela e áudio ao vivo voltada para ambientes educacionais, permitindo que um professor transmita sua tela para turmas com 40 ou mais alunos com baixa latência, consumo fixo de upload e distribuição via SFU (Selective Forwarding Unit).

---

## 1. Visão Geral e Arquitetura

O sistema adota uma arquitetura monorepo gerenciada com **Turborepo** e topologia de mídia WebRTC baseada em **SFU**:

```text
Professor (Desktop Electron) ────► Servidor SFU (Go / Pion) ────► Aluno 1 (Navegador Web)
                                                            ├──► Aluno 2 (Navegador Web)
                                                            ├──► ...
                                                            └──► Aluno 40+ (Navegador Web)
```

- **App Desktop (Professor):** Aplicação instalável desenvolvida em **Electron + React + Vite**. O professor realiza login, cria a sala de aula, seleciona a tela ou janela que deseja compartilhar usando APIs nativas do sistema operacional (`desktopCapturer`) e publica um único fluxo upstream de vídeo e áudio via WebRTC.
- **Backend (SFU, REST e Sinalização):** Servidor em **Go** utilizando a biblioteca **Pion WebRTC**. A SFU recebe o fluxo do professor e o repassa em memória para todos os alunos conectados, mantendo o consumo de upload do professor constante (entre 3 e 6 Mbps), independentemente da quantidade de alunos. Também gerencia sinalização via WebSocket, controle de presença, rate limit de chat (5 mensagens a cada 5 segundos) e credenciais efêmeras TURN (HMAC-SHA1).
- **App Web (Aluno):** Interface web em **React + Vite**, acessível diretamente pelo navegador sem necessidade de plugins ou extensões. O aluno acessa pelo link único do professor, informa Nome Completo e Matrícula, assiste à aula como espectador e interage pelo chat em tempo real.
- **Packages Compartilhados:** `@screenshare/types` compartilha DTOs, payloads de sinalização e interfaces TypeScript entre as aplicações.

---

## 2. Pré-requisitos do Ambiente

Para executar o projeto localmente no Windows:

1. **Node.js:** Versão 20.0.0 ou superior (com `npm` 10+).
2. **Go:** Versão 1.22 ou superior (testado e homologado com Go 1.27).
3. **Navegador Web:** Google Chrome, Microsoft Edge, Mozilla Firefox ou compatível com WebRTC.

---

## 3. Instalação e Preparação

1. Instale todas as dependências do monorepo a partir da raiz:
   ```powershell
   cd c:\Users\User\Documents\mlab
   npm install
   ```

2. Certifique-se de que o executável nativo do Electron foi baixado:
   ```powershell
   node node_modules/electron/install.js
   ```

3. Configure o diretório temporário do Go (para evitar bloqueios de execução no Windows):
   ```powershell
   $env:GOTMPDIR = "c:\Users\User\Documents\mlab\.gotmp"
   ```

---

## 4. Como Executar a Aplicação (Passo a Passo)

Para rodar o ecossistema completo em desenvolvimento, abra **3 terminais PowerShell**:

### Terminal 1 — Servidor Backend (Go)
```powershell
cd c:\Users\User\Documents\mlab\apps\backend
$env:GOTMPDIR = "c:\Users\User\Documents\mlab\.gotmp"
$env:JWT_SECRET = "dev-secret-key-12345"
go run ./cmd/server/main.go
```
> O backend inicializará na porta **`:8080`** com endpoints REST, WebSocket Hub e Pion SFU do MLab.

### Terminal 2 — App Web do Aluno (React / Vite)
```powershell
cd c:\Users\User\Documents\mlab\apps\web
npm run dev
```
> O frontend web estará acessível em **`http://localhost:5173`**.

### Terminal 3 — App Desktop do Professor (Electron)
```powershell
cd c:\Users\User\Documents\mlab\apps\desktop
npm run dev
```
> Uma janela Electron abrirá com a tela de login do professor.

---

## 5. Como Funciona a Transmissão de Tela

### Fluxo do Professor (Desktop):
1. **Login:**
   - E-mail: `professor@screenshare.local`
   - Senha: `professor123`
2. **Criação da Sala:**
   - No Dashboard, clique em **Criar Nova Sala**.
   - O sistema gera um slug amigável (ex: `alpha-bravo-1234`) e um link de convite.
   - Copie o link de convite para os alunos e clique em **Entrar na Sala como Professor**.
3. **Compartilhamento de Tela e Áudio:**
   - Na tela da sala, clique em **Compartilhar Tela**.
   - O Electron apresentará a lista de telas e janelas disponíveis (via `desktopCapturer`).
   - Selecione a janela/tela desejada.
   - O stream é enviado via WebRTC para a SFU em Go e o status muda para "Transmitindo".

### Fluxo do Aluno (Web):
1. O aluno abre no navegador o link fornecido pelo professor:
   `http://localhost:5173/sala/{slug}/entrar`
2. O aluno preenche seu **Nome Completo** e **Matrícula** e clica em **Entrar na Aula**.
3. O player WebRTC conecta-se à SFU como receptor (*subscribe-only*), exibindo o vídeo a 1080p 30 FPS e reproduzindo o áudio do microfone do professor.
4. O aluno pode alternar para tela cheia (*Fullscreen*), modo *Picture-in-Picture* (PiP) e enviar mensagens no chat em tempo real.

---

## 6. Testes Automatizados

A suíte completa conta com **38 testes automatizados** homologados com 100% de sucesso.

### Executar Todos os Testes via Turborepo:
```powershell
cd c:\Users\User\Documents\mlab
npm run test
```

### Executar Testes Unitários e de Segurança do Backend:
```powershell
cd c:\Users\User\Documents\mlab\apps\backend
$env:GOTMPDIR = "c:\Users\User\Documents\mlab\.gotmp"
go test -v -count=1 ./...
```
*Cobre: autenticação JWT (RBAC), senhas bcrypt, integridade de tokens, isolamento de salas por proprietário, rate limit do chat, credenciais TURN HMAC-SHA1, sanitização de XSS e integridade de streams no SFU Pion.*

### Executar Testes do Frontend:
```powershell
# Web (Alunos)
cd c:\Users\User\Documents\mlab\apps\web
npx vitest run

# Desktop (Professor)
cd c:\Users\User\Documents\mlab\apps\desktop
npx vitest run
```

---

## 7. Estrutura de Diretórios

```text
mlab/
├── apps/
│   ├── backend/          # Servidor Go: REST API, WebSocket Hub e SFU Pion WebRTC
│   │   ├── cmd/server/   # Ponto de entrada do backend (main.go)
│   │   └── internal/     # Módulos auth, room, signaling, webrtc, chat
│   ├── desktop/          # Aplicação Electron + React (Professor)
│   └── web/              # Aplicação React + Vite (Aluno)
├── packages/
│   ├── types/            # DTOs e tipos de sinalização compartilhados
│   └── ui/               # Componentes UI reutilizáveis
├── spec-kit(MLAB)/       # Especificações SDD, contratos e ADRs arquiteturais
├── docs/                 # Matriz de requisitos (RN/RF) e relatórios de métricas
├── package.json          # Configurações do workspace raiz
└── turbo.json            # Orquestrador de build e testes do Turborepo
```
