# Spec: Conexão Recusada em Sala Encerrada pelo Hub

Status: READY
Feature ID: `037-registro-em-hub-encerrado`
Origem: issue #107 (desvio registrado na 036/T3601). Faz o WebSocket respeitar o encerramento da sala (RN-13, RF-18
da `001-screen-share-core`); não muda regra de negócio nem ADR. Substitui a US-3601 da `036-status-hub-sincronizado`
(C-3702).

## 1. Objetivo

Garantir que nenhum participante seja registrado numa sessão de sala já encerrada, nem num hub recriado para uma sala
que saiu do store, mesmo quando a conexão corre com o encerramento.

## 2. Contexto

Verificado em 2026-11-15 na `development` @ `f9dec97`:

- `serveWS` (`signaling/handler.go`) faz três passos sem ligação entre si: consulta o store (`404`/`410`), faz o
  upgrade e chama `getOrCreateHub`, depois envia `hub.register <- client`.
- Encerramento pelo hub (`end-session`, timeout de 30 s): o hub grava `closed` e só depois, no `onClosed`, a sala sai
  do store (033). REST `close`: o store fica `closed` primeiro e o hub recebe o sinal depois, de forma assíncrona.
- **Janela A:** o `getOrCreateHub` devolve o hub vivo, o hub encerra e o `register` chega depois. O `onRegister` não
  confere o status: o cliente entra em `clients` de uma sessão encerrada e não recebe o `room-closed`.
- **Janela B:** o hub encerra entre a consulta ao store e o `getOrCreateHub`, que apaga o hub `closed` e cria um hub
  novo em `waiting` para uma sala que já saiu do store. O mesmo vale para a REST `close` de sala sem hub.
- IDs de sala são aleatórios e nunca reaproveitados (`room/store.go`, `newID`): hub encerrado significa sala encerrada
  para sempre.
- O desktop ignora `session-state` e `room-closed` e envia `publish-request` ao abrir o WebSocket. Num hub encerrado ou
  recriado, o `onPublishRequest` volta o status para `publishing`: o professor recebe `publish-approved`, publica na
  SFU de uma sala removida e nenhum aluno consegue entrar (`404`).
- O web já trata `session-state: closed` e `room-closed` encerrando a sessão do aluno.

## 3. Escopo

### Incluído

- Recusa do registro em hub encerrado, com `room-closed`.
- `getOrCreateHub` sem recriar hub de sala encerrada e sem criar hub de sala ausente ou `closed` no store.
- `serveWS` respondendo `410` antes do upgrade quando não há hub disponível.
- Nota no contrato `signaling.md`.
- Testes Go do pacote `signaling`.

### Não incluído

- Tratar `session-state`/`room-closed` no desktop (C-3703).
- Código de fechamento novo (C-3701).
- Encerrar a goroutine `run()` de hubs encerrados.
- Mudanças em `room`, `webrtc`, `message.go`, web, desktop e `packages/`.

## 4. Atores

- **Professor:** reconecta o WebSocket perto do fim do timeout de 30 s ou enquanto a sala encerra.
- **Aluno:** conecta enquanto a sala encerra.

## 5. User Stories

### US-3701 — Ninguém entra numa sessão encerrada

Como participante que conecta no mesmo instante em que a sala encerra, quero ser avisado do encerramento, para não
ficar numa sala que não existe mais.

- Dado um hub que já processou o encerramento, quando um cliente é registrado nele, então o cliente recebe
  `room-closed`, a conexão é fechada e o cliente não aparece para ninguém.
- Dado um professor registrado depois do encerramento, então o hub não volta a `publishing` nem aprova publicação.

### US-3702 — Sala encerrada não ganha hub novo

Como professor ou aluno com o link de uma sala encerrada, quero receber a recusa do handshake, para não cair numa
sessão vazia.

- Dado um hub encerrado, quando um cliente conecta na sala, então o handshake responde `410` e nenhum hub novo é criado.
- Dada uma sala ausente ou `closed` no store e sem hub, quando um cliente conecta, então o handshake responde `410` (se
  passou da consulta inicial ao store) e nenhum hub é criado.

## 6. Requisitos Funcionais

- RF-3701: o `onRegister` de um hub em `closed` envia `room-closed` ao cliente, fecha a conexão e não altera
  `clients`, `connectedStudents`, `publisherID`, status nem SFU.
- RF-3702: `getOrCreateHub` não recria o hub de uma sala cujo hub está `closed`; o hub encerrado permanece no mapa
  como marcador.
- RF-3703: ao criar um hub, `getOrCreateHub` confere no store, sob o lock do handler, que a sala existe e não está
  `closed`; se não estiver disponível, não cria.
- RF-3704: `serveWS` obtém o hub antes do upgrade; sem hub disponível, responde `410 sala encerrada`.

## 7. Requisitos Não Funcionais

- RNF-3701 — concorrência: ordem de locks `Handler.mu` → lock do store, sem o inverso; sem deadlock e sem data race
  (`go test -race` no CI Linux).
- RNF-3702 — contrato: nenhum tipo de mensagem, campo ou código de fechamento novo; `room-closed` e `410` já existem.
- RNF-3703 — dependências: nenhuma nova.

## 8. Estados e Erros

| Situação | Evento | Resultado |
|---|---|---|
| sala aberta, hub vivo | conexão | registra no hub |
| sala aberta, sem hub | conexão | cria hub e registra |
| hub `closed` | conexão | `410`, nenhum hub criado |
| sala ausente/`closed` no store, sem hub | conexão que passou da consulta inicial | `410`, nenhum hub criado |
| hub encerra depois do `getOrCreateHub` | `register` | `room-closed` e conexão fechada |

## 9. Edge Cases

- Encerramento e `register` chegam juntos: o `run()` os processa em ordem; o cliente ou recebe o `room-closed` com os
  demais, ou é recusado no `onRegister`.
- REST `close` de sala sem hub, concorrente à conexão: o store fica `closed` antes do `GetHub` do aviso de encerramento,
  e ambos tomam o lock do handler; ou o `getOrCreateHub` vê a sala `closed`, ou o hub criado é encontrado e recebe o
  sinal.
- Upgrade que falha depois de o hub ser criado: o hub fica vazio em `waiting`, como um hub cujos participantes saíram.

## 10. Dados/Contratos impactados

- `001/contracts/signaling.md`: nota de que a conexão a uma sala encerrada é recusada com `410` no handshake, ou com
  `room-closed` e fechamento sem código quando o encerramento ocorre durante a conexão. Sem mudança de formato.

## 11. Critérios de Sucesso

- Testes do pacote `signaling`: registro depois do encerramento (aluno e professor), `publish-request` sem efeito,
  `getOrCreateHub` com hub encerrado e com sala fora do store, handshake `410` por `httptest`.
- `go vet ./...`, `go test ./...` e o smoke verdes em `apps/backend`; `-race` no CI Linux.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-3701 a C-3704).
