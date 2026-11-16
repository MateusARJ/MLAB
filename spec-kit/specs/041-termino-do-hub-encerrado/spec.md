# Spec: Término da Goroutine do Hub Encerrado

Status: READY
Feature ID: `041-termino-do-hub-encerrado`
Origem: issue #109 (desvio encontrado na 037/T3703). Corrige um vazamento de goroutine e de memória por sala
encerrada; não muda regra de negócio, contrato nem ADR.

## 1. Objetivo

Fazer a goroutine `run()` de cada hub terminar depois do encerramento da sala e liberar o estado que não serve mais,
mantendo só o necessário para recusar conexões da sala encerrada.

## 2. Contexto

Verificado em 2026-11-15 sobre a `fix/registro-antes-da-leitura` (039), a partir da `development` @ `ecf1583`:

- `run()` (`signaling/hub.go`) é um `for { select }` sem saída: continua viva depois de `onRoomClose` ou
  `onPublisherTimeout`.
- Desde a 037 (RF-3702), o hub encerrado fica no mapa `Handler.hubs` como marcador para recusar novas conexões com
  `410`. Com a goroutine viva, o marcador guarda também o histórico de chat (até 200 mensagens), os arquivos
  compartilhados, os fixados e os limites de chat enquanto o backend embarcado estiver rodando.
- Medido: criar e encerrar 20 salas pelo WebSocket deixa 20 goroutines a mais (3 antes, 23 depois).
- Fazer `run()` simplesmente retornar bloquearia quem envia aos canais do hub: `register` (handler), `unregister` e
  `inbound` (`readPump`), `internal` (`BroadcastRoomClosed` do REST, `BroadcastStreamStarted`, timer de reconexão).

## 3. Escopo

### Incluído

- Término de `run()` depois do encerramento, com sinal `done`.
- Liberação do estado da sala encerrada (chat, arquivos, fixados, limites, timer).
- Envios ao hub que não bloqueiam depois do término.
- Unificação de `onRoomClose` e `onPublisherTimeout` num encerramento comum.

### Não incluído

- Remover o marcador do mapa `Handler.hubs` (a 037 o exige para responder `410`).
- Mudanças em `message.go`, `room`, `webrtc`, `cmd`, web, desktop e `packages/`.

## 4. Atores

- **Professor:** encerra a sala pelo desktop (`end-session` ou REST) ou some sem reconectar (timeout).
- **Aluno e professor que conectam depois do término:** recebem `room-closed`, como na 037.

## 5. User Stories

### US-4101 — Sala encerrada não deixa goroutine nem estado para trás

Como mantenedor do backend embarcado, quero que cada sala encerrada libere a goroutine e o estado do hub, para que
uma execução longa com várias aulas não acumule memória.

- Dado um hub com chat, arquivos e fixados, quando a sala encerra por `end-session`, pelo REST ou pelo timeout de
  reconexão, então a goroutine `run()` termina e o hub não guarda clientes, chat, arquivos, fixados nem limites.
- Dado um hub que já terminou, quando um cliente conecta, uma mensagem chega ou um sinal interno é enviado, então nada
  bloqueia; o cliente recebe `room-closed` e é fechado.
- Dado um hub que terminou, quando o handshake chega, então a resposta continua `410` e nenhum hub novo é criado.

## 6. Requisitos Funcionais

- RF-4101: `run()` termina depois de processar o evento que encerra a sessão e fecha o canal `done`.
- RF-4102: antes de terminar, `run()` para o timer de reconexão e libera `clients`, `chatLimits`, `chatHistory`,
  `sharedFiles`, `pinnedPublic` e `pinnedPrivate`.
- RF-4103: todo envio aos canais do hub (`register`, `unregister`, `inbound`, `internal`, `fileShared`) escuta `done` e
  não bloqueia depois do término; o cliente entregue a um hub terminado recebe `room-closed` e é fechado.
- RF-4104: o hub terminado continua no mapa `Handler.hubs` como marcador (037/RF-3702); `GetHub`, `isClosed` e
  `HasConnectedStudent` continuam seguros.

## 7. Requisitos Não Funcionais

- RNF-4101 — concorrência: `go test -race ./internal/signaling/ ./cmd/server/` sem corrida.
- RNF-4102 — contrato: nenhum tipo de mensagem, campo ou código de fechamento novo.
- RNF-4103 — dependências: nenhuma nova.

## 8. Estados e Erros

| Situação | Evento | Resultado |
|---|---|---|
| sessão viva | `end-session`, `sigRoomClose` ou timeout | encerramento, liberação do estado, `done` fechado, `run()` termina |
| hub terminado | handshake | `410` (037) |
| hub terminado | `enroll` de cliente já aceito no handshake | `room-closed` e fechamento, sem bloquear |
| hub terminado | `readPump` lê mensagem ou termina | `deliver`/`leave` retornam sem bloquear |
| hub terminado | `BroadcastRoomClosed`, `BroadcastStreamStarted`, `BroadcastFileShared`, timer | descartado sem bloquear |

## 9. Edge Cases

- REST close depois de um encerramento pelo WebSocket: o sinal é descartado; `onClosed` e `sfu.RoomClosed` não rodam
  uma segunda vez (C-4102).
- Timer de reconexão que dispara depois do término: o sinal é descartado; o timer já foi parado no `release`.
- Handler que obteve o hub antes do encerramento e registra depois do término: `enroll` entrega `room-closed`.

## 10. Dados/Contratos impactados

- Nenhum.

## 11. Critérios de Sucesso

- Testes do pacote `signaling`: término pelos três caminhos com estado liberado; envios depois do término sem bloqueio;
  20 salas encerradas pelo WebSocket sem goroutines a mais (o teste falha no código anterior: 3 → 23).
- `go vet ./...` e `go test ./...` em `apps/backend`; `-race` sem corrida no container Linux (`golang:1.26`).

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-4101 a C-4103).
