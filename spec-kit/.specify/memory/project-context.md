# Contexto do Projeto

## Objetivo

Construir uma plataforma de sala de aula em que um professor compartilha a própria tela
e o áudio ao vivo com pelo menos 40 alunos, priorizando boa qualidade visual, FPS estável
e baixa latência.

## Clientes

### App Desktop do Professor (apps/desktop)

- Framework: Electron + React + TypeScript.
- Build tool: electron-vite.
- Distribuição: electron-builder (Windows .exe, macOS .dmg, Linux .AppImage).
- Funcionalidades: entrada por nome (sem login — ADR 0006), criação de sala, compartilhamento de tela, transmissão de áudio, gravação local.
- O professor deve baixar e instalar o aplicativo para poder transmitir.

### Web App dos Alunos (apps/web)

- Framework: React + TypeScript + Vite.
- Acesso via navegador, sem instalação.
- Design responsivo: foco em desktop (1280px+), mobile (< 768px) funcional.
- Funcionalidades: identificação por Nome + Matrícula, acesso por link único, assistir à transmissão, chat de texto.

## Estrutura do Repositório

Monorepo gerenciado pelo Turborepo (ref: ADR 0001).

```text
mlab/
├── turbo.json
├── package.json
├── apps/
│   ├── desktop/    ← Electron (professor)
│   ├── web/        ← React + Vite (alunos)
│   └── backend/    ← Go (API + SFU)
└── packages/
    ├── types/      ← DTOs TypeScript compartilhados
    └── ui/         ← Componentes React compartilhados (opcional)
```

## Decisões-base

- Frontend professor: Electron + React + TypeScript (ref: ADR 0002).
- Frontend alunos: React + TypeScript + Vite (responsivo).
- Backend: Go.
- Transporte de mídia: WebRTC.
- Topologia de mídia: SFU.
- Implementação inicial da SFU: Pion WebRTC.
- Sinalização e APIs de controle: Go + HTTP/WebSocket.
- Autenticação: JWT (Nome + Matrícula para aluno; credenciais para professor).
- Persistência: nenhuma — estado em memória por execução do backend embarcado (ADR 0005).
- Repositório: Monorepo com Turborepo.
- Limite inicial de participantes: 50 (configurável).
- Operação: rede local offline como modo primário; TURN opcional para uso fora da LAN (ADR 0005).

## Não-objetivos iniciais

- câmera do professor ou dos alunos;
- microfone dos alunos;
- gravação ou retenção de mídia no servidor (a gravação local opcional pelo professor está no escopo — US-10);
- transcodificação por aluno;
- conferência multi-câmera;
- compartilhamento de arquivos por alunos (o envio pelo professor está em `003-classroom-interaction`);
- integração com banco de dados da instituição (versão futura).

Esses itens só entram mediante novas specs e aprovação.
