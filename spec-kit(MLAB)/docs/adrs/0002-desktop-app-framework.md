# ADR 0002 — Framework do App Desktop do Professor: Electron

Status: APROVADA
Data: 2026-09-11
Feature impactada: `001-screen-share-core`

## Contexto

O professor precisa de um app desktop instalável (Windows, macOS, Linux) para fazer login,
criar salas, transmitir a tela e usar o microfone. Era necessário escolher o framework
que melhor atende esses requisitos, especialmente a captura de tela com qualidade e
integração com WebRTC.

## Alternativas Consideradas

### 1. Electron (escolhida)
- **Prós:**
  - Chromium embutido: `desktopCapturer` e WebRTC nativos, maduros e bem testados.
  - Stack React + TypeScript idêntico ao `apps/web/`, maximizando reutilização via `packages/`.
  - Build multiplataforma (Windows `.exe`, macOS `.dmg`, Linux `.AppImage`) via `electron-builder`.
  - `electron-vite` como build tool integra-se naturalmente com o Turborepo.
  - Ampla documentação e ecossistema.
- **Contras:**
  - Binário pesado (~150–200 MB) devido ao Chromium embutido.
  - Consumo de memória ligeiramente maior que alternativas com WebView do sistema.

### 2. Tauri
- **Prós:** binário leve (~10 MB); usa WebView do sistema operacional.
- **Contras:** WebView varia por OS (Edge/WebKit/WebKitGTK — comportamentos distintos); captura de tela via plugin ainda menos madura; backend em Rust (stack diferente do Go do backend principal).

### 3. Wails
- **Prós:** Go no backend do desktop + WebView no frontend; alinhado com o stack Go do backend.
- **Contras:** projeto menos maduro; suporte a screen capture ainda limitado; WebView do sistema com as mesmas variações do Tauri.

## Decisão

**Electron** com as seguintes escolhas de stack:

| Camada | Tecnologia |
|---|---|
| Build tool | `electron-vite` |
| Main process | TypeScript + Node.js |
| Renderer process | React + TypeScript |
| Screen capture | `desktopCapturer` (Electron API) via IPC |
| Distribuição | `electron-builder` |
| Integração monorepo | via `apps/desktop/package.json` no workspace Turborepo |

O peso do binário (~150 MB) é aceitável: o app é instalado uma única vez pelo professor
e não pelos alunos, que usam apenas o navegador web.

## Impactos

- `apps/desktop/` adicionado ao monorepo com `electron-vite` como build tool.
- O main process acessa `desktopCapturer` e expõe ao renderer via IPC seguro (contextBridge).
- O renderer usa a mesma lógica WebRTC dos hooks de `packages/` compartilhados com `apps/web/`.
- Novo Allowed Path em todas as specs: `apps/desktop/**`.
- CI deve incluir build do Electron para as três plataformas em estágios separados.
