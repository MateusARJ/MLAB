# MLab

<p align="center">
  <img src="MLAB-logo.png" alt="MLab Logo" width="200" />
</p>

Plataforma de transmissão de tela e áudio ao vivo voltada para ambientes educacionais, permitindo que um professor transmita sua tela para turmas com 40 ou mais alunos com ultrabaixa latência (< 500 ms), consumo fixo de upload e distribuição escalável via SFU (Selective Forwarding Unit).

---

## 1. Visão Geral e Arquitetura

O sistema adota uma arquitetura monorepo gerenciada com **Turborepo** e topologia de mídia WebRTC baseada em **SFU (Selective Forwarding Unit)**:

```text
Professor (Desktop Electron) ────► Servidor SFU (Go / Pion) ────► Aluno 1 (Navegador Web)
                                                            ├──► Aluno 2 (Navegador Web)
                                                            ├──► ...
                                                            └──► Aluno 40+ (Navegador Web)
```

- **App Desktop (Professor):** Aplicação instalável desenvolvida em **Electron + React + TypeScript + Vite**. O professor realiza login, cria a sala de aula, escolhe a fonte de captura (tela inteira ou janela específica via `desktopCapturer`), seleciona a resolução e taxa de quadros (1080p @ 30fps ou 1080p @ 60fps), inicia a transmissão upstream via WebRTC, pode gravar a aula localmente em 1080p com correção de metadados WebM, compartilhar arquivos, gerenciar dúvidas privadas e alterar fontes dinamicamente sem interromper a transmissão.
- **Backend (SFU, REST e Sinalização):** Servidor em **Go** utilizando a biblioteca **Pion WebRTC**. A SFU recebe o fluxo do professor e o repassa em memória para todos os alunos conectados, mantendo o consumo de upload do professor constante (entre 4 e 6 Mbps), independentemente da quantidade de alunos. Inclui WebSocket Hub thread-safe, Keyframe Controller com agendamento inteligente de RTCP PLI para evitar sobrecarga no encoder e eliminar telas pretas, persistência em memória do histórico de chat e arquivos da sessão, rate limit de chat (5 mensagens a cada 5 segundos) e credenciais efêmeras TURN (HMAC-SHA1).
- **App Web (Aluno):** Interface web moderna em **React + Vite** (porta **`:3000`**), acessível diretamente por qualquer navegador moderno (desktop e mobile) sem necessidade de plugins. O aluno acessa pelo link único da sala, informa Nome Completo e Matrícula, assiste à aula instantaneamente (mesmo se entrar antes do professor iniciar a transmissão, sem necessidade de F5), baixa arquivos compartilhados pelo professor e interage pelo chat público da turma ou dúvidas privadas.
- **Packages Compartilhados:** `@mlab/types` compartilha DTOs, payloads de sinalização e interfaces TypeScript entre todas as aplicações; `@mlab/ui` provê componentes visuais reutilizáveis.

---

## 2. Diferenciais Técnicos e Funcionalidades Recentes

### 📺 Perfis de Resolução e Qualidade (1080p 30fps e 60fps)
Na tela de setup da sala, o professor pode selecionar o perfil ideal para a aula:
- **📺 1080p Full HD @ 30 fps (4.0 Mbps):** Otimizado para máxima nitidez de leitura em textos, slides e código-fonte, com menor consumo de rede.
- **🚀 1080p Full HD @ 60 fps (6.0 Mbps):** Máxima fluidez para vídeos, animações e simulações com 60 quadros por segundo contínuos.
- **Nitidez Permanente:** Diretivas `contentHint = 'detail'` e `degradationPreference = 'maintain-resolution'` ativas, impedindo o rebaixamento espacial de resolução para manter linhas de código e textos 100% nítidos.

### 🛡️ Keyframe Controller Não-Destrutivo (Zero Travamentos e Zero Tela Preta)
- **Eliminação de Sobrecarga no Encoder:** Remoção do envio em rajadas periódicas contínuas que forçava o encoder Chromium a descartar quadros (*frame skipping* severo).
- **Agendamento Inteligente (`pendingPLI`):** Se um pedido de RTCP PLI chegar dentro da janela de cooldown (1.2s), ele não é descartado: o SFU agenda o disparo para o momento exato em que o cooldown termina, garantindo que **100% dos novos alunos recebam o IDR frame inicial** e eliminando telas pretas.
- **Liveness Keyframe Espaçado:** Ticker seguro a cada 8 segundos que assegura recuperação automática da transmissão em redes com perda transitória de pacotes.
- **REMB Ampliado:** Teto de REMB do SFU configurado para 8 Mbps para dar vazão plena a 60 fps sem estrangulamento.

### 🚀 Conexão Instantânea e Sincronização sem F5
- **Espera Amigável:** O aluno pode acessar o link da sala antes do professor iniciar a transmissão, acompanhando o status na tela de espera.
- **Início Automático:** Quando o professor clica em iniciar a aula, o sinal `stream-started` é disparado e todos os alunos conectados recebem o vídeo automaticamente, sem necessidade de atualizar a página (F5).
- **Reset de Faixas Órfãs:** O player do aluno descarta faixas encerradas (`readyState === 'ended'`) para evitar que conexões antigas interfiram na reprodução.
- **Encerramento Sincronizado:** Se o professor encerrar a aula ou fechar o aplicativo desktop, todos os alunos são imediatamente notificados e redirecionados para o início com aviso claro.

### 💬 Chat e Arquivos Persistentes na Transmissão
- **Histórico Automático da Sessão:** Mensagens do chat público e arquivos compartilhados pelo professor ficam salvos na memória da sessão do Hub. Alunos que entram durante a aula recebem todo o histórico imediatamente (`chat-history` e `files-history`).
- **Isolamento de Canais:** Separação estrita entre o formulário do **Chat da Turma** (público) e **Dúvidas Privadas** (confidencial aluno-professor).

### ⚡ Troca Dinâmica de Modo e Fonte (`replaceTrack`)
O professor pode alterar o modo de transmissão ("Tela Inteira" ou "Janela do Aplicativo") e escolher outra janela ou tela a qualquer momento durante a aula ao vivo.
- A aplicação utiliza `RTCRtpSender.replaceTrack` para atualizar o fluxo de vídeo mantendo a mesma conexão WebRTC ativa (sem quedas ou necessidade de renegociação SDP).
- O backend SFU reaproveita a mesma instância de `TrackLocalStaticRTP`, encaminhando os pacotes RTP para os alunos de forma ininterrupta.

### 🎥 Gravação Local em 1080p com Correção de Duração EBML
- Permite gravar a aula diretamente no computador do professor em formato WebM 1080p via `MediaRecorder`.
- Corrige a limitação nativa do formato WebM gerado por navegadores/Electron (onde o cabeçalho não possui duração, impedindo o seek e a barra de progresso) através da injeção de metadados EBML (`Duration`) diretamente no blob antes do salvamento.
- Arquivo final 100% navegável e compatível com reprodutores de vídeo como VLC, Windows Media Player e navegadores web.

### 🔊 Resiliência a Políticas de Autoplay de Áudio
- Tratamento nativo para restrições de reprodução de áudio dos navegadores (Autoplay Policy).
- Caso o navegador do aluno bloqueie o som por falta de interação prévia, o vídeo continua tocando e um banner elegante é exibido permitindo desmutar o áudio com um clique ("Clique para ativar o áudio").

---

## 3. Pré-requisitos do Ambiente

Para executar o projeto localmente:

1. **Node.js:** Versão 20.0.0 ou superior (com `npm` 10+).
2. **Go:** Versão 1.22 ou superior (testado e homologado com Go 1.24/1.27).
3. **Sistema Operacional:** Windows 10/11, macOS ou Linux.
4. **Navegador Web:** Google Chrome, Microsoft Edge, Mozilla Firefox ou compatível com WebRTC.

---

## 4. Instalação e Preparação

1. Instale todas as dependências do monorepo a partir da raiz:
   ```powershell
   cd c:\Users\User\Documents\mlab
   npm install
   ```

2. Certifique-se de que os binários nativos do Electron foram instalados:
   ```powershell
   node node_modules/electron/install.js
   ```

3. No Windows, configure o diretório temporário do Go (para evitar bloqueios de antivírus ou permissão):
   ```powershell
   $env:GOTMPDIR = "c:\Users\User\Documents\mlab\.gotmp"
   ```

---

## 5. Como Executar a Aplicação

### Opção A: Execução Unificada via Turborepo (Recomendado)
A partir da raiz do monorepo, inicie todos os serviços simultaneamente:
```powershell
npm run dev
```

---

### Opção B: Execução em Terminais Separados

Caso deseje acompanhar os logs de cada serviço de forma isolada, abra **3 terminais PowerShell**:

#### Terminal 1 — Servidor Backend (Go)
```powershell
cd c:\Users\User\Documents\mlab\apps\backend
$env:GOTMPDIR = "c:\Users\User\Documents\mlab\.gotmp"
$env:JWT_SECRET = "dev-secret-key-12345"
go run ./cmd/server/main.go
```
> O backend inicializará na porta **`:8080`** provendo REST API, WebSocket Hub e a SFU Pion WebRTC.

#### Terminal 2 — App Web do Aluno (React / Vite)
```powershell
cd c:\Users\User\Documents\mlab\apps\web
npm run dev
```
> O frontend do aluno estará acessível em **`http://localhost:3000`** (com proxy configurado para o backend na `:8080`).

#### Terminal 3 — App Desktop do Professor (Electron)
```powershell
cd c:\Users\User\Documents\mlab\apps\desktop
npm run dev
```
> A janela do Electron abrirá pronta para o login e gerenciamento de aulas do professor.

---

## 6. Como Buildar e Empacotar o Aplicativo (Build & Distribuição)

O projeto possui scripts automatizados para compilar e empacotar cada componente da plataforma.

### 6.1 Build Multiplataforma do App Desktop do Professor (Windows, macOS e Linux)

O aplicativo do professor é empacotado através do **`electron-builder`** integrado ao **`electron-vite`**, com suporte oficial às três principais plataformas:

#### 🪟 No Windows:
Gera o instalador NSIS e a versão portátil:
```powershell
cd c:\Users\User\Documents\mlab\apps\desktop
npm run make
```
* **Instalador NSIS:** `dist/MLab Setup 1.4.8.exe`
* **Versão Portátil:** `dist/win-unpacked/MLab.exe`

#### 🍏 No macOS:
Em uma máquina com macOS (Intel ou Apple Silicon M1/M2/M3):
```bash
cd apps/desktop
npm run build
npx electron-builder --mac
```
* **Imagem de Disco:** `dist/MLab-1.4.8.dmg` (arrastar para Aplicativos)
* **Arquivo Compactado:** `dist/MLab-1.4.8-mac.zip`

#### 🐧 No Linux:
Em uma máquina Linux (Ubuntu, Debian, Fedora, Arch) ou via WSL2:
```bash
cd apps/desktop
npm run build
npx electron-builder --linux AppImage deb
```
* **Executável Universal:** `dist/MLab-1.4.8.AppImage` (basta dar permissão `chmod +x` e rodar)
* **Pacote Debian/Ubuntu:** `dist/MLab_1.4.8_amd64.deb` (`sudo dpkg -i ...`)

---

### 6.2 Build Automático na Nuvem via GitHub Actions (Windows + Mac + Linux de uma vez)

Como o macOS exige ferramentas nativas da Apple (`hdiutil`) para gerar o arquivo `.dmg`, o repositório já inclui um fluxo de automação em [`.github/workflows/build-all.yml`](.github/workflows/build-all.yml).

Sempre que você subir o código para o GitHub:
1. Vá até a aba **Actions** no GitHub.
2. Selecione **Build & Release Multiplataforma** e clique em **Run workflow**.
3. O GitHub compilará os três instaladores simultaneamente em máquinas Windows, Mac e Linux na nuvem.
4. Ao final, você baixa os instaladores prontos (`.exe`, `.dmg`, `.AppImage` e `.deb`) diretamente da aba **Artifacts** para disponibilizar aos professores.

---

### 6.3 Build do Backend (Servidor Go SFU)

Para gerar o binário de produção do servidor:

```powershell
cd c:\Users\User\Documents\mlab\apps\backend
npm run build
```
*(Ou diretamente: `go build -o ./bin/server.exe ./cmd/server`)*

> O executável compilado de alta performance será gerado em **`apps/backend/bin/server.exe`**.

---

### 6.4 Build do Web App dos Alunos (React / Vite)

Para compilar o frontend dos alunos para produção:

```powershell
cd c:\Users\User\Documents\mlab\apps\web
npm run build
```

> Os arquivos estáticos otimizados (HTML, CSS e JS) serão gerados na pasta **`apps/web/dist/`**, prontos para hospedagem em qualquer servidor web ou CDN.

---

### 6.5 Build Unificado de Todo o Monorepo

Para compilar todos os pacotes e aplicações de uma só vez aproveitando o cache do Turborepo:

```powershell
npm run build
```

---

## 7. Fluxo de Uso e Transmissão

### Fluxo do Professor (Desktop):
1. **Login:**
   - **E-mail:** `professor@screenshare.local`
   - **Senha:** `professor123`
2. **Criação da Sala:**
   - No Dashboard, clique em **Criar Nova Sala**.
   - Copie o link de convite dos alunos (ex: `http://localhost:3000/sala/alpha-bravo-1234/entrar`).
   - Clique em **Entrar na Sala como Professor**.
3. **Configuração e Transmissão:**
   - **1. Gravação:** Escolha se deseja gravar a aula localmente (`.webm`).
   - **2. Captura:** Escolha o modo de captura: **Tela Inteira** ou **Janela / Aba Específica**.
   - **3. Resolução e Qualidade:** Selecione entre **1080p @ 30 fps** (padrão nítido) ou **1080p @ 60 fps** (alta fluidez).
   - Clique em **Avançar e Iniciar Transmissão**.
4. **Durante a Aula:**
   - **Troca de Fonte:** Clique em **Alterar Modo / Fonte** no painel do professor para trocar de tela/janela sem quedas.
   - **Compartilhar Arquivos:** Envie materiais pela gaveta de arquivos.
   - **Dúvidas Privadas:** Responda alunos individualmente com total sigilo em relação à turma.
   - **Microfone:** Controle o mute/unmute com processamento anti-microfonia.

### Fluxo do Aluno (Web):
1. O aluno acessa no navegador o link fornecido pelo professor:
   `http://localhost:3000/sala/{slug}/entrar`
2. Preenche seu **Nome Completo** e **Matrícula** e clica em **Entrar na Aula**.
3. **Entrada Antes do Início:** O aluno vê a mensagem amigável de espera e recebe o vídeo automaticamente assim que o professor inicia, sem precisar recarregar (zero F5).
4. **Durante a Aula:**
   - Visualiza a tela nítida em tempo real.
   - Acessa o histórico completo do chat da turma e arquivos compartilhados.
   - Envia dúvidas privadas para o professor ou participa do chat geral.
   - Utiliza os controles de **Tela Cheia (Fullscreen)** e **Picture-in-Picture (PiP)**.

---

## 8. Testes Automatizados e Qualidade

A aplicação conta com uma ampla suíte de **70 testes automatizados**, cobrindo o backend em Go, a aplicação desktop e o frontend web:

### Executar Todos os Testes:
```powershell
npm run test
```

### Detalhamento da Cobertura:
- **Backend Go (5 pacotes / 13 testes):**
  - `auth`: Autenticação JWT, geração e validação de tokens, criptografia bcrypt de senhas.
  - `chat`: Rate limit de mensagens (5 msgs / 5s), sanitização contra XSS e persistência em memória.
  - `room`: Criação, isolamento de salas por proprietário e expiração.
  - `signaling`: WebSocket Hub thread-safe, concorrência de mensagens, broadcast de arquivos e histórico.
  - `webrtc`: Pipeline SFU Pion, criação de PeerConnections, Keyframe Controller com agendamento inteligente (`pendingPLI`), liveness ticker e isolamento entre salas.
- **App Desktop Electron (7 arquivos / 37 testes Vitest):**
  - `Room.test.tsx`: Setup guiado, seleção de qualidade (1080p 30fps e 60fps), gravação local WebM, troca dinâmica de fontes, isolamento de chats público e privado, e prevenção de microfonia local.
  - `useScreenCapture.test.ts`: Supressão de realimentação acústica (DSP anti-microfonia), captura flexível e constraints de taxa de quadros (30/60 fps).
  - `webmFixer.test.ts`: Parser de tags EBML e injeção de duração em vídeos WebM.
  - `Permissions.test.tsx`: Verificação de permissões do sistema operacional e fluxo de concessão.
  - `Dashboard.test.tsx`: Listagem e criação de salas pelo professor.
  - `Login.test.tsx`: Validação de credenciais e controle de sessão do professor.
  - `ProfessorEntry.test.tsx`: Fluxo de entrada do professor na sala.
- **App Web Aluno (3 arquivos / 20 testes Vitest):**
  - `useWebRTCSubscriber.test.ts`: Handshake WebRTC com SFU, auto-reconexão sem F5 ao receber `stream-started`, solicitação de Keyframe imediato, recepção de histórico de mensagens e arquivos.
  - `Join.test.tsx`: Validação de campos obrigatórios (Nome e Matrícula) e redirecionamento de rotas.
  - `Room.test.tsx`: Conexão WebRTC de assinante, manipulação de Autoplay Policy, layout responsivo e controles do player.

---

## 9. Estrutura de Diretórios

```text
mlab/
├── apps/
│   ├── backend/          # Servidor Go: REST API, WebSocket Hub e SFU Pion WebRTC
│   │   ├── cmd/server/   # Ponto de entrada do backend (main.go)
│   │   └── internal/     # Módulos auth, chat, room, signaling, webrtc
│   ├── desktop/          # Aplicação Electron + React (Professor)
│   │   ├── src/main/     # Processo principal do Electron e handlers IPC
│   │   ├── src/preload/  # Bridge segura de APIs nativas para o renderer
│   │   └── src/renderer/ # Interface React, captura de mídia (30/60fps), WebM fixer e chat
│   └── web/              # Aplicação React + Vite na porta 3000 (Aluno)
│       ├── src/hooks/    # Hook WebRTC subscriber com auto-keyframe e sync sem F5
│       └── src/pages/    # Páginas de entrada (Join) e sala de aula (Room)
├── packages/
│   ├── types/            # Tipos TypeScript, DTOs e contratos de sinalização
│   └── ui/               # Componentes de interface compartilhados
├── spec-kit(MLAB)/       # Especificações de requisitos, arquitetura e ADRs
├── docs/                 # Documentações complementares e relatórios
├── MLAB-logo.png         # Logotipo oficial do MLab
├── package.json          # Orquestração do workspace raiz
└── turbo.json            # Configuração de pipelines do Turborepo
```

---

## 📄 Licença

Este projeto é desenvolvido para uso educacional e corporativo sob licença proprietária/MIT conforme especificado pelos mantenedores.
