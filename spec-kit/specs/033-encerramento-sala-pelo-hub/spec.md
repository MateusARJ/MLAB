# Spec: Encerramento da Sala pelo Hub Reflete no Store

Status: READY
Feature ID: `033-encerramento-sala-pelo-hub`
Origem: issues #94 e #95 (desvios registrados na 029). Restaura a conformidade com RN-08, RN-13, RF-15 e RF-18 da
`001-screen-share-core` e alinha o contrato do `GET /rooms/{id}/info` ao código; não muda regra de negócio nem ADR.

## 1. Objetivo

Fazer o encerramento da sala pelo hub de sinalização (timeout de reconexão do professor ou `end-session` pelo
WebSocket) ter o mesmo efeito do encerramento pela REST `POST /rooms/{id}/close`: a sala deixa de existir para novas
entradas. E corrigir o contrato do `/info`, que lista um status que o código nunca devolve.

## 2. Contexto

Verificado em 2026-11-15 na `development` @ `e380ddb`:

- RN-13 (`001/spec.md`): "janela de reconexão do publisher de 30 segundos **antes do encerramento da sala**"; RF-18:
  perda de conexão do professor coloca a sala em `reconnecting` por 30 s. RN-08: sala encerrada rejeita novas
  entradas.
- REST `closeRoom` (`room/handler.go`): `UpdateRoomStatus(closed)` → aviso ao hub (`room-closed`) → `DeleteRoom` →
  `ReleaseRoomFiles` → `StopMDNSServer`. O link passa a dar `404 "sala não encontrada"`.
- Hub (`signaling/hub.go`): `onPublisherTimeout` e `onRoomClose` (este também via `end-session`) marcam só
  `SessionClosed` no hub, avisam os clientes, fecham a SFU e chamam `onClosed`. Em `cmd/server/main.go`, `onClosed`
  está ligado a `roomHandler.ReleaseRoomFiles`, que só libera arquivos.
- Efeito: depois do encerramento só pelo hub, a sala continua no store com o status anterior. `join` responde `200`,
  `GET /rooms/active` continua anunciando a sala e o WebSocket (`getOrCreateHub`) descarta o hub encerrado e cria um
  novo. O aluno entra numa sala que não volta. O app desktop, no fluxo normal, chama a REST `close` além do
  `end-session`, o que esconde o problema nesse caminho, mas não no timeout.
- Contrato `001/contracts/room-api.md`, `GET /rooms/{roomId}/info`: o `200` lista
  `status: waiting | publishing | reconnecting | closed` e o único erro é `404 Room not found`. O código
  (`handleGetRoomInfo`) responde `404 "esta transmissão já foi encerrada"` para sala `closed`.
- Único consumidor do `/info`: `apps/web/src/services/api.ts` (`getRoomInfo`), que trata qualquer resposta não-2xx como
  `null`; `Join.tsx` usa só título e nome do professor. O campo `status` não é lido.

## 3. Escopo

### Incluído

- Backend: o encerramento pelo hub marca a sala como `closed` e a remove do store, liberando arquivos e o anúncio mDNS
  como na REST `close`.
- Testes Go (unitário no pacote `room` e smoke do timeout e do `end-session`).
- Contrato do `/info`: sem `closed` no `200` e com os dois `404` documentados.
- Espelho `RF015` e evidências no `001/converge.md`.

### Não incluído

- Retomar a sala depois do timeout de reconexão.
- Gravar `publishing` ou `reconnecting` no store.
- Trocar o `404` de sala removida por `409`.
- Mudanças no web, no desktop, em `packages/**`, no hub de sinalização e na SFU.

## 4. Atores

- **Professor:** perde a conexão e não volta em 30 s, ou encerra a sessão pelo WebSocket.
- **Aluno:** abre o link depois do encerramento.

## 5. User Stories

### US-3301 — Sala encerrada pelo hub não aceita novas entradas

Como aluno, quero ser avisado de que a sala não existe mais quando abro o link depois do encerramento, para não ficar
esperando uma transmissão que não volta.

- Dado que o professor caiu e não voltou em 30 s, quando o aluno chama o `join`, então recebe `404
  "sala não encontrada"`, sem token.
- Dado que o professor enviou `end-session` sem chamar a REST `close`, quando o aluno chama o `join`, então recebe o
  mesmo `404`.
- Dado qualquer um desses encerramentos, `GET /rooms/{id}/info` e `GET /rooms/active` respondem `404`.

### US-3302 — Contrato do `/info` descreve o que o servidor responde

Como cliente da API, quero que o contrato do `/info` liste só os status e erros que o servidor emite.

## 6. Requisitos Funcionais

- RF-3301: quando o hub encerra a sala (timeout de reconexão do professor ou `end-session`), o backend marca a sala
  como `closed`, a remove do store e libera os arquivos dela, na mesma sequência da REST `close`.
- RF-3302: depois do RF-3301, `POST /rooms/{id}/join` (e `/{sala}/{prof}/join`), `GET /rooms/{id}/info` e
  `GET /rooms/active` respondem `404`; o WebSocket da sala responde `404` e não cria hub novo.
- RF-3303: o contrato do `GET /rooms/{roomId}/info` lista no `200` só `waiting | publishing | reconnecting` e documenta
  `404 "sala não encontrada"` (sala inexistente ou removida) e `404 "esta transmissão já foi encerrada"` (sala `closed`
  ainda presente no store).

## 7. Requisitos Não Funcionais

- RNF-3301 — mDNS: o encerramento pelo hub só para o anúncio mDNS quando é ele quem encerra a sala no store. Quando a
  REST `close` já encerrou a sala, o aviso posterior do hub não para o anúncio de uma sala criada depois.
- RNF-3302 — idempotência: repetir o encerramento, ou encerrar sala já removida, não falha nem altera outra sala.
- RNF-3303 — dependências: nenhuma nova.

## 8. Estados e Erros

| Situação | Evento | Resultado |
|---|---|---|
| sala aberta, professor caiu | timeout de 30 s | `room-closed` aos clientes; sala `closed` e removida do store (RF-3301) |
| sala aberta | `end-session` do professor | idem (RF-3301) |
| sala encerrada pelo hub | `join`, `/info`, `/rooms/active` | `404` (RF-3302) |
| sala já encerrada pela REST | aviso do hub chega depois | só libera arquivos; mDNS não é tocado (RNF-3301) |

## 9. Edge Cases

- REST `close` e `end-session` juntos (fluxo normal do desktop): a REST marca e remove a sala antes de avisar o hub;
  o listener do hub encontra a sala removida e não repete o encerramento.
- Professor cria sala nova logo após encerrar a anterior: o aviso atrasado do hub da sala antiga não para o mDNS da
  nova (RNF-3301).
- Sala `closed` ainda no store (só alcançável em teste): `join` segue `409` (RN-08, 029) e `/info` segue `404`.

## 10. Dados/Contratos impactados

- `001/contracts/room-api.md`, seção `GET /rooms/{roomId}/info` (RF-3303). Só documentação; o código não muda.
- Espelho `docs/requirements/functionals/RF015-encerramento-de-sala-e-conexoes.md`.

## 11. Critérios de Sucesso

- Teste Go do pacote `room`: depois do encerramento pelo hub, a sala some do store e `join`, `/info` e
  `/rooms/active` respondem `404`; a repetição não falha.
- Smoke: no A18, depois do `room-closed` do timeout, `join` e `/info` respondem `404`; subteste novo com `end-session`
  sem REST `close` dá o mesmo resultado.
- `go test ./...` verde em `apps/backend` e smoke verde.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-3301 a C-3305).
