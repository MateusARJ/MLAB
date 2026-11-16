# Contract: Processo do Backend Embarcado

Status: READY

## Purpose

Define como o app desktop inicia, vigia e encerra o backend Go embarcado, e como o backend reage à morte do app.
Interface interna entre dois processos do mesmo pacote, sem exposição na rede.

## Producer

`apps/desktop/src/main/` — inicia o processo do backend.

## Consumer

`apps/backend/cmd/server/` — o processo iniciado.

## Transport

Internal: linha de comando, variáveis de ambiente, stdin/stdout/stderr do processo filho.

## Request / Message

### Binário

| Plataforma | Caminho no pacote | Legado aceito pelo app (RF-3411) |
|---|---|---|
| Windows | `resources/bin/mlab-backend.exe` | `resources/bin/server.exe` |
| Linux | `resources/bin/mlab-backend` | `resources/bin/server` |
| macOS | `resources/bin/mlab-backend` | `resources/bin/server` |

### Variáveis de ambiente

| Variável | Valor | Já existia | Uso no backend |
|---|---|---|---|
| `PORT`, `WEB_PORT` | `8080` | sim | porta HTTP/WebSocket |
| `WEB_DIR` | pasta do web dos alunos | sim | arquivos estáticos |
| `MLAB_HOST_KEY` | chave de host da execução | sim (ADR 0006) | autenticação do professor |
| `MLAB_PARENT_WATCHDOG` | `1` | **novo** | ativa o watchdog do processo pai |
| `MLAB_PARENT_PID` | PID do processo principal do app | **novo** | segunda vigilância do pai |
| `MLAB_LOG_FILE` | `<userData>/logs/mlab-backend.log` | **novo** | log persistente (append) |

Sem `MLAB_PARENT_WATCHDOG=1` (ex.: `go run`, `npm run dev`), o backend se comporta como hoje, exceto pelo tratamento
de sinais (RF-3408).

### stdio

| Canal | Direção | Semântica |
|---|---|---|
| stdin | app → backend | pipe mantido aberto pelo app; nenhum dado é enviado. **EOF = o app encerrou ou pediu o encerramento.** |
| stdout/stderr | backend → app | linhas de log, reproduzidas em `mlab-main.log` com prefixo `[Backend]`/`[Backend ERR]` |

## Response / Event

| Gatilho no backend | Ação |
|---|---|
| EOF ou erro de leitura no stdin (com watchdog) | encerramento gracioso |
| `MLAB_PARENT_PID` deixa de existir (com watchdog; Windows: espera no handle do processo; Linux/macOS: PPID muda) | encerramento gracioso |
| `SIGINT` / `SIGTERM` | encerramento gracioso |

Encerramento gracioso: para de aceitar conexões, aguarda requisições ativas por até 3 s, encerra o anúncio mDNS, registra
o motivo e a duração em `MLAB_LOG_FILE`, sai com código 0.

### Encerramento iniciado pelo app (RF-3404)

1. fecha o stdin;
2. aguarda o `exit` por até 2 s;
3. força: Windows `taskkill /pid <pid> /f /t` (síncrono); Linux/macOS `SIGTERM`, e `SIGKILL` após 1 s;
4. aguarda a confirmação por até 1,5 s e registra o resultado.

## Validation

- `MLAB_PARENT_PID` não numérico ou ≤ 0 ⇒ ignorado (vale só o stdin).
- `MLAB_LOG_FILE` não gravável ⇒ aviso no stderr; o backend continua.

## Authorization

Não se aplica (interface local entre processos do mesmo usuário). O app nunca encerra processo que não reconheça como
backend do MLab (RNF-3402).

## Errors

| Código/Evento | Quando | Ação do app |
|---|---|---|
| `exit` com código ≠ 0 | falha na partida (porta ocupada, SFU) | registra em `mlab-main.log` |
| sem `exit` após o encerramento forçado | `taskkill`/`SIGKILL` falhou | registra aviso; o watchdog permanece como garantia |

## Compatibility

- Versionamento: contrato interno; mudanças acompanham a versão única do monorepo.
- Mudanças breaking: nenhuma para usuários. Backends legados (sem watchdog) continuam encerrados pelo app por PID e,
  quando órfãos, por RF-3409/RF-3412.

## Observability

- `mlab-main.log`: partida e resultado, dono da porta 8080, processos de backend no Windows, etapas do encerramento.
- `mlab-backend.log`: partida (PID, PPID, watchdog), motivo e duração do encerramento.
- Nunca registrar `MLAB_HOST_KEY` nem `JWT_SECRET`.
