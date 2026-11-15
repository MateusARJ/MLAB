# Converge: Encerramento Completo do App e do Backend Embarcado

Feature: `034-encerramento-backend-orfao`
Mode: READ-ONLY sobre o código (só este arquivo, o `tasks.md`, o `README.md` e o `smoke-runbook.md` são escritos)
Data: 2026-11-15
Issue de origem: #104
Commits avaliados: `c19ac53` (revalidação dos artefatos), `15b37e5` (T3401), `bc80dbc` (T3402), `4b2e0f4` (T3403),
`41e6b84` (T3404), `12b16b2` (T3405), `76e4cbb` (T3406), `24f6e84` (T3407), `4c62120` e `1fb2136` (T3408)
Status: OPEN — falta só o cenário de logoff do Windows (§5)

## Entradas

- `spec.md`, `clarify.md` (C-3401 a C-3407), `plan.md`, `tasks.md` (T3401 a T3409), `analyze.md` (PASS, revalidado
  antes da T3401: G-1 script `dev`, G-2 `SIGPIPE`)
- contrato: `contracts/backend-embarcado.md`
- código: `apps/backend/cmd/server/{main,lifecycle,lifecycle_windows,lifecycle_unix}.go`,
  `apps/desktop/src/main/{backendManager,main}.ts`, `apps/desktop/installer/installer.nsh`, `scripts/build-backend.js`,
  `apps/*/package.json`
- suítes:
  - `apps/backend`: `go vet ./...`, `go test -count=1 ./...` (todos os pacotes verdes), smoke
    `go test -tags smoke -run TestSmoke ./cmd/server/` verde, `GOOS=windows|darwin|linux go vet ./cmd/server` verdes,
    `gofmt -l` vazio (conferido sem o CRLF da cópia de trabalho);
  - `apps/desktop`: `npm test` (350 testes, 31 arquivos) e `npm run lint` (`tsc --noEmit`) verdes;
  - empacotamento: `npm run make:win` (NSIS com `installer.nsh`) e `npm run make:linux` (via WSL; pacote com
    `resources/bin/mlab-backend`) verdes no Windows local. O CI `build-all.yml` só roda em PR para a `main`.

## 1. Requisitos atendidos

| Requisito | Evidência |
|---|---|
| RF-3401, RF-3402 | `main.ts` (`win.on('closed')`); matriz: X com overlay aberto e sala ativa (§5). Prova de falha: no HEAD da T3403, sem a T3404, `electron.exe` e `server.exe` ficavam vivos após fechar a janela |
| RF-3403 | `main.ts` (`shutdown()` idempotente, `before-quit`/`SIGINT`/`SIGTERM`; `session-end`, `will-quit` e `exit` só com `forceKillSync`); logs com a duração de cada etapa |
| RF-3404 | `backendManager.ts` (`stop()`); testes `BackendManager.stop` (saída voluntária, `taskkill /f /t` síncrono, SIGTERM→SIGKILL, idempotência) |
| RF-3405 | `main.ts` (timeout de 8 s → `forceKillSync()` → `app.exit(0)`) |
| RF-3406 | `backendManager.ts` (checagem antes/depois de cada espera e antes do `spawn`); testes de partida cancelada e `stop()` antes de `start()`; `shutdown()` sem sala chama `backend.stop()` de imediato |
| RF-3407 | `lifecycle*.go`; testes `TestWatchStdin_*`, `TestWatchParent_*`, `TestStartWatchdog_*`, `TestWatchdog_PaiMortoEncerraFilho` (filho sai em ~60 ms); matriz: `MLab.exe` finalizado à força ⇒ backend some em 798 ms |
| RF-3408 | `main.go` (`signal.NotifyContext`, `gracefulShutdown` com 3 s e `room.StopMDNSServer`); testes `TestGracefulShutdown_*`, `TestWaitStopReason` |
| RF-3409 | `backendManager.ts` (`releaseOrphan`, `parseNetstatListeningPid` com `ESCUTANDO`, `parseTasklistCsv`); testes da porta ocupada (MLab, terceiros, Linux/macOS); matriz: órfão encerrado e `POST /auth/session` do professor → 200 |
| RF-3410 | `main.ts` (`requestSingleInstanceLock`, `second-instance`); matriz: abrir duas vezes |
| RF-3411 | `build-backend.js`, `extraResources`; `getBackendExecutablePath` com legado por último e aviso (verificado escondendo o binário novo) |
| RF-3412 | `installer.nsh`; matriz: órfão `mlab-backend.exe` da pasta instalada encerrado na instalação; filtro do `server.exe` legado conferido no PowerShell 32 bits (só o da pasta do MLab; terceiro sobrevive); detecção do `MLab.exe` aberto impede qualquer encerramento |
| RF-3413 | `mlab-main.log`: partida (PID, versão), resultado da partida, dono da 8080, processos de backend no Windows, etapas do encerramento com duração, código de saída do backend |
| RF-3414 | `mlab-backend.log` (`MLAB_LOG_FILE`): partida com PID/PPID e watchdog, motivo e duração; `TestOpenLogOutput_ArquivoContinuaComStderrQuebrado`; `SIGPIPE` ignorado no Unix |
| RNF-3401 | matriz manual (§5), exceto o logoff |
| RNF-3402 | `TestLogStartup_NaoRegistraSegredos`; teste vitest "nenhum log contém a chave de host nem o JWT_SECRET"; terceiros na 8080 e `server.exe` fora da pasta do MLab nunca encerrados |
| RNF-3403 | `BackendManager` com dependências injetadas; testes Go com processo auxiliar |
| RNF-3404 | nenhuma dependência nova |
| RNF-3405 | `/health` e rotas inalterados; smoke verde |

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta | Evidência |
|---|---|---|
| RF-3403 (`session-end`) | verificação manual do logoff do Windows | código em `main.ts`; cenário pendente na §5 |
| RF-3402 (macOS) | execução num Mac | verificado só por leitura: `window-all-closed` não para o backend no macOS e `activate` recria a janela |

## 3. Divergências (código ≠ spec/plan/contrato)

| Item | Spec/contrato diz | Código faz | Encaminhamento |
|---|---|---|---|
| — | — | — | nenhuma |

- Defeito encontrado na própria feature durante a T3409: o instalador NSIS é 32 bits e o `Get-Process` do PowerShell
  32 bits não lê o caminho de processos 64 bits, então o `server.exe` legado da pasta do MLab sobrevivia à instalação.
  O check da T3408 tinha sido validado com o PowerShell 64 bits. Corrigido em `1fb2136` (`Win32_Process`) e
  revalidado instalando por cima de um órfão.
- O README citava a pasta de logs como `%APPDATA%\MLab\logs`; a pasta real do app instalado é
  `%APPDATA%\@mlab\desktop\logs` (nome do pacote). Corrigido no README nesta tarefa.

## 4. Código sem requisito (implementado fora de spec/task)

| Comportamento | Onde | Encaminhamento |
|---|---|---|
| — | — | nenhum |

## 5. Matriz manual (Windows 11, instalador NSIS `MLab-Setup-1.15.3.exe`)

Executada em 2026-11-15 com o app instalado em `C:\Program Files\MLab`, por roteiro que abre o `MLab.exe`, age e
confere o Gerenciador de Tarefas (`MLab.exe`, `mlab-backend.exe`, `server.exe`) e a porta 8080 até 3 s depois.

| Cenário | Esperado | Resultado |
|---|---|---|
| fechar pelo X, sem sala | nada restante no Gerenciador de Tarefas | OK — nada restante em 2,3 s |
| fechar pelo X na transmissão (overlay aberto) | alunos avisados; nada restante | OK — sala encerrada antes do backend; nada restante em 1,9 s |
| abrir e fechar em < 1 s | nenhum `mlab-backend.exe` restante | OK — fechado 182 ms após o processo surgir; nada restante em 1,2 s |
| finalizar `MLab.exe` no Gerenciador de Tarefas | `mlab-backend.exe` some em ≤ 3 s | OK — backend saiu em 798 ms (watchdog) |
| abrir o MLab duas vezes | janela existente ganha foco | OK — segunda instância sai, um só processo principal e um só backend |
| `server.exe` órfão + abrir o app novo | órfão encerrado; professor entra | OK — órfão encerrado em 250 ms; `POST /auth/session` → 200 |
| `server.exe` órfão + instalar por cima | sem "arquivo em uso" | OK após `1fb2136` — instalação silenciosa (código 0) encerrou o órfão da pasta do MLab |
| logoff do Windows com o MLab aberto | nada restante após novo login | **pendente** — verificação do responsável |

Observações:

- O órfão do cenário "abrir o app novo" foi um `server.exe` sem watchdog (mesmo comportamento das versões ≤ 1.15.x).
- No app desempacotado a mesma matriz (exceto instalador e logoff) foi executada antes, com o mesmo resultado.

## 6. Testes faltantes

- Logoff do Windows (`session-end`): só manual, pendente.
- macOS: sem máquina para executar.
- E2E automatizado do Electron: fora do escopo (C-3407).

## 7. Novas tasks necessárias

- Nenhuma.

## 8. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| — | — | — | nenhum desvio fora do escopo encontrado |

## 9. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| PATCH | 1.15.4 | Correção de comportamento (o app e o backend encerram em todas as formas de fechamento; órfão não bloqueia a próxima execução) sem capacidade nova nem mudança de contrato público (C-3401 B, C-3407). O contrato novo é interno entre processos do mesmo pacote e o nome do binário não é interface do usuário. |

## 10. Resultado

- [x] OPEN — todos os requisitos verificados, exceto o cenário de logoff do Windows (§5), que depende do responsável.
- [ ] CONVERGED
