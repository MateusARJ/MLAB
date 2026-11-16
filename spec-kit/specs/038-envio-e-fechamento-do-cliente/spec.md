# Spec: Envio e Fechamento do Cliente sem Corrida

Status: READY
Feature ID: `038-envio-e-fechamento-do-cliente`
Origem: issue #111 (desvio bloqueante encontrado na análise do PR de release #26). Corrige uma data race no cliente
WebSocket; não muda regra de negócio, contrato nem ADR.

## 1. Objetivo

Garantir que nenhuma mensagem seja enviada ao canal de saída de um cliente WebSocket ao mesmo tempo em que esse canal é
fechado, para que o detector de race do Go não acuse corrida e o comportamento não dependa de `recover()`.

## 2. Contexto

Verificado em 2026-11-15 na `development` @ `a0b9243`:

- `Client.send` (`signaling/client.go`) é o canal de saída de cada conexão. Ele é fechado por `closeWithCode`
  (`close(c.send)`, protegido só por `sync.Once`) e recebe mensagens por `safeSend`, que faz um envio não bloqueante e
  usa `recover()` para engolir o panic de envio em canal fechado.
- Três goroutines enviam ao canal de um mesmo cliente:
  1. a goroutine `run()` do hub, que também é quem fecha o canal (`onRegister`, `onUnregister`, `end-session`,
     sessão duplicada);
  2. o handler HTTP (`serveWS`, `handler.go:131`), que envia `ice-servers` logo depois do `hub.register <- client`;
  3. o `readPump` (`client.go:98`), que envia `error` `INVALID_MESSAGE` quando recebe JSON inválido.
- Desde a 037, o `onRegister` de um hub encerrado envia `room-closed` e fecha o cliente. Na CI do PR #26 (run
  43769408583, Linux), `TestServeWS_ConexaoDuranteEncerramento` falhou com `WARNING: DATA RACE` entre
  `closechan` (`client.go:178`, chamado de `hub.go:278`) e `chansend` (`client.go:149`, chamado de `handler.go:131`).
- O caminho de recusa por matrícula duplicada (`4002`, `hub.go:292`) e o `readPump` têm o mesmo padrão.

## 3. Escopo

### Incluído

- Serializar envio e fechamento no `Client`: depois do fechamento, todo envio é descartado sem tocar no canal.
- Teste Go com envios concorrentes ao fechamento, rodado com `-race`.

### Não incluído

- Mudar a ordem das mensagens enviadas no registro (`ice-servers` continua depois do `register`).
- Mudanças em `hub.go`, `handler.go`, `message.go`, `room`, `webrtc`, web, desktop e `packages/`.
- Código de fechamento, tipo de mensagem ou campo novo.

## 4. Atores

- **Professor e aluno:** conectam enquanto o hub os recusa (sala encerrada ou matrícula duplicada) ou enviam mensagem
  inválida enquanto a conexão é fechada.

## 5. User Stories

### US-3801 — Envio depois do fechamento é descartado sem corrida

Como mantenedor do backend, quero que um envio concorrente ao fechamento do cliente seja descartado de forma
sincronizada, para que o build Linux com `-race` passe e o servidor não dependa de `recover()`.

- Dado um cliente fechado, quando qualquer goroutine envia uma mensagem a ele, então o envio é descartado, devolve
  `false` e o canal não é tocado.
- Dado um cliente aberto, quando várias goroutines enviam e outra o fecha ao mesmo tempo, então `go test -race` não
  acusa corrida e cada envio é entregue antes do fechamento ou descartado depois dele.
- Dado um cliente aberto com o buffer cheio, então o envio continua não bloqueante e descarta a mensagem, como hoje.

## 6. Requisitos Funcionais

- RF-3801: `Client` serializa `safeSend` e `closeWithCode` com um lock próprio; `closeWithCode` marca o cliente como
  fechado e fecha o canal sob o lock, e `safeSend` descarta a mensagem (retorna `false`) quando o cliente já está
  fechado.
- RF-3802: o envio continua não bloqueante: buffer cheio descarta a mensagem e registra o log atual.
- RF-3803: o fechamento continua idempotente; só a primeira chamada define o close code enviado pelo `writePump`.

## 7. Requisitos Não Funcionais

- RNF-3801 — concorrência: nenhuma operação bloqueante sob o lock do cliente; `go test -race ./internal/signaling/`
  sem corrida.
- RNF-3802 — contrato: nenhum tipo de mensagem, campo ou código de fechamento novo.
- RNF-3803 — dependências: nenhuma nova.

## 8. Estados e Erros

| Situação | Evento | Resultado |
|---|---|---|
| cliente aberto, buffer com espaço | envio | mensagem entra no canal |
| cliente aberto, buffer cheio | envio | mensagem descartada, log, `false` |
| cliente fechado | envio | mensagem descartada, `false`, canal intocado |
| cliente aberto | fechamento | canal fechado sob o lock; `writePump` envia o close frame |
| cliente fechado | novo fechamento | sem efeito |

## 9. Edge Cases

- `ice-servers` enviado pelo handler depois de o hub recusar o cliente: descartado; o cliente recebe `room-closed` ou o
  close `4002` e o fechamento, como antes.
- JSON inválido lido pelo `readPump` enquanto o hub fecha a conexão: o `error` é descartado se o fechamento vier
  primeiro.

## 10. Dados/Contratos impactados

- Nenhum. O comportamento visto pelos clientes não muda.

## 11. Critérios de Sucesso

- Teste do pacote `signaling` com envios concorrentes ao fechamento e envio depois do fechamento.
- `go vet ./...` e `go test ./...` em `apps/backend`; `go test -race ./internal/signaling/ ./cmd/server/` (o passo do
  CI Linux) sem corrida, incluindo `TestServeWS_ConexaoDuranteEncerramento`.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-3801 e C-3802).
