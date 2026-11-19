# Spec: Reação do App à Queda do Backend

Status: READY
Feature ID: `053-reacao-queda-backend`
Origem: relato de uso real em 2026-11-19 (MLab 2.2.1, Windows). O backend embarcado caiu no meio da aula por um bug
do runtime Go (corrigido na feature `052`). O app do professor não percebeu: seguiu "transmitindo" para ninguém, e
encerrar e criar outra sala deu "erro de fetch" até o professor fechar e reabrir o app.

## 1. Objetivo

1. O app do professor detecta quando o backend embarcado morre ou trava.
2. O app reinicia o backend e retoma a aula sozinho: nova sessão do professor, sala recriada com o mesmo nome (o link
   fixo continua o mesmo) e a tela volta a ser publicada, sem o professor refazer a captura.
3. O professor vê o que está acontecendo (caiu, retomando, retomada, falhou).

## 2. Contexto

Verificado em 2026-11-19 na `main` @ `39fde1e` (2.2.1):

- `apps/desktop/src/main/backendManager.ts`: `attach()` só registra o `exit` do processo no log; ninguém é avisado e
  nada é reiniciado. `start()` já trata a porta ocupada por backend órfão do MLab (RF-3409) e `forceKill()` já encerra
  à força (RF-3404).
- Nos logs do relato, a 1ª queda saiu com código 2. Na 2ª, o processo **travou sem sair** depois do crash e só foi
  morto no fechamento do app. Detectar só pelo `exit` não cobre esse caso.
- O estado vive só em memória (ADR 0005), e o segredo JWT muda a cada execução (ADR 0006). Depois de reiniciar, o
  token do professor e a sala deixam de existir.
- A chave de host (`MLAB_HOST_KEY`) é gerada uma vez por execução do app e repassada ao backend pelo ambiente. Um
  backend reiniciado com o mesmo ambiente aceita a mesma chave.
- O slug da sala vem do nome do professor e do título (`TestCreateRoomFixedSlug`). Recriar a sala com o mesmo título
  e nome mantém o link fixo `/{sala}/{prof}`.
- `useWebRTCPublisher.startPublishing` fecha a conexão anterior antes de abrir a nova, e o `Room` lê o token do
  `sessionStorage` a cada render.

## 3. Escopo

### Incluído

- Detecção de queda (saída inesperada) e de travamento (`/health` sem resposta) do backend embarcado.
- Reinício automático do backend, com limite de tentativas.
- Retomada automática no app do professor: nova sessão, sala recriada, publicação reiniciada com a captura atual.
- Aviso ao professor sobre o estado.

### Não incluído

- Retomada automática no web do aluno: o aluno entra de novo pelo mesmo link (o JWT antigo não vale mais).
- Recuperar chat, mão levantada, arquivos ou lista de presença da sala anterior (estado em memória, ADR 0005).
- Backend externo do modo dev (`npm run dev`), que o app não gerencia.
- A causa da queda (feature `052`).

## 4. Atores

- **Professor**: está em aula quando o backend cai.
- **Aluno**: perde a transmissão e entra de novo pelo mesmo link.

## 5. User Stories

### US-5301 — Aula retomada sozinha

Como professor, quero que a aula volte sozinha se o servidor cair, sem precisar fechar o app.

- Dado que estou transmitindo, quando o processo do backend sai sem ter sido pedido, então o app avisa que a
  transmissão caiu, reinicia o backend, recria a sala com o mesmo nome e volta a publicar a mesma tela.
- Dado que o backend travou (processo vivo, sem responder ao `/health` por 3 verificações seguidas), então o app o
  encerra à força e segue o mesmo fluxo.
- Dado que a retomada terminou, então vejo o aviso "Aula retomada" com o link (igual ao anterior quando o link fixo
  existe) e o pedido para os alunos entrarem de novo.

### US-5302 — Falha da retomada

Como professor, quero saber quando o app não conseguiu retomar, para agir.

- Dado que o backend caiu 3 vezes em 60 s, ou que recriar a sala falhou, então o app para de tentar e mostra que não
  conseguiu retomar, orientando a fechar e abrir o app.

### US-5303 — Queda fora da sala

Como professor, quero que o dashboard continue funcionando se o backend cair antes de eu entrar na sala.

- Dado que estou no dashboard, quando o backend é reiniciado, então o app renova a sessão sem me pedir o nome de
  novo, e criar a sala funciona.

## 6. Requisitos Funcionais

- RF-5301: o `BackendManager` trata como queda a saída do processo que não foi pedida por `stop()`/`forceKillSync()`.
- RF-5302: depois que o backend respondeu ao `/health` pela primeira vez, o `BackendManager` consulta o `/health` a
  cada 3 s. Depois de 3 falhas seguidas, trata como travamento: encerra o processo à força (`forceKill`) e segue como
  queda.
- RF-5303: depois de uma queda, o `BackendManager` reinicia o backend com a mesma configuração da partida. São no
  máximo 3 reinícios numa janela de 60 s; acima disso, desiste. Nenhum reinício acontece depois do início do
  encerramento do app (`isStopping`).
- RF-5304: o main informa a janela do professor pelo canal IPC `backend:status`, com os estados `down`, `restarting`,
  `up` e `failed`, conforme `contracts/ipc-backend-status.md`. `up` só é enviado depois que o backend reiniciado
  responde ao `/health`.
- RF-5305: ao receber `up` depois de `down`, o renderer renova a sessão do professor (`POST /auth/session` com o nome
  guardado e a chave de host). Se o professor estava numa sala, recria a sala com o mesmo título e informa a nova sala
  ao main (`setActiveRoom`).
- RF-5306: com a sala recriada, a tela do professor continua montada, e a publicação reinicia na nova sala com a
  captura atual, sem pedir de novo a fonte.
- RF-5307: a tela da sala mostra um aviso fixo, conforme o estado: "A transmissão caiu. Reconectando…" (`down` e
  `restarting`); "Aula retomada. Peça aos alunos para entrarem de novo pelo link." (sucesso, some em 10 s); "Não foi
  possível retomar a aula. Feche e abra o MLab." (`failed` ou erro na renovação ou na recriação).

## 7. Requisitos Não Funcionais

- RNF-5301 — tempo: do travamento à detecção, no máximo ~9 s (3 × 3 s). Da queda ao `up`, o tempo de partida do
  backend.
- RNF-5302 — falso positivo: o vigia do `/health` só arma depois da primeira resposta OK e usa o timeout de 500 ms
  do `fetchHealth`. Uma resposta lenta isolada não derruba o backend.
- RNF-5303 — segurança: a renovação usa a mesma chave de host via IPC (ADR 0006). Nenhum token ou chave vai para o
  log.
- RNF-5304 — dependências: nenhuma nova.
- RNF-5305 — regressão: testes existentes do desktop verdes; o encerramento do app (034) não dispara reinício.

## 8. Estados e Erros

| Estado do backend | Evento IPC | Aviso na sala |
|---|---|---|
| saiu sem pedido / travou | `down` | "A transmissão caiu. Reconectando…" |
| reiniciando | `restarting` | "A transmissão caiu. Reconectando…" |
| reiniciado e respondendo | `up` | (renderer renova e recria) → "Aula retomada…" |
| 3 quedas em 60 s / partida falhou | `failed` | "Não foi possível retomar a aula. Feche e abra o MLab." |
| renovação ou recriação falhou | — | "Não foi possível retomar a aula. Feche e abra o MLab." |

## 9. Edge Cases

- Queda durante o encerramento do app: não reinicia (RF-5303).
- Porta 8080 ainda ocupada pelo processo travado: o `forceKill` vem antes do reinício, e o `start()` trata o órfão do
  MLab (RF-3409).
- Professor no dashboard: renova a sessão e não recria sala (US-5303).
- Professor gravando localmente: a gravação local continua (o stream não muda).
- Queda antes do primeiro `/health` OK (partida): o vigia não está armado; só a saída do processo conta.

## 10. Dados/Contratos impactados

- Novo: `contracts/ipc-backend-status.md` (canal IPC `backend:status`, main → renderer). Adição compatível.

## 11. Critérios de Sucesso

- `npm run test --workspace=apps/desktop` e `npm run lint` em `apps/desktop` verdes, com testes novos para RF-5301
  a RF-5307.
- Manual: durante a transmissão, `taskkill /f /pid <backend>` → aviso, sala recriada com o mesmo link, aluno entra de
  novo e vê a tela.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-5301 a C-5304).
