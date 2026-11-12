# Contract: IPC do App Desktop

Status: READY
Feature: `003-classroom-interaction` (canais da 001 incluídos para manter um único inventário)

## Producer / Consumer

- Producer: processo principal do Electron (`apps/desktop/src/main/*.ts`).
- Ponte: `apps/desktop/src/main/preload.ts` via `contextBridge.exposeInMainWorld('electronAPI', ...)`.
- Consumer: renderer (`apps/desktop/src/renderer/**`). O renderer nunca acessa APIs do Electron/Node diretamente (AGENTS.md §6 e §8).

## Renderer → Main (`ipcRenderer.invoke`)

| API em `window.electronAPI` | Canal | Origem | Descrição |
|---|---|---|---|
| `getScreenSources(type?)` | `get-screen-sources` | 001/T022 | Fontes `screen` ou `window` com thumbnail |
| `saveRecordedVideo(buffer, defaultName, format)` | `save-recorded-video` | 001/T022 | Diálogo nativo e gravação em disco do arquivo da gravação local |
| `setActiveRoom(room \| null)` | `set-active-room` | 001 | Informa a sala ativa ao main (encerramento ao fechar o app) |
| `setContentProtection(enabled)` | `set-content-protection` | 003/US-21 | Liga/desliga a proteção de conteúdo da janela |
| `captureWindowToClipboard()` | `capture-window-to-clipboard` | 003/US-21 | Copia captura da janela transmitida |
| `startCursorTracking(target)` / `stopCursorTracking()` | `cursor-tracking:start` / `cursor-tracking:stop` | 003/US-20 | Rastreamento de cursor e janela |
| `startAnnotationOverlay()` / `stopAnnotationOverlay()` | `annotation-overlay:start` / `annotation-overlay:stop` | 003/US-19 | Janela de overlay de anotação |
| `syncAnnotationState(state)` | `annotation-overlay:sync-state` | 003/US-19 | Sincroniza ferramentas e traços |
| `setAnnotationOverlayIgnoreMouse(ignore)` | `annotation-overlay:set-ignore-mouse` | 003/US-19 | Overlay transparente a cliques |
| `setAnnotationToolbarRect(rect \| null)` | `annotation-overlay:toolbar-rect` | 009/RF-902 | Retângulo da barra (`AnnotationToolbarRect`, px CSS do overlay) para o hit-test do Linux. Aceito só do webContents do overlay; valores inválidos viram `null`. Em vigor desde 009 (T901) |
| `setAnnotationRaisedHands(count)` | `annotation-overlay:raised-hands` | 017/RF-179 | Quantidade de mãos levantadas (inteiro ≥ 0) enviada pela janela do MLab à barra de marcação. Só o número; sem dados de participantes. Descartado quando vem do webContents do overlay ou quando não é inteiro ≥ 0. O main guarda o último valor e o reenvia quando o overlay é (re)criado; `annotation-overlay:stop` volta a 0. Em vigor desde 017 (T171) |
| `copyToClipboard(text)` | `write-clipboard-text` | 001 / 002/S7 | Copia texto (link da sala). Escrita feita no main desde 002/S7 (T207); a API exposta não mudou |
| `getHostKey()` | `get-host-key` | 002/S2 | Retorna `MLAB_HOST_KEY` da execução para o header da sessão do professor (ADR 0006). Em vigor desde 002/S2 (T202) |
| `getAppInfo()` | `get-app-info` | 021/RF-2101 | Sem parâmetros. Retorna `AppInfo` (`packages/types`): `name`, `version` (`app.getVersion()`), `description` e `copyright` (lido de `build.copyright` do `apps/desktop/package.json`, o mesmo texto do executável), para o rodapé e o diálogo "Sobre". Sem dado sensível. Em vigor desde 021 (T2101) |

## Main → Renderer (`webContents.send` / `ipcRenderer.on`)

| API (assinatura) | Canal | Descrição |
|---|---|---|
| `onActiveWindowChanged(cb)` | `active-window-changed` | `{ sourceId }` da janela ativa |
| `onActiveWindowUnauthorized(cb)` | `active-window-unauthorized` | `{ isUnauthorized }` — janela transmitida encoberta/não autorizada |
| `onCursorState(cb)` | `cursor-state` | `CursorState` (`packages/types`) |
| `onAnnotationStateSync(cb)` | `annotation-overlay:state` | `AnnotationSessionState` |
| `onAnnotationShortcutCommand(cb)` | `annotation-overlay:shortcut` | `AnnotationShortcutCommand` (atalhos globais e duplo Ctrl) |
| `onAnnotationRaisedHands(cb)` | `annotation-overlay:raised-hands` | `number` — quantidade de mãos levantadas; enviado só ao overlay (017/RF-171, desde T171) |

Todas as funções `on*` retornam uma função de cancelamento da inscrição.

## Regras

- Tipos de payload vêm de `packages/types` (`CaptureSource`, `CursorState`, `AnnotationSessionState`, `AnnotationShortcutCommand`, `AppInfo`).
- Novo canal exige atualização deste contrato e da interface `ElectronAPI` em `preload.ts`.
- `getHostKey` nunca é exposto fora do renderer do app (não vai para logs, UI ou rede, exceto o header `X-MLab-Host-Key` para o backend local).
