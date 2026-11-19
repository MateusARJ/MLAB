# Contract: IPC `backend:status`

Status: READY

## Purpose

Informar a janela do professor sobre o estado do backend embarcado, para que o renderer retome a aula depois de um
reinício (053/RF-5304).

## Producer

`apps/desktop/src/main/main.ts`, a partir dos eventos do `BackendManager`.

## Consumer

`apps/desktop/src/renderer/` (via `window.electronAPI.onBackendStatus`, exposto pelo preload com `contextBridge`).

## Transport

Electron IPC, main → renderer: `webContents.send('backend:status', status)`.

## Request / Message

```ts
type BackendStatus = 'down' | 'restarting' | 'up' | 'failed'
```

| Status | Quando |
|---|---|
| `down` | o processo saiu sem pedido (RF-5301) ou foi encerrado por travamento (RF-5302) |
| `restarting` | um reinício começou (RF-5303) |
| `up` | o backend reiniciado respondeu ao `/health` |
| `failed` | limite de reinícios atingido ou a partida falhou (RF-5303) |

Nenhum dado além do status. Não há token, chave nem PID.

## Preload

```ts
onBackendStatus: (callback: (status: BackendStatus) => void) => () => void // devolve a função de remoção
```

## Compatibilidade

Canal novo; nenhum canal existente muda. Um renderer antigo ignora o canal.
