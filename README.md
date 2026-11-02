# MLab

<p align="center">
  <img src="MLAB-logo.png" alt="MLab Logo" width="220" />
</p>

<p align="center">
  <strong>Transmissão de tela e áudio em rede local para salas de aula e laboratórios de informática</strong><br />
  Alta fidelidade em 1080p (30/60 fps), baixa latência, 100% offline e sem necessidade de internet.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Go-1.26+-00ADD8?style=flat&logo=go&logoColor=white" alt="Go" />
  <img src="https://img.shields.io/badge/WebRTC-Pion-orange?style=flat&logo=webrtc&logoColor=white" alt="WebRTC" />
  <img src="https://img.shields.io/badge/Electron-Desktop-47848F?style=flat&logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Vite-Fast-646CFF?style=flat&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Carbon_Design-IBM-0f62fe?style=flat&logo=ibm&logoColor=white" alt="IBM Carbon" />
  <img src="https://img.shields.io/badge/Methodology-SDD_%26_AI-7c3aed?style=flat" alt="SDD" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License" />
</p>

---

## Sumário

- [O Problema](#o-problema)
- [O Objetivo](#o-objetivo)
- [Como Funciona](#como-funciona)
- [Funcionalidades](#funcionalidades)
- [Requisitos do Sistema](#requisitos-do-sistema)
- [Instalação para Uso (Professor)](#instalação-para-uso-professor)
- [Ambiente de Desenvolvimento](#ambiente-de-desenvolvimento) — [Windows](#windows) · [macOS](#macos) · [Linux](#linux)
- [Gerando os Instaladores](#gerando-os-instaladores)
- [Rede e Firewall](#rede-e-firewall)
- [Testes Automatizados](#testes-automatizados)
- [Desenvolvimento com IA e SDD](#desenvolvimento-com-ia-e-sdd)
- [Estrutura do Repositório](#estrutura-do-repositório)
- [Licença e Menções a Terceiros](#licença-e-menções-a-terceiros)

---

## O Problema

Nas aulas práticas e laboratoriais de cursos técnicos e superiores (como programação e informática), os professores frequentemente enfrentam graves limitações para compartilhar a sua tela com os estudantes:

1. **Limitações do Projetor Físico:** Os projetores multimídia instalados nas salas geralmente possuem baixa resolução nativa, lâmpadas com brilho desgastado e baixo contraste.
2. **Prejuízo à Visibilidade no Laboratório:** O projetor fica posicionado fixamente na parede frontal. Os alunos posicionados nas fileiras intermediárias e no fundo do laboratório têm enorme dificuldade em enxergar linhas finas de código-fonte no editor, saídas detalhadas de terminais e caracteres pequenos.
3. **Instabilidade e Queda da Internet:** A conexão de internet da instituição costuma oscilar ou cair durante os horários de pico, inviabilizando qualquer transmissão dependente de servidores externos.
4. **Bloqueio de Ferramentas em Nuvem pelo Firewall:** O firewall institucional bloqueia portas e protocolos de plataformas comerciais em nuvem (Google Meet, Zoom, Microsoft Teams e Discord), impedindo seu uso nas máquinas da instituição.

---

## O Objetivo

O **MLab** foi desenvolvido com o propósito de **acabar com a dependência do projetor físico** e proporcionar um salto substancial na qualidade das aulas.

O professor transmite a tela inteira ou uma janela específica diretamente para os monitores dos computadores dos alunos em **1080p Full HD** (a 30 ou 60 fps). A solução opera **100% em rede local (LAN)** — via cabo Ethernet ou Wi-Fi da sala —, funcionando de forma **offline**, **sem consumir dados da internet** e **sem exigir instalação de programas ou extensões por parte dos alunos**.

---

## Como Funciona

A arquitetura do MLab combina um aplicativo desktop para o professor, um servidor SFU em Go embarcado nesse aplicativo e uma página web leve para os alunos:

```text
       Computador do Professor (App Desktop Electron)
    ┌────────────────────────────────────────────────────────┐
    │  • Captura nativa de tela/janela em 1080p (30/60 fps)  │
    │  • Áudio do microfone e áudio interno do computador    │
    │  • Upload único (4 a 6 Mbps) via WebRTC                │
    │  • Painel da turma, gravação local e chat privado      │
    │  • Inicia o backend Go embarcado (porta :8080)         │
    └──────────────────────────┬─────────────────────────────┘
                               │ WebRTC (UDP 50000–50100) / WebSocket (:8080)
                               ▼
    ┌────────────────────────────────────────────────────────┐
    │  Backend SFU (Go / Pion WebRTC)                        │
    │  • Repasse em memória sem recompressão (SFU)           │
    │  • Controle de keyframes para novos alunos             │
    │  • Chat, fila de mãos levantadas e arquivos da aula    │
    │  • Serve a página web dos alunos                       │
    └───────────┬─────────────────────────────┬──────────────┘
                │ WebRTC Downstream           │ WebRTC Downstream
                ▼                             ▼
      Computadores dos Alunos       Dispositivos Móveis dos Alunos
    ┌────────────────────────┐    ┌──────────────────────────────┐
    │  Navegador Web (React) │    │  Navegador Mobile (Chrome/   │
    │  • Vídeo 1080p         │    │  Safari)                     │
    │  • Levantar a Mão      │    │  • Modo Tela Cheia e PiP     │
    │  • Chat público/privado│    │  • Sem instalar nada         │
    │  • Download de arquivos│    │  • 100% offline na rede local│
    └────────────────────────┘    └──────────────────────────────┘
```

- **Professor:** aplicativo desktop em Electron + React + TypeScript. O professor informa o nome (sem login), cria a sala, escolhe o monitor ou a janela, define a qualidade e transmite. O upload do professor é único: não cresce com o número de alunos.
- **Servidor:** backend em Go com Pion WebRTC, iniciado pelo próprio aplicativo do professor. Atua como SFU (Selective Forwarding Unit), repassando os pacotes de vídeo e áudio sem decodificar nem recomprimir. Também mantém o WebSocket da sala, o histórico da aula em memória e os arquivos compartilhados.
- **Alunos:** página web responsiva servida pelo backend na rede local. O aluno abre o link exibido no app do professor — no formato `http://<ip-do-professor>:8080/<sala>/<professor>/entrar` ou `http://mlab.local:8080/...` — e se identifica com Nome e Matrícula.

---

## Funcionalidades

### Levantar a Mão com Fila de Chamada
- O aluno clica em **Levantar Mão** no player de vídeo ou na barra lateral de tela cheia.
- O professor vê a seção **Mãos Levantadas** na aba de Alunos, em ordem de chamada (`#1`, `#2`, `#3`).
- O professor pode responder em chat privado ou clicar em **Abaixar Mão**; o aluno também pode abaixar a própria mão.
- Com a barra lateral fechada, um aviso flutuante informa o professor, com atalho para abrir a turma.

### Operação 100% Offline e Detecção de Rede
- Funciona em salas sem conexão externa de internet; o estado da aula fica em memória (ADR 0005).
- O backend descarta adaptadores virtuais (VMware, VirtualBox, WSL, Hyper-V, Docker, ZeroTier e VPNs) e identifica o IPv4 físico da interface Ethernet ou Wi-Fi da sala.
- Anuncia `mlab.local` na rede via mDNS, como alternativa ao IP.

### Perfis de Qualidade Full HD 1080p (30 fps e 60 fps)
- **1080p @ 30 fps (4,0 Mbps):** perfil padrão para programação, slides e código-fonte, com `contentHint = 'detail'` e `degradationPreference = 'maintain-resolution'`.
- **1080p @ 60 fps (6,0 Mbps):** para animações, jogos, renderização 3D e vídeos.

### Troca de Fonte sem Quedas (`replaceTrack`)
- O professor alterna entre "Tela Inteira" e "Janela Específica" durante a aula, sem que os alunos precisem recarregar a página.

### Controle de Keyframes (sem tela preta)
- Novos alunos recebem um keyframe logo ao entrar, com janela de cooldown no SFU e limite de frequência por aluno para pedidos de keyframe.

### Entrada Identificada com Validação de Matrícula
- O aluno informa Nome Completo e Matrícula antes de entrar.
- A matrícula aceita siglas de curso de até 4 letras cercadas de dígitos (ex.: `2025116TADS0000`, `20241INFO1234`).
- Sessão única por aluno: se a mesma matrícula entrar em outra aba ou dispositivo, a sessão anterior é encerrada com aviso.

### Chat com Máscara de Palavrões
- Chat público da turma e canal privado aluno-professor, separados.
- Filtro no backend que mascara palavras ofensivas (incluindo variações leetspeak e acentuação) com `****`.
- Histórico para quem entra atrasado (até 200 mensagens) e até 3 mensagens fixadas pelo professor.
- Limite de envio: o aluno é avisado quando manda mensagens rápido demais; o chat fica desabilitado até a conexão com a sala abrir.

### Compartilhamento de Arquivos na Rede Local
- O professor envia arquivos para a aula; os alunos baixam direto pela página, sem pen-drive ou internet.

### Gravação Local em 1080p
- O professor salva a aula no próprio disco em WebM ou MP4, com a duração corrigida no arquivo para permitir avançar e voltar em qualquer player.

### Áudio do Professor
- Microfone com filtros contra microfonia e cancelamento de eco, e captura do áudio interno do computador.
- No aluno, se o navegador bloquear o som inicial, um banner permite ativá-lo com um clique.

---

## Requisitos do Sistema

| Item | Requisito |
|---|---|
| Computador do professor | Windows 10/11 (64 bits), macOS 13+ (Ventura ou superior) ou Linux 64 bits (Ubuntu/Debian/Fedora) |
| Alunos | Qualquer computador ou smartphone com navegador moderno (Chrome, Edge, Firefox, Safari ou Opera) |
| Rede | Professor e alunos na mesma rede local (cabo ou Wi-Fi) |
| Desenvolvimento | Node.js 20+ (npm 10+), Go 1.26+ (`apps/backend/go.mod`), Git |

---

## Instalação para Uso (Professor)

Os instaladores ficam na página de [Releases](https://github.com/MateusARJ/MLAB/releases) do repositório (ou podem ser gerados conforme [Gerando os Instaladores](#gerando-os-instaladores)). O backend vem embutido no aplicativo: não é preciso instalar Go nem Node.js para usar.

### Windows
1. Baixe `MLab-Setup-<versão>.exe` e execute.
2. Se o SmartScreen avisar que o aplicativo não é reconhecido, clique em **Mais informações → Executar assim mesmo** (o instalador não é assinado).
3. Escolha a pasta de instalação; o atalho **MLab** é criado na Área de Trabalho e no Menu Iniciar.
4. Na primeira transmissão, permita o acesso do MLab às **redes privadas** quando o Firewall do Windows perguntar (veja [Rede e Firewall](#rede-e-firewall)).

### macOS
1. Baixe `MLab-Mac-<versão>.dmg`, abra e arraste o **MLab** para **Aplicativos**.
2. O aplicativo não é assinado pela Apple. Na primeira abertura, clique com o botão direito em **MLab → Abrir** e confirme. Se o macOS disser que o app "está danificado", remova a quarentena:
   ```bash
   xattr -cr /Applications/MLab.app
   ```
3. Em **Ajustes do Sistema → Privacidade e Segurança**, permita o MLab em **Gravação de Tela e Áudio do Sistema** e em **Microfone**. Reabra o app depois de conceder a permissão.
4. Quando o macOS perguntar sobre conexões de entrada ou acesso à rede local, permita.

### Linux
- **AppImage (qualquer distribuição):**
  ```bash
  chmod +x MLab-Linux-<versão>.AppImage
  ./MLab-Linux-<versão>.AppImage
  ```
  Em distribuições recentes pode ser necessário instalar o FUSE 2 (`sudo apt install libfuse2` ou `libfuse2t64` no Ubuntu 24.04+).
- **Debian/Ubuntu (.deb):**
  ```bash
  sudo apt install ./MLab-Linux-<versão>.deb
  ```
- **Outras distribuições (.tar.gz):** extraia o arquivo e execute o binário `mlab` (ou `MLab`) da pasta.
- **Wayland:** a captura de tela usa o portal do sistema (`xdg-desktop-portal` + PipeWire), que mostra a janela de escolha da tela. Se a captura falhar, verifique se esses pacotes estão instalados ou entre numa sessão Xorg.

---

## Ambiente de Desenvolvimento

O repositório é um monorepo [Turborepo](https://turbo.build/) com `apps/desktop` (professor), `apps/web` (aluno), `apps/backend` (Go) e `packages/`.

### Windows

1. Instale as ferramentas (PowerShell):
   ```powershell
   winget install OpenJS.NodeJS.LTS
   winget install GoLang.Go
   winget install Git.Git
   ```
   Feche e reabra o terminal e confira: `node -v` (20+), `go version` (1.26+).
2. Clone e instale as dependências:
   ```powershell
   git clone https://github.com/MateusARJ/MLAB.git
   cd MLAB
   npm install
   ```
3. (Opcional) Se o antivírus bloquear a pasta temporária do Go, aponte-a para dentro do projeto:
   ```powershell
   $env:GOTMPDIR = "$PWD\.gotmp"
   ```
4. Inicie tudo:
   ```powershell
   npm run dev
   ```

### macOS

1. Instale o [Homebrew](https://brew.sh/) e as ferramentas:
   ```bash
   xcode-select --install
   brew install node go git
   ```
   Confira: `node -v` (20+), `go version` (1.26+).
2. Clone e instale as dependências:
   ```bash
   git clone https://github.com/MateusARJ/MLAB.git
   cd MLAB
   npm install
   ```
3. Inicie tudo:
   ```bash
   npm run dev
   ```
4. Na primeira captura, o macOS pede a permissão de **Gravação de Tela** para o Electron (ou para o Terminal/IDE de onde ele foi iniciado). Conceda em **Ajustes do Sistema → Privacidade e Segurança** e reinicie o `npm run dev`.

### Linux

1. Instale as ferramentas:
   - **Ubuntu/Debian:**
     ```bash
     sudo apt update
     sudo apt install -y git build-essential curl
     curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
     sudo apt install -y nodejs
     ```
   - **Fedora:**
     ```bash
     sudo dnf install -y git nodejs npm golang
     ```
   - **Go 1.26+:** se o pacote da distribuição for mais antigo, instale pelo site oficial:
     ```bash
     curl -LO https://go.dev/dl/go1.26.0.linux-amd64.tar.gz
     sudo rm -rf /usr/local/go && sudo tar -C /usr/local -xzf go1.26.0.linux-amd64.tar.gz
     echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc && source ~/.bashrc
     ```
   - Dependências de execução do Electron (Ubuntu/Debian): `sudo apt install -y libnss3 libatk-bridge2.0-0 libgtk-3-0 libgbm1 libasound2`
     (no Ubuntu 24.04+ o último pacote se chama `libasound2t64`).
2. Clone e instale as dependências:
   ```bash
   git clone https://github.com/MateusARJ/MLAB.git
   cd MLAB
   npm install
   ```
3. Inicie tudo:
   ```bash
   npm run dev
   ```

### O que o `npm run dev` faz

O script `scripts/dev.js` gera uma chave de host aleatória (`MLAB_HOST_KEY`), sobe o backend Go (porta `8080`), o web do aluno (Vite, porta `5173`) e o app desktop em modo de desenvolvimento. Não há login: o professor entra informando o nome (ADR 0006).

Para rodar as partes separadamente, use a mesma chave de host no backend e no desktop:

```bash
# Terminal 1 — backend (porta 8080)
cd apps/backend
MLAB_HOST_KEY=<chave> MLAB_DEV_MONOREPO=1 go run ./cmd/server

# Terminal 2 — web do aluno (porta 5173)
cd apps/web
npm run dev

# Terminal 3 — app do professor
cd apps/desktop
MLAB_HOST_KEY=<chave> npm run dev
```

No PowerShell, defina as variáveis com `$env:MLAB_HOST_KEY = "<chave>"` antes do comando. Sem `MLAB_HOST_KEY`, o backend recusa a sessão do professor. O segredo dos tokens (`JWT_SECRET`) é gerado aleatoriamente a cada execução quando não é informado.

Variáveis opcionais do backend: `PORT`, `WEB_PORT`, `PUBLIC_URL`, `BASE_URL`, `NGROK_URL`, `STUN_URL`, `TURN_URL`/`TURN_SECRET` (TURN opcional, ADR 0005).

---

## Gerando os Instaladores

O aplicativo do professor é empacotado com `electron-builder`. Cada comando compila o web do aluno, o backend Go para o sistema de destino e o app desktop. Os arquivos saem em `apps/desktop/dist/`.

> Os comandos `npm run make*` não alteram a versão: os instaladores saem com a versão atual do `package.json`. Para mudar de versão, siga [Versionamento](docs/versionamento.md).

| Sistema | Comando (na raiz) | Saída |
|---|---|---|
| Windows | `npm run make:win` | `MLab-Setup-<versão>.exe` (NSIS) e `win-unpacked/` |
| macOS (em um Mac) | `npm run make:mac` | `MLab-Mac-<versão>.dmg` e `.zip` |
| Linux (em Linux) | `npm run make:linux` | `MLab-Linux-<versão>.AppImage`, `.deb` e `.tar.gz` |
| Linux só AppImage / só .deb | `npm run make:linux:appimage` / `npm run make:linux:deb` | o pacote escolhido |
| Windows + Linux | `npm run make` | todos os acima, exceto macOS |

- **Linux a partir do Windows:** `make:linux` e `make` empacotam a parte Linux pelo **WSL** (`scripts/build-linux-wsl.js`). É preciso ter o WSL com Node.js instalado dentro dele.
- **macOS:** só pode ser gerado em um Mac. O app não é assinado nem notarizado (veja as instruções de instalação acima).

### Binário do backend isolado

```bash
cd apps/backend
go build -ldflags="-s -w" -o ./bin/mlab-server ./cmd/server
```

### Versões e releases

O monorepo tem uma versão única, que só muda numa release (`npm run bump`) e é publicada com a tag `vX.Y.Z`. Confira com `npm run version:check`. Regras, comandos e o passo a passo da release: [docs/versionamento.md](docs/versionamento.md).

---

## Rede e Firewall

| Porta | Protocolo | Uso |
|---|---|---|
| `8080` | TCP | API, WebSocket da sala e página web dos alunos |
| `50000–50100` | UDP | Mídia WebRTC (SFU) |
| `5353` | UDP | mDNS (`mlab.local`), opcional |

- **Windows:** permita o MLab em **redes privadas** no aviso do Firewall. Se a rede da sala estiver classificada como pública, mude para privada ou libere as portas acima.
- **macOS:** permita conexões de entrada quando o sistema perguntar (Firewall em **Ajustes do Sistema → Rede**).
- **Linux:** com `ufw`: `sudo ufw allow 8080/tcp && sudo ufw allow 50000:50100/udp && sudo ufw allow 5353/udp`. Com `firewalld`: `sudo firewall-cmd --add-port=8080/tcp --add-port=50000-50100/udp --add-port=5353/udp --permanent && sudo firewall-cmd --reload`.
- Redes com isolamento de clientes (comum em Wi-Fi de visitantes) impedem que os alunos alcancem o professor; use a rede interna da sala.

---

## Testes Automatizados

```bash
# Todos os testes do monorepo (Go, web e desktop)
npm test

# Backend Go
cd apps/backend && go test ./...

# Smoke do backend com servidor real (matriz de regressão)
npm run test:smoke -w @mlab/backend

# Web do aluno (Vitest) e app do professor (Vitest)
npm test -w @mlab/web
npm test -w @mlab/desktop

# E2E do aluno no navegador (Playwright)
npx playwright install chromium
npm run test:e2e -w @mlab/web

# Relatório consolidado da matriz de smoke (docs/metrics/smoke-2026-11.md)
npm run smoke

# Validação dos artefatos do Spec Kit
npm run spec:check
```

---

## Desenvolvimento com IA e SDD

O MLab foi desenvolvido em **pair programming com inteligência artificial**, seguindo a metodologia **Spec-Driven Development (SDD)**, inspirada no [GitHub Spec Kit](https://github.com/github/spec-kit). Duas ferramentas de IA foram usadas ao longo do projeto:

- **[Google Antigravity](https://antigravity.google/):** usado nas fases iniciais e na maior parte da construção do produto — arquitetura do backend Go e do SFU Pion, captura e processamento de áudio no desktop, interface com o Carbon Design System e as primeiras suítes de testes.
- **[Claude Code](https://claude.com/claude-code) (Anthropic):** usado no realinhamento do Spec Kit ao código, no endurecimento de segurança (remoção do login, chave de host, proteção de arquivos e origens), no teste de carga real do SFU, na matriz de smoke de regressão (smoke de backend e E2E com Playwright) e nas correções que ela apontou.

### A metodologia SDD na prática

Nenhuma mudança de comportamento entra no código sem um artefato aprovado antes. O fluxo de cada feature, definido em [`AGENTS.md`](AGENTS.md) e na [constituição do projeto](spec-kit/.specify/memory/constitution.md), é:

```text
constitution → specify → clarify → plan → checklist → tasks → analyze → implement → converge
```

1. **Specify:** o que e por quê — user stories, requisitos (RF/RNF) e regras de negócio em `spec-kit/specs/<feature>/spec.md`.
2. **Clarify:** ambiguidades que mudariam comportamento, segurança ou arquitetura são resolvidas com o responsável e registradas.
3. **Plan:** como — arquitetura, riscos, contratos e um **Scope Lock** com os caminhos que a feature pode e não pode alterar.
4. **Checklist, tasks e analyze:** tarefas pequenas e testáveis, cada uma com paths permitidos e proibidos; a análise só libera a implementação quando termina em `PASS`.
5. **Implement:** uma tarefa por vez, com testes, em commits atômicos (`tipo(escopo): descrição em português`).
6. **Converge:** compara o código real com spec, plan e tasks e registra o que falta.

Decisões arquiteturais ficam em ADRs (`spec-kit/docs/adrs/`), e `npm run spec:check` valida os artefatos antes de qualquer merge que altere `apps/` ou `packages/`. As regras valem igualmente para as duas ferramentas de IA: o agente para e pergunta quando falta spec, quando uma tarefa sairia do Scope Lock ou quando teria de inventar comportamento.

### Divisão de papéis

- **Desenvolvedor:** identificação das dores reais das salas de aula e laboratórios, definição do escopo, decisões de produto nas etapas de clarify, aprovação de ADRs, validação da interface e testes práticos no ambiente real da instituição.
- **Agentes de IA (Antigravity e Claude Code):** redação e manutenção dos artefatos SDD, implementação das tarefas aprovadas, testes automatizados, medições e relatórios de convergência — sempre dentro do escopo aprovado pelo desenvolvedor.

---

## Estrutura do Repositório

```text
mlab/
├── apps/
│   ├── backend/               # Servidor Go: SFU Pion WebRTC, API REST e WebSocket
│   │   ├── cmd/server/        # Ponto de entrada, smoke e teste de carga
│   │   └── internal/
│   │       ├── auth/          # Sessão do professor (chave de host) e JWT
│   │       ├── chat/          # Máscara de palavrões
│   │       ├── room/          # Salas, links, arquivos, origens e detecção de IP da LAN
│   │       ├── signaling/     # Hub WebSocket: chat, mãos levantadas, sessão única, keyframes
│   │       └── webrtc/        # SFU Pion e controle de keyframes
│   ├── desktop/               # App Electron + React (professor)
│   │   ├── src/main/          # Processo principal, captura nativa e backend embarcado
│   │   ├── src/preload/       # contextBridge seguro
│   │   └── src/renderer/      # Interface React (Carbon), gravação e controles
│   └── web/                   # Web do aluno (React + Vite)
│       ├── e2e/               # Testes E2E (Playwright) com professor simulado
│       ├── src/hooks/         # Assinante WebRTC, reconexão e chat
│       └── src/pages/         # Entrada (Join) e sala ao vivo (Room)
├── packages/
│   ├── types/                 # DTOs e mensagens de sinalização compartilhados
│   └── ui/                    # Componentes visuais e ícones Carbon compartilhados
├── docs/                      # Requisitos detalhados, métricas, teste de carga e design system
├── spec-kit/                  # Constituição, specs por feature e ADRs (SDD)
├── scripts/                   # dev, build do backend, empacotamento, smoke e spec:check
├── AGENTS.md                  # Regras para os agentes de IA (CLAUDE.md importa este arquivo)
├── package.json               # Scripts da raiz
└── turbo.json                 # Pipelines do Turborepo
```

---

## Licença e Menções a Terceiros

O código-fonte do **MLab** é distribuído sob os termos da **Licença MIT**.

### Atribuições e Licenças de Bibliotecas de Terceiros
O MLab é construído sobre tecnologias de código aberto. Agradecemos e reconhecemos os autores e mantenedores dos seguintes projetos:

| Projeto / Biblioteca | Licença | Detentores de Direitos / Autores | Finalidade no MLab |
| :--- | :--- | :--- | :--- |
| **[Pion WebRTC](https://github.com/pion/webrtc)** | MIT | Copyright (c) 2018 Pion | Motor WebRTC e SFU em Go puro |
| **[Gorilla WebSocket](https://github.com/gorilla/websocket)** | BSD-2-Clause | Copyright (c) 2013 The Gorilla WebSocket Authors | Servidor WebSocket e canal de sinalização |
| **[Golang-JWT](https://github.com/golang-jwt/jwt)** | MIT | Copyright (c) 2021 Dave Grijalva, Form3, Golang-JWT Authors | Assinatura e validação de tokens JWT |
| **[Go Cryptography](https://golang.org/x/crypto)** | BSD-3-Clause | Copyright (c) 2009 The Go Authors | Primitivas criptográficas usadas pelo Pion WebRTC (DTLS) |
| **[Electron](https://github.com/electron/electron)** | MIT | Copyright (c) OpenJS Foundation and Electron contributors | Framework desktop multiplataforma |
| **[React](https://github.com/facebook/react)** | MIT | Copyright (c) Meta Platforms, Inc. and affiliates | Biblioteca de interfaces |
| **[Carbon Design System](https://github.com/carbon-design-system)** | Apache-2.0 | Copyright (c) IBM Corporation | Sistema de design e ícones |
| **[Vite](https://github.com/vitejs/vite)** | MIT | Copyright (c) 2019-present Evan You & Vite Contributors | Build e servidor de desenvolvimento do web |
| **[Turborepo](https://github.com/vercel/turbo)** | MIT | Copyright (c) 2021 Vercel, Inc. | Orquestrador do monorepo |
| **[TypeScript](https://github.com/microsoft/TypeScript)** | Apache-2.0 | Copyright (c) Microsoft Corporation | Tipagem estática em todo o monorepo |
| **[Vitest](https://github.com/vitest-dev/vitest)** | MIT | Copyright (c) 2021-present Anthony Fu & Vitest contributors | Testes unitários |
| **[Testing Library](https://github.com/testing-library)** | MIT | Copyright (c) 2017 Kent C. Dodds | Testes de componentes React |
| **[Playwright](https://github.com/microsoft/playwright)** | Apache-2.0 | Copyright (c) Microsoft Corporation | Testes E2E do web do aluno |

Para mais detalhes sobre os termos de uso de cada dependência, consulte os arquivos de licença originais de cada pacote.
