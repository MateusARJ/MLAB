# Tasks: Encerramento Completo do App e do Backend Embarcado

Feature: `034-encerramento-backend-orfao`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: READY

Regras:
- backend: `go test ./...`, `go vet ./...` e `gofmt -l` vazio em `apps/backend` antes de marcar `[x]`;
- desktop: `npm test` e `npm run lint` (`tsc --noEmit`) em `apps/desktop` verdes antes de marcar `[x]`;
- um commit atômico por task, com `Ref: T340x`;
- desvio fora do escopo vira issue (`AGENTS.md` §14).

### T3401 — Backend: watchdog do processo pai e encerramento gracioso
[x] T3401 [US-3402] [US-3405]
Allowed Paths: `apps/backend/cmd/server/main.go`, `apps/backend/cmd/server/lifecycle.go`,
`apps/backend/cmd/server/lifecycle_windows.go`, `apps/backend/cmd/server/lifecycle_unix.go`,
`apps/backend/cmd/server/lifecycle_test.go`, `apps/backend/package.json` (só o script `dev`)
Prohibited Paths: `apps/backend/internal/**`, `apps/desktop/**`, `apps/web/**`, `packages/**`, `scripts/**`,
`package.json` (raiz)
Checks:
- [x] Com `MLAB_PARENT_WATCHDOG=1`, EOF no stdin dispara o encerramento gracioso (RF-3407a): teste com `io.Pipe`.
- [x] Pai inexistente dispara; pai vivo não dispara (RF-3407b): testes com PID inválido e `os.Getppid()`.
- [x] Teste com processo auxiliar (binário de teste reexecutado): pai morto com `Kill` ⇒ filho sai em até 3 s.
- [x] `SIGINT`/`SIGTERM` e watchdog levam a `Shutdown` com timeout de 3 s e `room.StopMDNSServer()` (RF-3408).
- [x] `MLAB_LOG_FILE`: escrita no arquivo continua com stdout/stderr quebrado (RF-3414); nenhum segredo logado.
- [x] Sem `MLAB_PARENT_WATCHDOG`, a partida e as rotas não mudam; `/health` idêntico (RNF-3405); smoke do backend
  verde.
- [x] `GOOS=windows go vet ./cmd/server` e `GOOS=darwin go vet ./cmd/server` verdes.
- [x] Script `dev` do backend (`go run ./cmd/server`) compila com os arquivos novos; `SIGPIPE` ignorado no Unix.

### T3402 — Desktop: módulo de gestão do processo do backend
[x] T3402 [US-3401] [US-3403]
Depends On: T3401 (contrato do processo)
Allowed Paths: `apps/desktop/src/main/backendManager.ts`, `apps/desktop/src/main/backendManager.test.ts`
Prohibited Paths: `apps/desktop/src/main/main.ts`, `apps/desktop/src/main/preload.ts`, `apps/desktop/src/renderer/**`,
`apps/backend/**`, `apps/web/**`, `packages/**`, `package.json`
Checks:
- [x] `start()` inicia com `stdio` em pipe e o ambiente de `contracts/backend-embarcado.md`.
- [x] `start()` não chama `spawn` se o encerramento começar durante a checagem da porta (RF-3406).
- [x] `stop()`: saída voluntária após fechar o stdin; Windows força `taskkill /pid <pid> /f /t` síncrono; Unix envia
  `SIGTERM` e depois `SIGKILL` (RF-3404).
- [x] Porta ocupada (C-3401 B, Windows): `mlab-backend.exe`/`server.exe` encerrado e porta aguardada; imagem de
  terceiros não encerrada; Linux/macOS só registram (RF-3409).
- [x] `parseNetstatListeningPid` (inclui `ESCUTANDO`) e `parseTasklistCsv` testados.
- [x] `stop()` antes de `start()` impede partidas futuras.

### T3403 — Desktop: procedimento único de encerramento
[x] T3403 [US-3401] [US-3402]
Depends On: T3402
Allowed Paths: `apps/desktop/src/main/main.ts`
Prohibited Paths: `apps/desktop/src/main/annotationOverlayWindow.ts`, `apps/desktop/src/main/cursorPresence.ts`,
`apps/desktop/src/main/preload.ts`, `apps/desktop/src/renderer/**`, `apps/backend/**`, `packages/**`, `package.json`
Checks:
- [x] `isPortInUse`, `startBackendServer`/`stopBackendServer` antigos substituídos pelo `BackendManager`.
- [x] `shutdown(reason)` idempotente: sala ativa → overlay/cursor → `backend.stop()` → `app.exit(0)` (RF-3403).
- [x] `before-quit`, `SIGINT`, `SIGTERM` usam o procedimento; timeout de 8 s com `forceKillSync()` (RF-3405).
- [x] `session-end` (Windows), `will-quit` e `process 'exit'` só chamam `forceKillSync()` (síncrono).
- [x] `set-active-room` ignora reativação durante o encerramento.
- [x] Modo dev (`MLAB_DEV_MONOREPO`/`turbo.json`) continua sem iniciar backend.

### T3404 — Desktop: fechar a janela principal encerra overlay e app
[x] T3404 [US-3401]
Depends On: T3403
Allowed Paths: `apps/desktop/src/main/main.ts`
Prohibited Paths: `apps/desktop/src/main/annotationOverlayWindow.ts`, `apps/desktop/src/main/preload.ts`,
`apps/desktop/src/renderer/**`, `apps/backend/**`, `packages/**`, `package.json`
Checks:
- [x] `closed` da janela principal chama `annotationOverlayManager.stop()` e `cursorPresenceTracker.stop()` (RF-3401).
- [x] Windows/Linux: `closed` da janela principal chama `app.quit()` mesmo com o overlay aberto (RF-3402, C-3402).
- [x] macOS: `window-all-closed` não encerra o backend; `activate` reabre a janela com o backend vivo (C-3403).
- [x] Verificação manual (Windows): transmissão com overlay aberto, fechar pelo X ⇒ nenhum `MLab.exe` restante.

### T3405 — Desktop: instância única
[x] T3405 [US-3404]
Depends On: T3403
Allowed Paths: `apps/desktop/src/main/main.ts`
Prohibited Paths: `apps/desktop/src/main/preload.ts`, `apps/desktop/src/renderer/**`, `apps/backend/**`,
`packages/**`, `package.json`
Checks:
- [x] `requestSingleInstanceLock()` antes de `whenReady`; sem trava ⇒ `app.quit()` sem criar janela nem backend.
- [x] `second-instance` restaura (se minimizada), mostra e foca a janela principal (RF-3410).

### T3406 — Desktop: logs de diagnóstico do ciclo de vida
[x] T3406 [US-3405]
Depends On: T3403
Allowed Paths: `apps/desktop/src/main/main.ts`, `apps/desktop/src/main/backendManager.ts`,
`apps/desktop/src/main/backendManager.test.ts`
Prohibited Paths: `apps/desktop/src/renderer/**`, `apps/backend/**`, `packages/**`, `package.json`
Checks:
- [x] `mlab-main.log` registra os itens de RF-3413 (PID/versão, resultado da partida, dono da 8080, processos no
  Windows, etapas do encerramento com duração, código de saída do backend).
- [x] `MLAB_LOG_FILE` aponta para `<userData>/logs/mlab-backend.log` (RF-3414).
- [x] Teste: o diagnóstico `tasklist` não atrasa o `spawn`; nenhum log contém `MLAB_HOST_KEY`/`JWT_SECRET`.

### T3407 — Build: renomeia o binário do backend
[x] T3407 [US-3406]
Depends On: T3403
Allowed Paths: `scripts/build-backend.js`, `scripts/dev.js`, `apps/backend/package.json`,
`apps/desktop/package.json`, `apps/desktop/src/main/main.ts`, `apps/backend/cmd/server/main.go`, `README.md`
Prohibited Paths: `apps/backend/internal/**`, `apps/desktop/src/renderer/**`, `apps/web/**`, `packages/**`,
`.github/**`
Checks:
- [x] Build gera `mlab-backend.exe`, `mlab-backend-linux`, `mlab-backend-darwin`; `extraResources` copiam para
  `bin/mlab-backend(.exe)` (RF-3411).
- [x] Resolução do binário no app procura os nomes novos e, por último, os legados com aviso no log.
- [x] `git grep "server\.exe\|server-linux\|server-darwin"` só encontra os nomes legados intencionais e specs antigas.
- [x] `npm run make:linux` (CI) empacota com o nome novo (verificado localmente via WSL: `resources/bin/mlab-backend`).

### T3408 — Build: instalador NSIS encerra backends órfãos
[x] T3408 [US-3406]
Depends On: T3407
Allowed Paths: `apps/desktop/installer/installer.nsh`, `apps/desktop/package.json`
Prohibited Paths: `apps/desktop/src/**`, `apps/backend/**`, `.github/**`, `packages/**`
Checks:
- [x] `nsis.include` aponta para `installer/installer.nsh`; macros `customInit` e `customUnInit` (RF-3412).
- [x] Nada é encerrado quando `MLab.exe` está em execução.
- [x] `server.exe` só é encerrado em `<pasta>\resources\bin\server.exe` com `MLab.exe` em `<pasta>`.
- [x] Build `make:win` verde (compila o NSIS): verificado localmente no Windows; o CI `windows-latest` só roda no PR para a `main`.

### T3409 — Verificação, documentação, converge e versão
[x] T3409
Depends On: T3401–T3408
Allowed Paths: `spec-kit/specs/034-encerramento-backend-orfao/**`, `README.md`, `docs/metrics/smoke-runbook.md`,
`package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`
Prohibited Paths: `apps/**/src/**`, `packages/**/src/**`, `apps/backend/**/*.go`, `.github/**`
Checks:
- [x] Matriz manual no Windows (instalador NSIS) registrada no `converge.md`:
  | Cenário | Esperado |
  |---|---|
  | fechar pelo X, sem sala | nada restante no Gerenciador de Tarefas |
  | fechar pelo X na transmissão (overlay aberto) | alunos avisados; nada restante |
  | abrir e fechar em < 1 s | nenhum `mlab-backend.exe` restante |
  | finalizar `MLab.exe` no Gerenciador de Tarefas | `mlab-backend.exe` some em ≤ 3 s |
  | abrir o MLab duas vezes | janela existente ganha foco |
  | `server.exe` 1.15.x órfão + abrir o app novo | órfão encerrado; professor entra |
  | `server.exe` órfão + instalar por cima | sem "arquivo em uso" |
  | logoff do Windows com o MLab aberto | nada restante após novo login |
- [x] README: nome do binário e, em "Solução de problemas", onde ficam `mlab-main.log`/`mlab-backend.log`.
- [x] `smoke-runbook.md:26` atualizado (o app encerra órfãos sozinho; instrução vira verificação).
- [x] `converge.md` com evidências, desvios e impacto de versão (PATCH, C-3407).
- [ ] `npm run bump -- patch` e `npm run version:check`; commit `chore(release): versao X.Y.Z`.
- [x] `npm run spec:check -- spec-kit/specs/034-encerramento-backend-orfao` com PASS.

## Definition of Done da feature

- [x] Todos os testes/checks passaram
- [x] Scope Lock respeitado
- [x] Contrato `backend-embarcado.md` em READY e sincronizado com o código
- [x] Analyze pós-tasks = PASS
- [x] Convergência registrada
