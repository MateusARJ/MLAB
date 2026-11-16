# Spec: Status da Sala Acompanha a Sessão do Hub

Status: READY
Feature ID: `035-status-sala-pelo-hub`
Origem: issue #101 (desvio registrado na 033/T3302). Restaura a conformidade com RF-18 da `001-screen-share-core`, com
o contrato `001/contracts/room-api.md` (`/info`, `/rooms/active`, `join`) e com RNF-SEC-05 da `002-security-hardening`;
não muda regra de negócio nem ADR.

## 1. Objetivo

Fazer o status público da sala (`GET /rooms/{id}/info`, `GET /rooms/active` e `room_status` do `join`) refletir o
estado da sessão que o hub de sinalização já controla: `waiting`, `publishing` ou `reconnecting`.

## 2. Contexto

Verificado em 2026-11-15 na `development` @ `44c525f`:

- O hub (`signaling/hub.go`) mantém o estado da sessão em `hub.status`. Passa a `publishing` quando o professor
  registra o WebSocket (`onRegister`), envia `publish-request` (`onPublishRequest`) ou quando a trilha de vídeo chega à
  SFU (`onStreamStarted`); passa a `reconnecting` quando o publisher cai (`onUnregister`).
- Só o encerramento chega ao store: a 033 ligou o `onClosed` do hub a `room.Handler.CloseRoomFromSession`. Nenhum
  código grava `publishing` ou `reconnecting` no store (`grep UpdateRoomStatus` só encontra `StatusClosed`).
- Efeito: a sala fica `waiting` no store até ser encerrada. `/info` e o `join` sempre informam `waiting`;
  `GET /rooms/active` nunca aplica a prioridade de `publishing` (RNF-SEC-05), que só é exercida no teste
  `TestGetActiveRoom_Deterministic`.
- `room.Status` não tem `reconnecting`, e `GetActiveRoom` só considera `waiting` e `publishing`: uma sala em
  `reconnecting` sumiria de `/rooms/active` se o status fosse só copiado.
- `UpdateRoomStatus` grava sem verificar o estado atual. Uma gravação tardia de `publishing` depois do encerramento
  reabriria a sala e recriaria os índices de slug.
- Contrato: `/info` já declara `waiting | publishing | reconnecting`; o `join` declara `room_status: waiting |
  publishing`; `/rooms/active` declara a prioridade `publishing`, depois `waiting` mais recente.
- `packages/types`: `RoomStatus = 'waiting' | 'publishing' | 'closed'`, usado em `Room`, `CreateRoomResponse` e
  `JoinRoomResponse`.
- Consumidores: nenhum código do web ou do desktop lê o `status` REST; os dois usam o `session-state` do WebSocket.

## 3. Escopo

### Incluído

- Backend: o hub avisa cada mudança de status da sessão (`publishing`, `reconnecting`) e o store a registra.
- Status `reconnecting` no modelo da sala e na seleção da sala ativa.
- Proteção contra gravação tardia em sala encerrada ou removida.
- Testes Go dos pacotes `room` e `signaling`.
- Contrato `room-api.md` (`join` e `/rooms/active`) e tipo `RoomStatus` em `packages/types`.
- Espelho `RF018` e evidências nos `converge.md` da 001 e da 002.

### Não incluído

- Mudar quando o hub entra em `publishing` (hoje, ao conectar o professor).
- Exibir o status REST no web ou no desktop.
- Mudanças no protocolo WebSocket, na SFU, no web e no desktop.
- Persistência (ADR 0005).

## 4. Atores

- **Professor:** conecta, transmite, perde a conexão e volta.
- **Aluno / web app:** consulta `/info`, `/rooms/active` e o `join`.

## 5. User Stories

### US-3501 — Status público acompanha a transmissão

Como cliente da API, quero que o status da sala nas respostas REST seja o mesmo da sessão, para saber se a aula está
no ar.

- Dado que o professor está conectado à sala, quando consulto `/info`, então o `status` é `publishing`; o `join`
  devolve `room_status: publishing`.
- Dado que o professor perdeu a conexão há menos de 30 s, então o `status` é `reconnecting`.
- Dado que o professor voltou dentro dos 30 s, então o `status` volta a `publishing`.

### US-3502 — Aluno cai na sala que está no ar

Como aluno que abre a raiz `/`, quero ser levado à sala que está transmitindo, e não à criada por último.

- Dadas uma sala em `publishing` e outra em `waiting` criada depois, `/rooms/active` devolve a sala em `publishing`.
- Dadas uma sala em `reconnecting` e outra em `waiting` criada depois, `/rooms/active` devolve a sala em
  `reconnecting`.

## 6. Requisitos Funcionais

- RF-3501: cada mudança de status da sessão no hub para `publishing` ou `reconnecting` é registrada no store da sala.
  O `closed` segue pelo caminho da 033 (`CloseRoomFromSession`).
- RF-3502: `GET /rooms/{id}/info` (e `/{sala}/{prof}/info`), `GET /rooms/active` e o `room_status` do `join` devolvem o
  status registrado: `waiting | publishing | reconnecting`.
- RF-3503: `GET /rooms/active` escolhe entre as salas não encerradas pela ordem `publishing > reconnecting > waiting`;
  entre salas do mesmo status vence a criada mais recentemente.
- RF-3504: o contrato `room-api.md` e o tipo `RoomStatus` de `packages/types` incluem `reconnecting`.

## 7. Requisitos Não Funcionais

- RNF-3501 — sem reabertura: gravação de status em sala `closed` ou já removida do store não altera nada e não
  recria índices de slug.
- RNF-3502 — concorrência: a gravação roda na goroutine do hub, só usa o lock do store e não chama o hub de volta; sem
  deadlock e sem data race (`go test -race`).
- RNF-3503 — dependências: nenhuma nova.

## 8. Estados e Erros

| Situação | Evento | Status no store |
|---|---|---|
| sala criada | — | `waiting` |
| `waiting` ou `reconnecting` | professor registra o WebSocket, `publish-request` ou trilha pronta | `publishing` |
| `publishing` | publisher desconecta | `reconnecting` |
| `reconnecting` | timeout de 30 s ou `end-session` | sala removida (033) |
| sala `closed` ou removida | aviso tardio de `publishing`/`reconnecting` | nada muda (RNF-3501) |

## 9. Edge Cases

- REST `close` com o hub ainda ativo: a REST marca e remove a sala; um aviso de status que chegue depois é ignorado.
- Professor cria sala nova (a anterior é marcada `closed` em `createRoom`): avisos do hub antigo não reabrem a anterior.
- Aviso repetido do mesmo status: o hub só avisa quando o status muda.

## 10. Dados/Contratos impactados

- `001/contracts/room-api.md`: `room_status` do `join` passa a `waiting | publishing | reconnecting`; `/rooms/active`
  documenta a ordem `publishing > reconnecting > waiting` (RF-3503). `/info` já está correto.
- `packages/types/src/index.ts`: `RoomStatus` inclui `'reconnecting'`.
- Espelho `docs/requirements/functionals/RF018-gestao-de-reconexao-do-professor-timeout-30s.md`.

## 11. Critérios de Sucesso

- Teste do pacote `room`: transições, proteção da sala encerrada, prioridade com as três salas e respostas de `/info`,
  `join` e `/rooms/active` depois da sincronização.
- Teste do pacote `signaling`: o hub avisa `publishing` ao registrar o professor, `reconnecting` quando ele cai e
  `publishing` quando volta, sem aviso repetido.
- `go test -race ./...` e `go vet ./...` verdes em `apps/backend`; build de `packages/types` e typecheck do monorepo
  verdes.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-3501 a C-3504).
