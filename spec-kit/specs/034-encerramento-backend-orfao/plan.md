# Plan: Encerramento Completo do App e do Backend Embarcado

Feature: `034-encerramento-backend-orfao`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md`
Research: `./research.md`
Contracts: `./contracts/backend-embarcado.md`

## 1. Summary

```text
apps/desktop/src/main
├── backendManager.ts (novo)      inicia/vigia/encerra o backend; trata órfãos; diagnóstico Windows
│     deps injetadas: spawn, spawnSync, fetchHealth, execText, isProcessAlive, killPid, log
└── main.ts
      ├── requestSingleInstanceLock + second-instance           (RF-3410)
      ├── janela principal 'closed' → libera overlay/cursor;
      │     Windows/Linux → app.quit()                           (RF-3401, RF-3402)
      ├── shutdown(reason) único e idempotente                   (RF-3403)
      │     closeActiveRoomGracefully → overlay/cursor → backend.stop() → app.exit(0)
      │     timeout global 8 s → backend.forceKillSync()         (RF-3405)
      ├── before-quit / SIGINT / SIGTERM → shutdownAndExit
      ├── session-end (Windows) / will-quit / exit → forceKillSync (síncrono)
      └── window-all-closed: macOS mantém o backend (C-3403)

apps/backend/cmd/server
├── lifecycle.go (novo)            watchdog stdin EOF + PID do pai; log tolerante
├── lifecycle_windows.go (novo)    espera no handle do processo pai
├── lifecycle_unix.go (novo)       PPID mudou ⇒ pai morreu
└── main.go                        http.Server + Shutdown(3 s) + StopMDNSServer; sinais; watchdog

Empacotamento
├── scripts/build-backend.js, apps/*/package.json     nomes mlab-backend*    (RF-3411)
└── apps/desktop/installer/installer.nsh (novo)       customInit/customUnInit (RF-3412)
```

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Linguagem | TypeScript (main do Electron), Go (backend), NSIS | — |
| Sinal "app morreu" | pipe de stdin com leitura até EOF + vigilância do PID do pai | RF-3407 |
| Encerramento do backend | stdin fechado → 2 s → forçado e aguardado | RF-3404 |
| Encerramento do app | `shutdown()` único; `app.exit(0)` no fim (não reemite `before-quit`) | RF-3403 |
| Timeout global | 8 s | RF-3405 |
| Dono da porta 8080 | Windows: `netstat -ano` + `tasklist`; outros SO: só log | C-3401 (B) |
| Janela principal | fechá-la encerra o app no Windows/Linux | C-3402 (A) |
| macOS | backend continua com o app no Dock; Cmd+Q encerra | C-3403 (A) |
| Instância única | `app.requestSingleInstanceLock()` | RF-3410 |
| Logs | `mlab-main.log` (existente) + `mlab-backend.log` (`MLAB_LOG_FILE`) | C-3406 |
| Testes | vitest (módulo com deps injetadas), Go (watchdog, processo auxiliar), manual Windows | C-3407 |
| Persistência | nenhuma (ADR 0005) | — |

## 3. Architecture

### 3.1 Backend (`cmd/server`)

- `main()` monta o `http.Server` com o `handler` atual de `newServer` (sem mudar rotas), inicia `ListenAndServe` em
  goroutine e espera o primeiro de: erro do servidor, sinal (`SIGINT`/`SIGTERM`) ou watchdog.
- Watchdog (só com `MLAB_PARENT_WATCHDOG=1`): goroutine lendo `os.Stdin` até erro/EOF; vigilância do PID
  (`os.FindProcess` + `Wait` no Windows; comparação de `os.Getppid()` no Unix, a cada 1 s). O primeiro motivo vence.
- Encerramento gracioso: `srv.Shutdown(ctx 3 s)`, `srv.Close()` se estourar; `room.StopMDNSServer()` (função
  existente, chamada sem editar `internal/`); log do motivo e duração.
- `SIGPIPE` ignorado no Unix (`lifecycle_unix.go`): com stdout/stderr em pipe, a morte do app não pode derrubar o
  backend na próxima escrita de log antes do encerramento gracioso e do registro em arquivo (RF-3414).
- Com arquivos novos no pacote `main`, o script `dev` do backend passa a ser `go run ./cmd/server` (o atual
  `go run ./cmd/server/main.go` deixaria de compilar).
- Log: com `MLAB_LOG_FILE`, `log.SetOutput` para um escritor que grava no arquivo e no stderr, ignorando falha de um
  deles.

### 3.2 Desktop (`src/main`)

- `BackendManager` (novo):
  - `start()`: aborta se o encerramento começou (antes e depois de cada `await`, e imediatamente antes do `spawn`);
    consulta `/health`; se ocupado, resolve o dono da porta (C-3401) e encerra só backend do MLab; inicia com
    `stdio: ['pipe','pipe','pipe']` e o ambiente do contrato.
  - `stop()`: sequência do contrato (RF-3404), aguardando o `exit`.
  - `forceKillSync()`: `spawnSync('taskkill' …)` no Windows / `SIGKILL` no Unix, para `exit`, `session-end`, timeout.
  - `logProcessSnapshot()` (Windows): lista `mlab-backend.exe`/`server.exe` via `tasklist`, sem bloquear a partida.
  - funções puras exportadas: `parseNetstatListeningPid`, `parseTasklistCsv`.
- `main.ts`: substitui `isPortInUse`, `startBackendServer`/`stopBackendServer` e os quatro pontos de
  `stopBackendServer()` pelo procedimento único. `closeActiveRoomGracefully` é reutilizada sem mudança de
  comportamento. `set-active-room` ignora reativação depois que o encerramento começou.

### 3.3 Empacotamento

- `build-backend.js`: `mlab-backend.exe`, `mlab-backend-linux`, `mlab-backend-darwin` (+ cópia `mlab-backend`).
- `apps/desktop/package.json`: `extraResources` com os nomes novos; `nsis.include: "installer/installer.nsh"`.
- `installer.nsh`: macro que, se `tasklist | find MLab.exe` falhar (app fechado), executa `taskkill /F /T /IM
  mlab-backend.exe` e um `Stop-Process` do PowerShell filtrado pelo caminho `<pasta>\resources\bin\server.exe` com
  `MLab.exe` em `<pasta>`; `Sleep 500`.

## 4. Data Model

Nenhum. Estado só em memória no main (`BackendManager`, flag de encerramento).

## 5. Contracts

- `contracts/backend-embarcado.md` (novo, interno): deve estar `Status: READY` antes da T3401.
- Nenhum contrato existente muda. `003/contracts/desktop-ipc.md` (`set-active-room`) mantém a assinatura.

## 6. Security

- O app só encerra processos reconhecidos como backend do MLab: o filho que ele mesmo iniciou (por PID), ou o dono da
  8080 com imagem `mlab-backend.exe`/`server.exe` (Windows). Programa de terceiros na 8080 nunca é encerrado.
- O instalador restringe o `server.exe` legado ao caminho da instalação do MLab.
- `MLAB_HOST_KEY` e `JWT_SECRET` continuam só no ambiente do processo; os logs novos registram nomes de etapas, PIDs e
  durações, nunca o ambiente.
- Nenhuma rota, autenticação ou autorização muda.

## 7. Performance and Observability

- Sem meta de desempenho de mídia. Tempos do encerramento (alvo, não fato): backend gracioso ≤ 2 s; total ≤ 8 s;
  watchdog ≤ 3 s após a morte do app. Medidos pelos próprios logs (duração por etapa) e pelo teste Go do watchdog.
- Partida: o diagnóstico `tasklist` roda em paralelo e não atrasa o `spawn`.

## 8. Dependencies

- Nenhuma nova. Go stdlib (`os/signal`, `context`, `net/http`), Node `child_process`, Electron (APIs já usadas), NSIS
  `nsExec` e `LogicLib` (incluídos pelo electron-builder), ferramentas do Windows (`taskkill`, `tasklist`, `netstat`,
  PowerShell 5.1).

## 9. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| `app.exit()` pula handlers que hoje dependem de `will-quit` | recurso não liberado | o `shutdown()` libera overlay, cursor e backend antes; `will-quit`/`exit` ficam como rede de segurança síncrona |
| Fechar a janela principal encerra o app quando um diálogo nativo estiver aberto | perda do diálogo de salvar gravação | diálogo é modal à janela principal; comportamento atual é o mesmo (`window-all-closed`) |
| Trava de instância única em dev (dois apps de teste) | segunda instância fecha | documentado; em dev o backend é externo e uma instância basta |
| Script NSIS não compilado no CI Linux/macOS | erro só no build Windows | CI `windows-latest` já empacota NSIS; T3408 exige build Windows verde |
| PowerShell indisponível ou bloqueado por política | `server.exe` legado não encerrado no instalador | `-ExecutionPolicy Bypass` só no comando; falha não interrompe a instalação; RF-3409 cobre na partida do app |
| Antivírus estranhar `taskkill`/PowerShell no instalador | alerta | comandos restritos a nomes/caminhos do MLab; registrar no converge se ocorrer |
| `netstat` localizado (ex.: "ESCUTANDO") | PID não encontrado | parser aceita `LISTENING` e `ESCUTANDO`; sem PID ⇒ trata como terceiro (não encerra) |
| PID do pai reutilizado no Unix | watchdog não dispara | vigilância por PPID (não por PID); stdin EOF é o sinal primário |
| Conflito com features abertas que tocam `main.ts` (032) | conflito de merge | mudanças concentradas em blocos próprios; rebase de quem entrar depois |

## 9a. Impacto de versão previsto

**PATCH** (C-3401 B, C-3407): correção de comportamento sem capacidade nova nem mudança de contrato público. O contrato
novo é interno entre processos do mesmo pacote.

## Scope Lock

### IN

- encerramento do app ao fechar a janela principal (overlay, cursor, atalhos);
- procedimento único de encerramento com timeout;
- gestão do processo do backend (partida, encerramento aguardado, órfãos, corrida);
- watchdog e encerramento gracioso no backend;
- instância única;
- logs de diagnóstico do ciclo de vida;
- renomeação do binário;
- script NSIS de órfãos;
- documentação: esta feature, README (seção de solução de problemas e nome do binário), `smoke-runbook.md`;
- incremento de versão.

### OUT

- rotas HTTP/WebSocket, autenticação, `/health` (com C-3401 B);
- renderer (`src/renderer/**`), preload e IPC;
- comportamento interno do overlay (marcação, lupa, barra) além de ser encerrado;
- `apps/backend/internal/**` (só chamadas a funções existentes);
- interface para conflito de porta; atualização automática.

### Allowed Paths

- `apps/backend/cmd/server/main.go`, `apps/backend/cmd/server/lifecycle*.go`,
  `apps/backend/cmd/server/lifecycle_test.go`
- `apps/backend/package.json` (script `dev` na T3401; nome do binário no script `build` na T3407)
- `apps/desktop/src/main/main.ts`, `apps/desktop/src/main/backendManager.ts`,
  `apps/desktop/src/main/backendManager.test.ts`
- `apps/desktop/package.json` (`extraResources`, `nsis.include`), `apps/desktop/installer/installer.nsh`
- `scripts/build-backend.js`, `scripts/dev.js` (só comentário)
- `README.md`, `docs/metrics/smoke-runbook.md`
- `spec-kit/specs/034-encerramento-backend-orfao/**`
- só na T3409, via `npm run bump`: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`

### Prohibited Paths

- `apps/backend/internal/**`
- `apps/desktop/src/renderer/**`, `apps/desktop/src/main/preload.ts`,
  `apps/desktop/src/main/annotationOverlayWindow.ts`, `apps/desktop/src/main/cursorPresence.ts`
- `apps/web/**`, `packages/**` (fora do bump)
- `spec-kit/specs/**` de outras features, `spec-kit/docs/adrs/**`, `docs/requirements/**`
- `.github/**`

### Dependencies

- Nenhuma nova (seção 8).

### Non-Goals

- E2E automatizado do Electron no Windows;
- diálogo para o professor quando a 8080 estiver ocupada por terceiros;
- identificação de órfãos por SO no Linux/macOS (C-3401 B);
- mudar a convenção do macOS (C-3403 A).

## 11. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: nenhuma autorização muda; chave de host intocada; app não encerra processos de terceiros.
- [x] Princípio III: SFU intocada.
- [x] Princípio IV: tempos tratados como alvo, medidos por log e teste.
- [x] Princípio V: contrato interno novo `contracts/backend-embarcado.md`; nenhum contrato público muda (C-3401 B).
- [x] Princípio VI: Scope Lock e paths por tarefa.
- [x] Princípio VII: um módulo novo com consumidor real (`main.ts`) e dependências injetadas por testabilidade.
- [ ] Princípio VIII: converge ao final (T3409).
- [x] Princípio IX: nenhum desvio encontrado na análise (testes Go verdes na base).
- [x] Princípio X: branch `fix/encerramento-backend-orfao` a partir da `development` @ `d1b4886`.

## 12. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-15 | Renomear o binário para `mlab-backend` | C-3404 |
| 2026-11-15 | Script NSIS encerra órfãos só com o MLab fechado | C-3405 |
| 2026-11-15 | Logs `mlab-main.log` + `mlab-backend.log` | C-3406 |
| 2026-11-15 | Testes sem E2E Electron; IDs `340x`; PATCH | C-3407 |
| 2026-11-15 | Dono da porta 8080 sem mudar `/health` | C-3401 |
| 2026-11-15 | Janela principal encerra o app | C-3402 |
| 2026-11-15 | macOS mantém o backend com o app no Dock | C-3403 |
| 2026-11-15 | Script `dev` do backend vira `go run ./cmd/server`; `SIGPIPE` ignorado no Unix | analyze (revalidação) |
