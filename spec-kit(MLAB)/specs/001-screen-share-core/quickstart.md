# Quickstart: Transmissão de Tela em Sala

Feature: `001-screen-share-core`
Status: DRAFT

A execução de referência estará disponível após T005 (revalidação) e geração das tarefas de implementação (T006+).

## Pré-requisitos

### Ferramentas de desenvolvimento

- **Node.js** ≥ 20 LTS — para Turborepo, apps/desktop e apps/web.
- **npm** ≥ 10 — gerenciador de pacotes do workspace.
- **Go** ≥ 1.22 — para apps/backend.
- **Git** — controle de versão.

### Banco de dados

- **PostgreSQL** ≥ 15 — pode ser executado via Docker para desenvolvimento local.

### Infraestrutura WebRTC

- **Suporte do navegador/Electron a `getDisplayMedia()`** — obrigatório para captura de tela.
- **Servidor TURN (coturn)** — obrigatório para testes com alunos em redes externas. Em rede local pode ser omitido.

## Comandos esperados (pós-scaffold)

```bash
# Instalar dependências de todos os apps e packages
npm install

# Executar todos os apps em modo dev (via Turborepo)
npm run dev

# Executar apenas o backend
turbo run dev --filter=backend

# Executar apenas o web app
turbo run dev --filter=web

# Executar apenas o app desktop
turbo run dev --filter=desktop

# Build para produção
turbo run build
```

## Distribuição do App Desktop

Após build, o `electron-builder` gera os instaladores:

```bash
cd apps/desktop
npm run make
# Gera: dist/win/ScreenShare-Setup.exe
#        dist/mac/ScreenShare.dmg
#        dist/linux/ScreenShare.AppImage
```

## Variáveis de Ambiente necessárias (apps/backend)

```env
JWT_SECRET=<chave_secreta_longa>
DATABASE_URL=postgres://user:pass@localhost:5432/screenshare
TURN_SECRET=<segredo_turn>
TURN_HOST=turn.seuservidor.com
ROOM_MAX_PARTICIPANTS=50
```
