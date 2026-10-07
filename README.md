# MLab

<p align="center">
  <img src="MLAB-logo.png" alt="MLab Logo" width="220" />
</p>

<p align="center">
  <strong>Transmissão de tela e áudio em rede local para salas de aula e laboratórios de informática</strong><br />
  Alta fidelidade em 1080p (30/60 fps), ultrabaixa latência (&lt; 500 ms), 100% offline e sem necessidade de internet.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Go-1.22+-00ADD8?style=flat&logo=go&logoColor=white" alt="Go" />
  <img src="https://img.shields.io/badge/WebRTC-Pion-orange?style=flat&logo=webrtc&logoColor=white" alt="WebRTC" />
  <img src="https://img.shields.io/badge/Electron-Desktop-47848F?style=flat&logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Vite-Fast-646CFF?style=flat&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/Carbon_Design-IBM-0f62fe?style=flat&logo=ibm&logoColor=white" alt="IBM Carbon" />
  <img src="https://img.shields.io/badge/Methodology-SDD_%26_AI-7c3aed?style=flat" alt="SDD" />
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License" />
</p>

---

## O Problema

Nas aulas práticas e laboratoriais de cursos técnicos e superiores (como programação e informática), os professores frequentemente enfrentam graves limitações para compartilhar a sua tela com os estudantes:

1. **Limitações do Projetor Físico:** Os projetores multimídia instalados nas salas geralmente possuem baixa resolução nativa, lâmpadas com brilho desgastado e baixo contraste.
2. **Prejuízo à Visibilidade no Laboratório:** O projetor fica posicionado fixamente na parede frontal. Os alunos posicionados nas fileiras intermediárias e no fundo do laboratório têm enorme dificuldade em enxergar linhas finas de código-fonte no editor, saídas detalhadas de terminais e caracteres pequenos.
3. **Instabilidade e Queda da Internet:** A conexão de internet da instituição costuma oscilar ou cair durante os horários de pico, inviabilizando qualquer transmissão dependente de servidores externos.
4. **Bloqueio de Ferramentas em Nuvem pelo Firewall:** O firewall institucional bloqueia portas e protocolos de plataformas comerciais em nuvem (Google Meet, Zoom, Microsoft Teams e Discord), impedindo seu uso nas máquinas da instituição.

---

## O Objetivo

O **MLab** foi desenvolvido com o propósito de **acabar definitivamente com a dependência do projetor físico** e proporcionar um salto substancial na qualidade das aulas.

O professor transmite a tela inteira ou uma janela específica diretamente para os monitores dos computadores dos alunos em **1080p Full HD** cravado (a 30 ou 60 fps). A solução opera **100% em rede local (LAN)** — seja via cabo Ethernet ou Wi-Fi da sala —, funcionando de forma **totalmente offline**, **sem consumir dados da internet**, **sem exigir instalação de programas ou extensões por parte dos alunos** e com latência imperceptível (&lt; 500 ms).

---

## Como Funciona

A arquitetura do MLab combina uma aplicação nativa de alta performance para o professor com um servidor centralizador SFU em Go e clientes web ultra-leves para os alunos:

```text
       Computador do Professor (Desktop Electron)
    ┌────────────────────────────────────────────────────────┐
    │  • Captura nativa de tela/janela em 1080p (30/60 fps)  │
    │  • DSP de áudio anti-microfonia e cancelamento de eco  │
    │  • Upload fixo único (4 a 6 Mbps) via WebRTC Upstream  │
    │  • Painel de controle, gravação local e chat privado   │
    └──────────────────────────┬─────────────────────────────┘
                               │ WebRTC RTP / WebSocket (:8080)
                               ▼
    ┌────────────────────────────────────────────────────────┐
    │  Servidor Backend SFU (Go / Pion WebRTC)               │
    │  • Repasse em memória sem recompressão (SFU)           │
    │  • Keyframe Controller inteligente (zero tela preta)   │
    │  • Descarte de adaptadores virtuais de rede (LAN pura) │
    │  • Fila de mãos levantadas e máscara de palavrões      │
    └───────────┬─────────────────────────────┬──────────────┘
                │ WebRTC Downstream           │ WebRTC Downstream
                ▼                             ▼
      Computadores dos Alunos       Dispositivos Móveis dos Alunos
    ┌────────────────────────┐    ┌──────────────────────────────┐
    │  Navegador Web (React) │    │  Navegador Mobile (Chrome/   │
    │  • Vídeo 1080p cravado │    │  Safari)                     │
    │  • Levantar a Mão      │    │  • Modo Tela Cheia e PiP     │
    │  • Chat público/privado│    │  • Sem instalar nada         │
    │  • Download de arquivos│    │  • 100% offline na rede local│
    └────────────────────────┘    └──────────────────────────────┘
```

- **Professor:** Aplicação Desktop em Electron + React + TypeScript + Vite. Cria a sala, escolhe o monitor ou janela, define a qualidade e transmite. O consumo de upload do professor permanece estritamente fixo entre 4 e 6 Mbps, não importando se há 5 ou 60 alunos conectados.
- **Servidor:** Backend compilado em Go com biblioteca Pion WebRTC. Atua como SFU (Selective Forwarding Unit), repassando os pacotes de vídeo e áudio em memória com altíssimo rendimento e baixíssimo uso de CPU/RAM. Gerencia também o WebSocket Hub, o histórico em memória da aula e o compartilhamento de arquivos na porta `:8080`.
- **Alunos:** Página web responsiva servida pelo backend na rede local. O aluno acessa digitando o endereço da sala no navegador (ex: `http://<ip-do-professor>:8080/sala/alpha-bravo-1234/entrar`).

---

## Funcionalidades

### ✋ Levantar a Mão com Fila de Chamada (Sem Emojis)
- O aluno clica no botão **Levantar Mão** no player de vídeo ou na barra lateral de tela cheia.
- O professor visualiza uma seção dedicada **Mãos Levantadas** na aba de Alunos, com a contagem exata e a ordem cronológica de chamada (`#1`, `#2`, `#3`), permitindo atender quem levantou a mão primeiro.
- O professor pode responder diretamente em chat privado ou clicar em **Abaixar Mão**. O próprio aluno também pode abaixar a mão a qualquer momento.
- Se a barra lateral do professor estiver fechada, um aviso discreto (Toast flutuante) avisa que o aluno levantou a mão com atalho para abrir a turma.
- **Padrão Visual Estrito:** Toda a funcionalidade foi construída seguindo rigorosamente o **IBM Carbon Design System** (`Touch_1` e `Touch_1Filled`), **sem o uso de nenhum emoji** na interface.

### 🌐 Operação 100% Offline e Detecção Inteligente de Rede
- Funciona perfeitamente em salas de aula sem qualquer conexão externa de internet.
- O backend conta com um algoritmo inteligente de inspeção de interfaces de rede que **descarta automaticamente adaptadores virtuais** (VMware, VirtualBox, WSL, Hyper-V, Docker, ZeroTier e túneis VPN), identificando com precisão o IPv4 físico real da interface cabeada (Ethernet) ou sem fio (Wi-Fi) da sala.
- Garante que o link gerado pelo professor funcione na primeira tentativa para todos os computadores dos alunos na rede local.

### 📺 Perfis de Qualidade Full HD 1080p (30 fps e 60 fps)
- **1080p @ 30 fps (4.0 Mbps):** Perfil padrão para aulas de programação, leitura de slides e edição de código-fonte. Configurado com `contentHint = 'detail'` e `degradationPreference = 'maintain-resolution'`, garantindo que a resolução nunca seja degradada.
- **1080p @ 60 fps (6.0 Mbps):** Perfil de alta taxa de quadros para demonstração de animações, desenvolvimento de jogos, renderização 3D e vídeos.
- Teto de REMB da SFU ampliado para 8 Mbps, garantindo fluidez contínua sem engasgos.

### ⚡ Troca Dinâmica de Fonte sem Quedas (`replaceTrack`)
- O professor pode alternar entre "Tela Inteira" e "Janela Específica" (ou trocar de janela) a qualquer momento durante a aula ao vivo.
- A substituição é realizada a quente via `RTCRtpSender.replaceTrack` e solicitação imediata de Keyframe (RTCP PLI), mantendo a mesma conexão WebRTC ativa, sem congelamentos e sem exigir que os alunos atualizem a página (zero F5).

### 🛡️ Keyframe Controller Não-Destrutivo (Zero Tela Preta)
- Elimina o problema crônico de telas pretas quando novos alunos entram na transmissão.
- O SFU implementa agendamento inteligente com janela de cooldown (1.2s): solicitações de novos participantes nunca são descartadas e sim disparadas no instante exato de liberação do encoder.
- Inclui um *liveness ticker* seguro a cada 8 segundos para recuperação automática em caso de oscilações transitórias na rede local.

### 📝 Entrada Identificada com Validação de Matrícula
- O aluno se identifica antes de entrar na transmissão informando Nome Completo e Matrícula institucional.
- **Máscara de Validação Regex:** A matrícula aceita siglas de curso de até 4 letras maiúsculas cercadas de dígitos (ex: `2025116TADS0000`, `20241INFO1234`, `20232ENG0001`), impedindo entradas inválidas ou nomes em branco.

### 💬 Chat com Máscara de Segurança contra Palavrões
- **Isolamento de Canais:** Separação estrita entre o chat público da turma e o canal confidencial de dúvidas privadas (aluno-professor).
- **Máscara de Segurança Automática:** Filtro em tempo real no backend Go que detecta palavras inadequadas e ofensivas (incluindo variações leetspeak, repetições de caracteres e acentuações) e substitui o conteúdo por máscara de asteriscos (`****`), preservando a integridade do ambiente acadêmico.
- **Histórico Persistente:** Alunos que entram atrasados recebem automaticamente o histórico de mensagens trocadas na aula.

### 📁 Compartilhamento de Arquivos na Rede Local
- O professor pode arrastar ou selecionar arquivos de qualquer extensão (PDFs, códigos-fonte, imagens, arquivos zipados) para a transmissão.
- Os alunos realizam download direto via rede local através da página da aula, sem necessitar de pen-drives ou de internet.

### 🎥 Gravação Local em 1080p com Correção de Duração EBML
- Permite que o professor salve a gravação completa da aula no seu disco rígido em formato WebM 1080p.
- Injeta dinamicamente metadados EBML (`Duration`) no cabeçalho do arquivo antes do salvamento final, resolvendo a limitação nativa do Chromium e permitindo que o vídeo seja reproduzido com barra de seek e duração correta em qualquer tocador (VLC, Windows Media Player, navegadores).

### 🔇 Supressão de Microfonia e Áudio Anti-Uivo
- O aplicativo desktop incorpora processamento Web Audio com filtros passa-alta, redução de ganho dinâmico e cancelamento de eco acústico para suprimir microfonia durante a fala do professor no laboratório.
- Tratamento de Autoplay Policy dos navegadores no cliente do aluno, exibindo banner sutil para desmutar com um clique caso o navegador bloqueie o áudio inicial.

---

## Desenvolvimento com IA (Google Antigravity) e SDD

Este projeto foi desenvolvido em regime de **Pair Programming com Inteligência Artificial** utilizando o **Google Antigravity**, aplicando rigorosamente a metodologia **Spec-Driven Development (SDD)**.

### A Metodologia SDD na Prática
O desenvolvimento baseado em especificações assegurou que nenhuma linha de código de produção fosse alterada sem antes passar por um ciclo formal e verificável:

1. **Especificação de Requisitos e ADRs:** Criação de documentos formais em `spec-kit(MLAB)` contendo as regras de negócio, limites de hardware e decisões arquiteturais (ADRs).
2. **Plano de Implementação Modular:** Antes de qualquer alteração, o agente Antigravity elaborava planos detalhados de implementação com passos cirúrgicos, análise de impacto e estratégia de não-regressão.
3. **Desenvolvimento Guiado por Testes (TDD/SDD):** Cada nova funcionalidade (desde o controle de concorrência em Go até o filtro de matrícula e o levantamento de mão) foi acompanhada por testes unitários e de integração antes da integração final.
4. **Preservação Contínua da Qualidade:** Todas as implementações foram validadas para garantir que as restrições críticas do projeto — como 1080p cravado a 30/60 fps, zero emojis e tempo de resposta de rede — permanecessem intactas.

### Sinergia Humano-IA
A colaboração entre o desenvolvedor e o agente Antigravity dividiu-se com base nas forças de cada parte:
- **Papel do Desenvolvedor:** Identificação das dores reais vividas nas salas de aula e laboratórios de informática, definição do escopo de usuário, validação ergonômica da interface, restrições da infraestrutura de rede da instituição e testes práticos em ambiente real.
- **Papel do Antigravity (IA):** Arquitetura e modelagem concorrente thread-safe em Go, engenharia de pacotes WebRTC RTP/RTCP na SFU Pion, implementação do DSP de áudio, integração com o Carbon Design System, injeção de metadados binários EBML e automação de dezenas de suítes de testes automatizados.

---

## Requisitos do Sistema

- **Sistema Operacional do Professor:** Windows 10/11 (64-bit), macOS 13+ (Ventura ou superior) ou Linux (Ubuntu/Debian/Fedora).
- **Computadores dos Alunos:** Qualquer computador ou smartphone com navegador moderno (Google Chrome, Microsoft Edge, Mozilla Firefox, Safari ou Opera).
- **Ambiente de Desenvolvimento:**
  - **Go:** 1.22 ou superior (homologado com Go 1.24/1.27)
  - **Node.js:** 20.0.0 ou superior (com `npm` 10+)
  - **Permissão de Gravação de Tela** no sistema operacional do professor.

---

## Como Executar

### 1. Preparação do Repositório

Clone o repositório e instale as dependências unificadas na raiz:

```powershell
git clone https://github.com/MateusARJ/MLAB.git
cd MLAB
npm install
```

Configure o diretório temporário do Go no Windows:
```powershell
$env:GOTMPDIR = "$PWD\.gotmp"
```

---

### 2. Execução para Desenvolvimento

#### Opção A — Execução Unificada (Turborepo)
Inicie todos os serviços simultaneamente através do pipeline Turborepo:
```powershell
npm run dev
```

#### Opção B — Execução em Terminais Separados

**Terminal 1 — Backend SFU em Go (Porta `:8080`):**
```powershell
cd apps/backend
$env:GOTMPDIR = "$PWD\..\..\.gotmp"
$env:JWT_SECRET = "dev-secret-key-12345"
go run ./cmd/server/main.go
```

**Terminal 2 — App Web do Aluno (Porta `:5173` ou `:3000` via proxy):**
```powershell
cd apps/web
npm run dev
```

**Terminal 3 — App Desktop do Professor (Electron):**
```powershell
cd apps/desktop
npm run dev
```

---

## Gerando os Aplicativos e Instaladores

O aplicativo do professor é empacotado através do `electron-builder` integrado ao `electron-vite`:

### No Windows
Gera o instalador executável `.exe` e a versão portátil:
```powershell
cd apps/desktop
npm run make
```
- **Instalador NSIS:** `apps/desktop/dist/MLab Setup 1.5.4.exe`
- **Versão Portátil:** `apps/desktop/dist/win-unpacked/MLab.exe`

### No macOS
Em uma máquina macOS (Apple Silicon ou Intel):
```bash
cd apps/desktop
npm run build
npx electron-builder --mac
```
- **Imagem de Disco:** `dist/MLab-1.5.4.dmg` (arrastar para Aplicativos)

### No Linux
Em uma distribuição Linux (Ubuntu, Debian, Fedora):
```bash
cd apps/desktop
npm run build
npx electron-builder --linux AppImage deb
```
- **Executável Universal:** `dist/MLab-1.5.4.AppImage`
- **Pacote Debian:** `dist/MLab_1.5.4_amd64.deb`

### Binário do Backend de Produção
Para compilar o servidor Go com otimizações máximas de binário único:
```powershell
cd apps/backend
go build -ldflags="-s -w" -o ./bin/mlab-server.exe ./cmd/server
```

---

## Testes Automatizados

O projeto conta com mais de **80 testes automatizados** distribuídos entre todas as camadas do sistema, executados sem dependências externas:

```powershell
# Executar todos os testes do monorepo (Go, Web e Desktop)
npm test

# Executar testes unitários do Backend Go
cd apps/backend
go test -v ./...

# Executar testes do Web App do Aluno
npm test --prefix apps/web

# Executar testes do App Desktop do Professor
npm test --prefix apps/desktop
```

---

## Estrutura do Repositório

```text
mlab/
├── apps/
│   ├── backend/               # Servidor Go: SFU Pion WebRTC, REST API e WebSocket Hub
│   │   ├── cmd/server/        # Ponto de entrada (main.go)
│   │   └── internal/
│   │       ├── auth/          # Autenticação JWT, claims e bcrypt
│   │       ├── chat/          # Sanitização XSS, rate-limit e máscara de palavrões
│   │       ├── room/          # Gerenciamento de salas, links e detecção de IPs de LAN
│   │       ├── signaling/     # WebSocket Hub, eventos de levantar a mão e arquivos
│   │       └── webrtc/        # Pipeline SFU Pion, Keyframe Controller e reuso de faixas
│   ├── desktop/               # Aplicativo Electron + React (Professor)
│   │   ├── src/main/          # Processo principal Electron e bridge de captura nativa
│   │   ├── src/preload/       # ContextBridge seguro
│   │   └── src/renderer/      # Interface React (Carbon Design), WebM fixer e controles
│   └── web/                   # Web App do Aluno (React + Vite)
│       ├── src/hooks/         # Hook WebRTC subscriber com auto-keyframe e reconexão
│       └── src/pages/         # Telas de entrada (Join) e sala de transmissão (Room)
├── packages/
│   ├── types/                 # DTOs compartilhados, tipos TypeScript e mensagens de sinalização
│   └── ui/                    # Biblioteca de componentes visuais e ícones Carbon compartilhados
├── spec-kit(MLAB)/            # Especificações de requisitos, diagramas e ADRs do projeto
├── MLAB-logo.png              # Identidade visual oficial do MLab
├── package.json               # Gerenciador de dependências e scripts da raiz
└── turbo.json                 # Configuração de pipelines do Turborepo
```

---

## Licença e Menções a Terceiros

O código-fonte do **MLab** é distribuído sob os termos da **Licença MIT**.

### Atribuições e Licenças de Bibliotecas de Terceiros
O MLab é construído sobre tecnologias de código aberto consagradas da comunidade de software livre. Agradecemos e reconhecemos expressamente os autores e mantenedores dos seguintes projetos:

| Projeto / Biblioteca | Licença | Detentores de Direitos / Autores | Finalidade no MLab |
| :--- | :--- | :--- | :--- |
| **[Pion WebRTC](https://github.com/pion/webrtc)** | MIT | Copyright (c) 2018 Pion | Implementação do motor WebRTC e SFU em Go puro |
| **[Gorilla WebSocket](https://github.com/gorilla/websocket)** | BSD-2-Clause | Copyright (c) 2013 The Gorilla WebSocket Authors | Servidor WebSocket concorrente e canal de sinalização |
| **[Golang-JWT](https://github.com/golang-jwt/jwt)** | MIT | Copyright (c) 2021 Dave Grijalva, Form3, Golang-JWT Authors | Assinatura e validação de tokens JWT |
| **[Go Cryptography](https://golang.org/x/crypto)** | BSD-3-Clause | Copyright (c) 2009 The Go Authors | Algoritmo bcrypt para segurança de senhas |
| **[Electron](https://github.com/electron/electron)** | MIT | Copyright (c) OpenJS Foundation and Electron contributors | Framework desktop nativo multiplataforma |
| **[React](https://github.com/facebook/react)** | MIT | Copyright (c) Meta Platforms, Inc. and affiliates | Biblioteca de interfaces reativas |
| **[Carbon Design System](https://github.com/carbon-design-system)** | Apache-2.0 | Copyright (c) IBM Corporation | Sistema de design e pacote de ícones oficiais |
| **[Vite](https://github.com/vitejs/vite)** | MIT | Copyright (c) 2019-present Evan You & Vite Contributors | Ferramenta de build rápido e empacotamento web |
| **[Turborepo](https://github.com/vercel/turbo)** | MIT | Copyright (c) 2021 Vercel, Inc. | Orquestrador de monorepo e cache inteligente de builds |
| **[TypeScript](https://github.com/microsoft/TypeScript)** | Apache-2.0 | Copyright (c) Microsoft Corporation | Tipagem estática e interfaces em todo o monorepo |
| **[Vitest](https://github.com/vitest-dev/vitest)** | MIT | Copyright (c) 2021-present Anthony Fu & Vitest contributors | Suíte de testes unitários ultrarrápida |
| **[Testing Library](https://github.com/testing-library)** | MIT | Copyright (c) 2017 Kent C. Dodds | Testes de integração de componentes React |

Para maiores detalhes sobre os termos de uso de cada dependência, consulte os arquivos de licença originais de cada pacote.
