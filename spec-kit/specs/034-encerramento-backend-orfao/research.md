# Research: Análise de causa raiz — MLab continua em segundo plano após fechar

Feature: `034-encerramento-backend-orfao`
Base analisada: `development` @ `e380ddb` (versão 1.15.2), em 2026-11-15. Revalidada @ `d1b4886` (1.15.3): a PR
#103 (033-encerramento-sala-pelo-hub) não altera `apps/desktop/src/main/**`; em `cmd/server/main.go` só troca o
listener de sala encerrada em `newServer`, e o `http.ListenAndServe` sem sinais continua em `main.go:48`.
Método: leitura de código e teste de comportamento do backend Go isolado. **Não reproduzido no Windows** (sem máquina
Windows no ambiente da análise); a confirmação manual é parte da última tarefa.

## 1. Sintoma relatado

No Windows (instalador NSIS), ao fechar o MLab ele às vezes não fecha por completo e continua rodando em segundo
plano. O responsável não sabe se o processo restante é o `MLab.exe` (Electron) ou o `server.exe` (backend Go) e não
identificou um cenário específico.

Evidência indireta de que o problema já é conhecido: `docs/metrics/smoke-runbook.md:26` instrui "Feche qualquer
instância antiga do MLab antes de cada rodada (o app sobe o backend na porta 8080)".

## 2. Arquitetura atual do encerramento

```text
MLab.exe (main process: apps/desktop/src/main/main.ts)
 ├── janela principal (createWindow)
 ├── janela de overlay de marcação (annotationOverlayWindow.ts) — só na sessão ao vivo
 └── server.exe (spawn em startBackendServer, stdio ['ignore','pipe','pipe'])

Fechar: close (janela) → window-all-closed → app.quit → before-quit → will-quit → exit
        stopBackendServer() é chamado em before-quit, will-quit, window-all-closed e process 'exit'
```

## 3. Causas encontradas (ordenadas por probabilidade × impacto)

### R-1 — Overlay de marcação impede o app de encerrar (**MLab.exe** fica vivo) — crítica, nova na `development`

- `annotationOverlayWindow.ts:114-130`: o overlay é um `BrowserWindow` **independente** (sem `parent`), `transparent`,
  `frame: false`, `skipTaskbar: true`, `alwaysOnTop` e em click-through. É invisível para o usuário e não aparece na
  barra de tarefas.
- Ele só é destruído por `annotationOverlayManager.stop()`, chamado (a) pelo renderer via IPC
  `annotation-overlay:stop` no cleanup de um `useEffect` de `Room.tsx:665-674`, ou (b) em `window-all-closed` /
  `will-quit` / `exit` do main.
- Ao fechar a janela principal pelo X durante a sessão ao vivo, o handler `close` (`main.ts:194-205`) chama
  `win.destroy()` (com sala ativa) ou deixa a janela fechar (sem sala ativa). Em ambos os casos o renderer é descartado
  **sem** desmontar os componentes React, então o cleanup do `useEffect` não envia `annotation-overlay:stop`.
- O overlay continua aberto ⇒ `window-all-closed` **não é emitido** (o Electron conta todas as janelas) ⇒ `app.quit()`
  nunca é chamado ⇒ `MLab.exe` continua rodando, junto com o backend, os atalhos globais registrados pelo overlay e o
  detector de Ctrl duplo.
- Nenhum código do main escuta o `closed` da janela principal para encerrar o overlay
  (`grep "mainWin.on|'closed'"` só encontra o `closed` do próprio overlay).

Cenário provável: o professor fecha o MLab pelo X durante ou logo após uma transmissão.

### R-2 — Backend órfão nunca é encerrado e quebra a próxima execução (**server.exe** fica vivo) — alta

- `main.ts:544-548`: se `/health` responde 200 na 8080, o app registra "Servidor já detectado ativo" e **não guarda
  referência ao processo**. Ao fechar, `stopBackendServer()` não tem o que encerrar; o órfão sobrevive a todas as
  execuções seguintes.
- Com a ADR 0006, o app gera uma **chave de host nova por execução** (`hostKey.ts`) e o backend a lê do ambiente na
  partida (`auth/handler.go:34-48`). Um órfão de uma execução anterior tem a chave antiga: o `POST /auth/session` do app
  novo é recusado e o professor **não consegue entrar**. Além do processo em segundo plano, o órfão inutiliza o MLab até
  ser encerrado manualmente.
- O órfão também viola a consequência da ADR 0005 ("Reiniciar o app do professor encerra a sala e descarta chat,
  arquivos e sessões"): o estado em memória da execução anterior continua vivo.

### R-3 — Encerramento do backend no Windows é "disparar e esquecer" — alta

- `main.ts:615-634`: no Windows, `stopBackendServer()` faz `spawn('taskkill', …)` sem aguardar e zera
  `serverProcess` em seguida. O Electron sai logo depois; o `taskkill` é filho do próprio Electron e pode morrer junto
  antes de agir. Falhas não são registradas nem repetidas.
- `main.ts:720-724`: `process.on('exit')` chama `spawn`, que não executa nada útil nesse ponto (o event loop já
  parou).
- Handlers `async` em `before-quit`/`close` não são aguardados pelo Electron.

### R-4 — Backend não percebe a morte do app — alta

- `cmd/server/main.go:46-50`: `http.ListenAndServe` sem tratamento de sinal nem vigilância do processo pai. Se o
  `MLab.exe` travar ou for encerrado pelo Gerenciador de Tarefas, nada encerra o `server.exe`.
- O backend é iniciado com `stdio: ['ignore', …]`: não existe um canal que feche quando o Electron morre.
- Teste realizado (base anterior, mesmo código de partida): backend iniciado por um processo pai Node, pai encerrado
  com `kill -9` ⇒ backend continua vivo indefinidamente. Com um pipe de stdin e leitura até EOF, o backend detecta a
  morte do pai em ~1,5 s.

### R-5 — Sem trava de instância única — média

- Não há `app.requestSingleInstanceLock()`. Abrir o MLab duas vezes cria duas instâncias; a segunda encontra a 8080
  ocupada e cai em R-2 (usa o backend da primeira com outra chave de host, e não consegue entrar).

### R-6 — Corrida "abrir e fechar rápido" — média

- `startBackendServer()` é assíncrono (até 500 ms em `isPortInUse`). Se o app começar a fechar nesse intervalo, os
  handlers de saída rodam com `serverProcess === null` e o `spawn` acontece depois: o backend nasce órfão.

### R-7 — macOS: fechar a janela derruba o backend, mas o app continua no Dock — baixa (fora do relato)

- `window-all-closed` chama `stopBackendServer()` mas, no macOS, não chama `app.quit()`. Reabrir a janela pelo Dock
  (`activate`) cria uma janela sem backend.

### R-8 — Nome genérico do binário — baixa

- `server.exe` é difícil de reconhecer no Gerenciador de Tarefas e impede encerrar com segurança por nome (outros
  programas podem ter um `server.exe`).

## 4. O que **não** é causa

- Timers do main (`cursorPresence` a 16 ms): `app.quit()` não espera timers.
- O instalador: só agrava (arquivo em uso ao atualizar com `server.exe` órfão), não causa o processo restante.
- Testes do backend: `go test ./...` passa por completo na base analisada.

## 5. Conclusão

São duas famílias de causa, que precisam ser corrigidas juntas:

1. **O próprio MLab não encerra** quando há overlay aberto (R-1).
2. **O backend sobrevive ao MLab** (R-2, R-3, R-4, R-6), e o órfão ainda impede a próxima execução de funcionar
   (chave de host, ADR 0006).

R-5, R-7 e R-8 são agravantes de baixo custo de correção.
