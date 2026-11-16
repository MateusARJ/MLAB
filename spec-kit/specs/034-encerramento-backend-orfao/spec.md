# Spec: Encerramento Completo do App e do Backend Embarcado

Status: READY
Feature ID: `034-encerramento-backend-orfao`
Origem: issue #104, a partir do relato do responsável em 2026-11-15 ("ao fechar, às vezes o MLab não fecha
completamente e fica rodando em segundo plano", Windows, instalador NSIS). Análise de causa raiz em `research.md`.

## 1. Objetivo

Garantir que fechar o MLab encerre **todos** os seus processos — o app e o backend embarcado — em qualquer forma de
fechamento, e que uma execução anterior que tenha sobrado nunca impeça a próxima de funcionar.

## 2. Contexto

Verificado em 2026-11-15 na `development` @ `e380ddb` e revalidado @ `d1b4886` (detalhes e evidências em
`research.md`):

- a janela de overlay de marcação (`annotationOverlayWindow.ts`) é independente e invisível; ao fechar a janela
  principal durante a sessão ao vivo ela continua aberta, `window-all-closed` não é emitido e o `MLab.exe` não
  encerra (R-1);
- um backend que sobrou na 8080 é reaproveitado sem ser gerenciado; como a chave de host muda por execução (ADR 0006),
  o professor não consegue entrar enquanto ele existir (R-2);
- o encerramento do backend no Windows não espera o `taskkill` terminar (R-3);
- o backend não percebe quando o app morre (travamento, "Finalizar tarefa") (R-4);
- não há trava de instância única (R-5) e há corrida ao fechar logo após abrir (R-6).

## 3. Escopo

### Incluído

- Encerramento do app quando a janela principal fecha, inclusive com o overlay de marcação aberto.
- Encerramento do backend embarcado aguardando o fim real do processo, com fallback forçado.
- Encerramento automático do backend quando o app morre por qualquer motivo.
- Tratamento de backend que sobrou de execução anterior na 8080.
- Instância única do app.
- Renomeação do binário do backend para `mlab-backend` (aprovada, C-3404).
- Encerramento de backends órfãos pelo instalador NSIS (aprovado, C-3405).
- Logs de diagnóstico do ciclo de vida do app e do backend (aprovados, C-3406).

### Não incluído

- Mudança de porta, de rotas HTTP/WebSocket ou de autenticação.
- Interface nova (diálogos, avisos na tela) para backend ocupando a porta.
- Atualização automática do app.
- Persistência de estado entre execuções (ADR 0005).

## 4. Atores

- **Professor:** abre e fecha o MLab no Windows (alvo principal), Linux ou macOS.
- **Instalador/desinstalador NSIS:** substitui ou remove os executáveis do MLab.

## 5. User Stories

### US-3401 — Fechar o MLab encerra tudo

Como professor, quero que fechar o MLab encerre o app e o backend, para não deixar processos invisíveis ocupando a
máquina e a porta 8080.

- Dado o MLab aberto sem sala, quando o professor fecha pelo X, então nenhum processo do MLab permanece.
- Dado uma transmissão ao vivo (overlay de marcação aberto), quando o professor fecha pelo X, então os alunos recebem
  o encerramento da sala e nenhum processo do MLab permanece.
- Dado o MLab abrindo, quando o professor fecha em menos de 1 s, então nenhum backend é iniciado depois do fechamento.

### US-3402 — Backend não sobrevive ao app

Como professor, quero que o backend se encerre sozinho quando o MLab trava ou é encerrado à força, para não precisar
procurar processos no Gerenciador de Tarefas.

- Dado o MLab aberto, quando o `MLab.exe` é finalizado pelo Gerenciador de Tarefas, então o backend se encerra em até
  3 s.

### US-3403 — Execução anterior não bloqueia a próxima

Como professor, quero abrir o MLab normalmente mesmo que uma execução anterior tenha deixado o backend rodando, para
conseguir entrar e dar aula.

- Dado um backend do MLab que sobrou na 8080 (inclusive de versão antiga, `server.exe`), quando o professor abre o
  MLab, então o backend antigo é encerrado, um novo é iniciado e o professor entra normalmente.
- Dado um programa de terceiros ocupando a 8080, quando o professor abre o MLab, então o MLab não encerra esse
  programa e registra o conflito no log.

### US-3404 — Uma única instância

Como professor, quero que abrir o MLab de novo traga a janela existente para frente, para não criar uma segunda
instância que não funciona.

- Dado o MLab aberto, quando o professor o abre outra vez, então a janela existente ganha foco e nenhuma instância nova
  permanece.

### US-3405 — Diagnóstico do encerramento

Como responsável pelo MLab, quero logs do ciclo de vida do app e do backend, para identificar em campo qual processo
sobrou e em que etapa.

- Dado qualquer abertura ou fechamento, então `mlab-main.log` registra cada etapa com PIDs e duração.
- Dado o backend encerrado sem o app (watchdog), então `mlab-backend.log` registra o motivo, mesmo com o app morto.

### US-3406 — Instalar e atualizar sem arquivo em uso

Como professor, quero instalar ou atualizar o MLab sem erro de arquivo em uso causado por backend órfão.

- Dado um `mlab-backend.exe` (ou o legado `server.exe` da pasta do MLab) órfão e o `MLab.exe` fechado, quando o
  instalador ou o desinstalador inicia, então o órfão é encerrado antes de copiar ou remover arquivos.

## 6. Requisitos Funcionais

- RF-3401: fechar a janela principal encerra o overlay de marcação, o rastreador de cursor e os atalhos globais,
  independentemente do caminho de fechamento (C-3402).
- RF-3402: no Windows e no Linux, fechar a janela principal encerra o app mesmo que outras janelas do MLab existam
  (C-3402). No macOS vale C-3403.
- RF-3403: o app tem um único procedimento de encerramento, idempotente, que (1) encerra a sala ativa como hoje,
  (2) libera overlay e rastreador de cursor, (3) encerra o backend gerenciado aguardando o fim do processo e (4) finaliza
  o app. Todos os gatilhos (fechar janela, `before-quit`, sinais do SO, logoff do Windows) usam esse procedimento.
- RF-3404: o encerramento do backend fecha primeiro o canal de stdin (encerramento gracioso) e aguarda até 2 s; se o
  processo não terminar, força o encerramento (Windows: `taskkill /pid <pid> /f /t` síncrono; Linux/macOS: `SIGTERM` e,
  após 1 s, `SIGKILL`) e aguarda a confirmação.
- RF-3405: o encerramento completo tem limite de 8 s; ao estourar, o backend é encerrado de forma síncrona e o app sai.
- RF-3406: depois que o encerramento começa, nenhum backend novo é iniciado; se o início estiver em andamento, ele é
  cancelado antes do `spawn`.
- RF-3407: o backend iniciado pelo app encerra a si mesmo, de forma graciosa, quando (a) o stdin recebe EOF ou (b) o
  processo pai informado deixa de existir, conforme `contracts/backend-embarcado.md`.
- RF-3408: o backend trata `SIGINT`/`SIGTERM` com encerramento gracioso de até 3 s (para de aceitar conexões, encerra o
  anúncio mDNS) antes de sair.
- RF-3409: ao iniciar, se a 8080 estiver ocupada, o app identifica o dono da porta (C-3401 B). No Windows, obtém o
  PID em escuta na 8080 e o nome da imagem: se for `mlab-backend.exe` ou o legado `server.exe`, encerra-o, aguarda a
  porta liberar (até 3 s) e inicia o próprio backend; com outra imagem ou sem PID identificado, não encerra nada e
  registra o conflito no log. No Linux/macOS não há identificação: o app registra o conflito no log e mantém o
  comportamento atual.
- RF-3410: o app obtém a trava de instância única; uma segunda abertura foca a janela existente (restaurando se
  minimizada) e encerra a instância nova.
- RF-3411: o binário do backend passa a se chamar `mlab-backend.exe` (Windows) e `mlab-backend` (Linux/macOS) no pacote
  (C-3404); o app ainda localiza os nomes legados como último recurso, registrando aviso.
- RF-3412: o instalador e o desinstalador NSIS, quando o `MLab.exe` não está em execução, encerram `mlab-backend.exe` e
  o legado `server.exe` **somente** se este estiver em `<pasta>\resources\bin\server.exe` com `MLab.exe` em `<pasta>`
  (C-3405).
- RF-3413: o app registra em `mlab-main.log`: PID e versão na partida; resultado da partida do backend (iniciado,
  reaproveitado, órfão encerrado, binário ausente, cancelado); dono da porta 8080 quando ocupada; no Windows, os
  processos de backend existentes na partida; cada etapa do encerramento com duração; o código de saída do backend
  (C-3406).
- RF-3414: o backend registra em `mlab-backend.log` (caminho recebido do app) a partida com PID/PPID, a ativação do
  watchdog, o motivo do encerramento e a duração; uma falha de escrita no stdout (app morto) não impede a escrita no
  arquivo (C-3406).

## 7. Requisitos Não Funcionais

- RNF-3401 — confiabilidade: em nenhum caminho de fechamento coberto pelos critérios das US-3401 a US-3404 sobra
  processo do MLab após 10 s.
- RNF-3402 — segurança: a chave de host (`MLAB_HOST_KEY`) e o `JWT_SECRET` nunca aparecem nos logs novos; o app nunca
  encerra processo que não seja reconhecido como backend do MLab.
- RNF-3403 — testabilidade: a gestão do processo do backend no app fica num módulo com dependências de SO injetadas,
  testável sem Electron; o watchdog do backend tem testes Go sem processo pai real.
- RNF-3404 — dependências: nenhuma nova (Go stdlib, `child_process` do Node, recursos nativos do NSIS e ferramentas do
  Windows: `taskkill`, `tasklist`, `netstat`, PowerShell).
- RNF-3405 — compatibilidade: `/health` continua respondendo 200 com `"status":"ok"`; rotas, WebSocket e
  autenticação não mudam.

## 8. Estados e Erros

| Situação | Evento | Resultado |
|---|---|---|
| app aberto, sem sala | X na janela principal | tudo encerrado (RF-3403) |
| sessão ao vivo, overlay aberto | X na janela principal | sala encerrada, overlay fechado, tudo encerrado (RF-3401–RF-3403) |
| app abrindo (antes do `spawn`) | fechar | `spawn` cancelado (RF-3406) |
| backend não sai em 2 s | encerramento | encerramento forçado aguardado (RF-3404) |
| encerramento travado | 8 s | encerramento síncrono e saída (RF-3405) |
| `MLab.exe` finalizado à força | EOF no stdin / pai inexistente | backend se encerra sozinho (RF-3407) |
| 8080 com backend do MLab órfão | abrir o app | órfão encerrado, backend novo (RF-3409) |
| 8080 com programa de terceiros | abrir o app | nada encerrado; conflito no log (RF-3409) |
| app já aberto | abrir de novo | foco na janela existente (RF-3410) |
| órfão + instalador | iniciar instalação | órfão encerrado antes da cópia (RF-3412) |
| logoff/desligamento do Windows | `session-end` | backend encerrado de forma síncrona (RF-3403) |

## 9. Edge Cases

- O professor reabre o app menos de 1 s depois de matá-lo: o órfão ainda pode estar no ar; RF-3409 o encerra.
- O `taskkill` falha (acesso negado): a falha é registrada (RF-3413); o watchdog (RF-3407) continua valendo.
- Modo de desenvolvimento (`MLAB_DEV_MONOREPO=1` ou `turbo.json`): o backend continua externo e não é encerrado pelo
  app (comportamento atual mantido).
- `MLAB_HOST_KEY` vinda do ambiente (`npm run dev`): mantida; o backend iniciado pelo app continua a herdar a chave.
- Backend legado sem watchdog (versões ≤ 1.15.x) órfão: só RF-3409 e RF-3412 o encerram.

## 10. Dados/Contratos impactados

- **Novo:** `contracts/backend-embarcado.md` — contrato de processo entre o app desktop (produtor do processo) e o
  backend (consumidor): variáveis de ambiente, semântica do stdin, encerramento e log.
- `/health`: sem mudança (C-3401 B).
- Sem mudança em `001/contracts/*`, `003/contracts/*` (IPC do desktop inalterado).
- Sem novo requisito em `docs/requirements/` (não há espelho do ciclo de vida do app).

## 11. Critérios de Sucesso

- Testes unitários do módulo de gestão do backend (vitest) cobrindo RF-3404, RF-3406 e RF-3409.
- Testes Go do watchdog e do encerramento gracioso cobrindo RF-3407, RF-3408 e RF-3414.
- `npm test`, `npm run lint` (desktop) e `go test ./...`, `go vet ./...` (backend) verdes.
- Teste de ponta a ponta do watchdog no CI Linux: pai morto com `SIGKILL` ⇒ backend encerra em até 3 s.
- Verificação manual no Windows com a matriz da T3409 (todos os cenários das US-3401 a US-3404 e US-3406).

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-3401 a C-3407).
