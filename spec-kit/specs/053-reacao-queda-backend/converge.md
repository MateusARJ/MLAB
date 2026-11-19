# Converge: Reação do App à Queda do Backend

Feature: `053-reacao-queda-backend`
Status: DONE
Branch: `feat/reacao-queda-backend`, a partir da `main` @ `39fde1e` (2.2.1) (C-5304)

## 1. Evidências

- `apps/desktop`: `npx vitest run`, 35 arquivos e 410 testes verdes. São 17 testes novos: 6 no `BackendManager`, 8 no
  `useBackendRecovery` e 3 no `Room`. `tsc --noEmit` verde.
- `BackendManager` (deps falsas, relógio simulado):
  - saída inesperada → `down`, `restarting`, `up`, com o 2º `spawn` usando o mesmo binário e o mesmo `env`;
  - vigia armado no 1º `/health` OK; com o processo vivo e 3 falhas seguidas → "Backend travado", `taskkill`,
    `down`, `restarting`, `up`;
  - sem `/health` OK, o vigia não arma, desliga depois de 60 s e não derruba o processo;
  - processos novos que caem logo ao subir → 3 `restarting` e `failed` (4 `spawn` no total);
  - partida do reinício com erro → `failed`;
  - `stop()` e `forceKillSync()` → nenhum estado e nenhum reinício.
- `useBackendRecovery`:
  - em sala, `up` depois de `down` → `startProfessorSession('Ana')`, `createRoom('Matemática', 'Ana')` e
    `onRoomRecreated` com a sala nova; o aviso `recovered` volta a `idle` em 10 s;
  - no dashboard, só renova a sessão;
  - `up` sem `down` não faz nada; `failed` e erro de rede na recriação → `failed`;
  - a inscrição é removida ao desmontar.
- `Room`:
  - os três avisos da RF-5307 aparecem conforme o estado;
  - com a transmissão ao vivo, trocar `room.id` chama `startPublishing` uma vez com a mesma captura, e a tela
    continua na transmissão;
  - antes de começar a transmissão, trocar a sala não publica.
- Não verificado nesta entrega: teste manual com o instalador (`taskkill /f /pid <backend>` durante uma aula real,
  aluno entrando de novo pelo mesmo link). O modo dev usa backend externo e não passa pelo `BackendManager`. A
  validação fica com o responsável, depois do `npm run make`.

## 2. Requisitos

| Requisito | Evidência |
|---|---|
| RF-5301 | handler de `exit` em `attach()` → `handleCrash`; teste "saída inesperada" |
| RF-5302 | `watchHealth()`; teste "travamento" |
| RF-5303 | `recover()` com `lastStart`, janela de 60 s e limite de 3; testes de limite, falha de partida e `stop()` |
| RF-5304 | `onStatus` → `webContents.send('backend:status')` em `main.ts`; `onBackendStatus` no preload (contrato) |
| RF-5305 | `useBackendRecovery.resume()`; testes de sala e dashboard |
| RF-5306 | efeito em `room.id` no `Room`; teste de republicação |
| RF-5307 | `recoveryAlert()` no `Room` e estado do hook; testes de aviso |
| RNF-5301 | 3 × `HEALTH_INTERVAL_MS` (3 s) até o encerramento forçado |
| RNF-5302 | vigia armado no 1º OK; `fetchHealth` com timeout de 500 ms; teste "não arma" |
| RNF-5303 | o canal só leva o estado; o preload filtra os valores do contrato; a sessão usa `getHostKey` via IPC |
| RNF-5304 | nenhuma dependência nova |
| RNF-5305 | 393 testes anteriores verdes; nenhum reinício depois de `stop()`/`forceKillSync()` |

## 3. Desvios registrados

- Nenhum novo nesta feature. O teste de sondagem mDNS que falha com outro MLab na mesma LAN foi registrado na 052.

## 4. Ajustes de escopo durante a implementação

- T5302: `apps/desktop/src/test/setup.ts` entrou no Scope Lock (commit próprio de spec), porque o mock global do
  `electronAPI` precisa do método novo para o `tsc`.
- T5304: `apps/desktop/src/renderer/pages/Room.test.tsx` entrou no Scope Lock (commit próprio de spec), para os testes
  de componente da RF-5306 e da RF-5307.

## 5. Trabalho restante

- Teste manual com o instalador (ver §1).
- Se a 052 (2.2.2) entrar na `main` antes, resolver o conflito de versão nos `package.json` mantendo a 2.3.0.

## 6. Impacto de versão

**MINOR** (C-5304): capacidade nova (US-5301 a US-5303, RF-5301 a RF-5307) e canal IPC novo `backend:status`, sem
alterar canais ou contratos existentes (`docs/versionamento.md` §2). 2.2.1 → 2.3.0.
