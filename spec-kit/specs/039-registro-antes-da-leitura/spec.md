# Spec: Registro do Cliente antes da Leitura

Status: READY
Feature ID: `039-registro-antes-da-leitura`
Origem: issue #114 (desvio encontrado na 038/T3801; bloqueante para o PR de release #26). Corrige a ordem de início
da leitura do cliente WebSocket; não muda regra de negócio, contrato nem ADR.

## 1. Objetivo

Garantir que toda mensagem de um cliente aceito seja processada pelo hub depois do registro dele, para que a primeira
mensagem enviada ao abrir o WebSocket (`publish-request`, `subscribe-request`, `end-session`) nunca seja descartada.

## 2. Contexto

Verificado em 2026-11-15 na `development` @ `ecf1583`:

- `newClient` (`signaling/client.go`) inicia o `writePump` e o `readPump`; só depois o `serveWS` (`handler.go`) envia
  `hub.register <- client`.
- O `readPump` pode pôr a primeira mensagem em `hub.inbound` (buffer 256) antes de o hub consumir `register` (sem
  buffer). Com os dois canais prontos, o `select` de `run()` escolhe ao acaso; se escolher `inbound`, o `route`
  descarta a mensagem, porque o cliente ainda não está em `clients`.
- Efeito no teste `TestServeWS_ConexaoDuranteEncerramento`: o `end-session` enviado logo depois do `Dial` se perde, a
  sala não encerra e as conexões estouram o prazo de leitura (`i/o timeout`, "conexão 0"). Medido no #114: 2 falhas
  em 50 execuções sem `-race`; nova ocorrência no CI do PR #26 (run 43778784875).
- O mesmo caminho pode descartar o `publish-request` do desktop e o `subscribe-request` do aluno.

## 3. Escopo

### Incluído

- Iniciar o `readPump` só depois de o hub receber o cliente por `register`.
- Teste de ponta a ponta que envia a primeira mensagem com o hub ocupado no momento do registro.

### Não incluído

- Fila de mensagens de cliente não registrado no hub.
- Mudanças em `hub.go`, `message.go`, `room`, `webrtc`, web, desktop e `packages/`.
- Término da goroutine do hub encerrado (issue #109, feature própria).

## 4. Atores

- **Professor:** o desktop envia `publish-request` e, ao encerrar, `end-session` pelo WebSocket.
- **Aluno:** o web envia `subscribe-request` ao abrir o WebSocket.

## 5. User Stories

### US-3901 — Primeira mensagem do cliente nunca é descartada

Como professor ou aluno, quero que a mensagem que envio logo depois de conectar seja processada, para que a transmissão
inicie, o vídeo chegue e a sala encerre sem depender de reenvio.

- Dado um cliente aceito, quando ele envia uma mensagem logo depois do `Dial`, então o hub a processa depois do
  registro, mesmo que esteja ocupado no momento do registro.
- Dado um cliente recusado no registro (sala encerrada ou matrícula em uso), então ele recebe `room-closed` ou o close
  `4002` e a conexão fecha, como antes.

## 6. Requisitos Funcionais

- RF-3901: `newClient` inicia só o `writePump`; o `serveWS` inicia o `readPump` depois de `hub.register <- client`.
- RF-3902: o cliente recusado no registro continua lendo até a conexão fechar e envia o `unregister` que o hub ignora,
  sem mudança de comportamento.
- RF-3903: a ordem das mensagens enviadas ao cliente no registro não muda (`ice-servers` continua depois do registro).

## 7. Requisitos Não Funcionais

- RNF-3901 — concorrência: `go test -race ./internal/signaling/ ./cmd/server/` sem corrida e
  `TestServeWS_ConexaoDuranteEncerramento` sem falha em 200 execuções no Linux.
- RNF-3902 — contrato: nenhum tipo de mensagem, campo ou código de fechamento novo.
- RNF-3903 — dependências: nenhuma nova.

## 8. Estados e Erros

| Situação | Evento | Resultado |
|---|---|---|
| hub livre | cliente conecta e envia mensagem | registro, depois a mensagem |
| hub ocupado no registro | cliente conecta e envia mensagem | o handler espera o registro; a leitura só começa depois |
| sessão encerrada | cliente conecta | `room-closed` e fechamento; o `unregister` é ignorado |
| matrícula em uso | aluno conecta | close `4002`; o `unregister` é ignorado |

## 9. Edge Cases

- Mensagem enviada antes de o handler iniciar a leitura: fica no buffer do socket e é lida depois do registro.
- Ping do servidor antes do início da leitura: o pong só é tratado quando a leitura começa, dentro do `pongWait` de
  60 s.

## 10. Dados/Contratos impactados

- Nenhum. `signaling.md` já pressupõe que `publish-request` e `subscribe-request` são processados; a correção garante
  isso.

## 11. Critérios de Sucesso

- Teste do pacote `signaling` que segura o hub no registro e exige a resposta à primeira mensagem do aluno; falha na
  `development` e passa com a correção.
- `go vet ./...` e `go test ./...` em `apps/backend`; no container Linux (`golang:1.26`):
  `go test -count=200 -run TestServeWS_ConexaoDuranteEncerramento ./internal/signaling/` sem falha e o passo `-race`
  do CI sem corrida.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-3901 e C-3902).
