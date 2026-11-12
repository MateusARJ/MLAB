# Quickstart: Transmissão de Tela em Sala

Feature: `001-screen-share-core`
Status: READY (atualizado em 2026-11-06 para o estado atual; passo a passo completo no `README.md` da raiz)

## Pré-requisitos

### Ferramentas de desenvolvimento

- **Node.js** ≥ 20 LTS — para Turborepo, apps/desktop e apps/web.
- **npm** ≥ 10 — gerenciador de pacotes do workspace.
- **Go** ≥ 1.26 — para apps/backend (`go.mod`).
- **Git** — controle de versão.

Não há banco de dados nem serviço externo: o backend guarda o estado em memória e roda embarcado no app do
professor (ADR 0005).

### Infraestrutura WebRTC

- **Suporte do Electron a `getDisplayMedia()`/`desktopCapturer`** — obrigatório para captura de tela.
- **TURN** — opcional, só para alunos fora da rede local (ADR 0005). Na LAN, modo primário, não é usado.

## Comandos

```bash
# Instalar dependências de todos os apps e packages
npm install

# Subir backend (8080), web do aluno (Vite, 5173) e app desktop em modo dev,
# com chave de host aleatória (scripts/dev.js)
npm run dev

# Testes de todos os workspaces
npm test

# Build para produção
npm run build
```

## Distribuição do App Desktop

O `electron-builder` gera os instaladores em `apps/desktop/dist/`:

```bash
npm run make:win     # MLab-Setup-<versão>.exe
npm run make:linux   # MLab-Linux-<versão>.AppImage e .deb
npm run make:mac     # MLab-Mac-<versão>.dmg
```

## Variáveis de ambiente (apps/backend)

Nenhuma é obrigatória no app instalado: o processo principal do desktop gera `MLAB_HOST_KEY` a cada execução e o
backend gera `JWT_SECRET` aleatório quando ele não é informado (ADR 0006).

```env
# Rodando o backend fora do app (desenvolvimento)
MLAB_HOST_KEY=<chave de host da execução>

# Opcionais
PORT=8080
WEB_PORT=8080
PUBLIC_URL=        # ou BASE_URL / NGROK_URL, para links fora da LAN
STUN_URL=
TURN_URL=          # TURN opcional (ADR 0005)
TURN_SECRET=
```
