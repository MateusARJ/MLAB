# Spec: Leitura Sincronizada do Status do Hub

Status: READY
Feature ID: `036-status-hub-sincronizado`
Origem: issue #102 (desvio registrado na 033/T3302). Corrige uma data race no backend de sinalização; não muda regra
de negócio, contrato nem ADR. Requisitos relacionados: RN-13 e RF-18 da `001-screen-share-core`.

## 1. Objetivo

Fazer o `signaling.Handler` ler o status da sessão do hub de forma sincronizada com as escritas da goroutine `run()`
do hub, eliminando a data race apontada na issue #102.

## 2. Contexto

Verificado em 2026-11-15 na `development` @ `82e2fa0`:

- `signaling/handler.go` (`getOrCreateHub`) lê `hub.status == SessionClosed` sob `Handler.mu`, na goroutine HTTP do
  `serveWS`, para decidir se descarta o hub encerrado e cria um novo.
- `signaling/hub.go` escreve `h.status` só na goroutine `run()`, sem lock: em `setStatus` (chamado por `onRegister`,
  `onUnregister`, `onPublishRequest` e `onStreamStarted`), em `onPublisherTimeout` e em `onRoomClose`.
- `Handler.mu` não ordena essas escritas (não há *happens-before*): pelo modelo de memória do Go é uma data race. O
  `serveWS` pode ler um valor antigo e reaproveitar um hub encerrado, e `go test -race` acusaria a leitura.
- O hub já resolve o mesmo caso para `connectedStudents` com `studentsMu sync.RWMutex`: só `run()` escreve e o join
  lê de outra goroutine (027/RNF-2702).
- Efeito prático reduzido: desde a 033, a sala encerrada pelo hub sai do store e o `serveWS` responde `404` antes de
  chegar ao `getOrCreateHub`.
- CI: `.github/workflows/build-all.yml` roda `go test ./...` sem `-race`; localmente o `-race` não roda (Windows sem
  cgo).

## 3. Escopo

### Incluído

- Sincronizar a escrita e a leitura externa do status do hub.
- Teste do pacote `signaling` com `getOrCreateHub` concorrente ao encerramento do hub.
- Passo de `go test -race` em `internal/signaling` e `cmd/server` na perna Linux do CI.

### Não incluído

- Recusar o registro de cliente em hub que encerrou entre o `getOrCreateHub` e o `hub.register` (janela TOCTOU
  anterior a esta feature; registrada como desvio, C-3602).
- Mudanças em `room`, `webrtc`, protocolo WebSocket, web, desktop e `packages/`.
- Remover hubs encerrados do mapa do handler fora do `getOrCreateHub`.

## 4. Atores

- **Professor e alunos:** conectam o WebSocket da sala (`serveWS`).
- **Mantenedor:** roda a suíte com o detector de race no CI.

## 5. User Stories

### US-3601 — Sala encerrada não reaproveita o hub antigo

Como participante que conecta depois do encerramento da sala pelo hub, quero ser registrado num hub novo, para não
cair numa sessão encerrada.

- Dado um hub encerrado (`end-session`, timeout de reconexão ou `close` REST), quando o handler busca o hub da sala,
  então recebe um hub novo em `waiting`, e a leitura do status não é uma data race.

## 6. Requisitos Funcionais

- RF-3601: o `signaling.Handler` lê o status do hub por um método do hub que sincroniza com as escritas da goroutine
  `run()`; nenhuma leitura de `hub.status` fora dessa goroutine acessa o campo diretamente.

## 7. Requisitos Não Funcionais

- RNF-3601 — race: `go test -race ./internal/signaling/ ./cmd/server/` limpo, executado na perna Linux do CI.
- RNF-3602 — sem mudança de comportamento: transições de status, avisos `onStatusChanged`/`onClosed`, mensagens
  WebSocket e contratos continuam iguais; os callbacks não rodam sob o lock novo (sem deadlock com o store).
- RNF-3603 — dependências: nenhuma nova.

## 8. Estados e Erros

| Situação | Evento | Resultado |
|---|---|---|
| hub em `waiting`/`publishing`/`reconnecting` | `getOrCreateHub` | devolve o mesmo hub |
| hub em `closed` | `getOrCreateHub` | descarta o antigo e cria um hub novo em `waiting` |

## 9. Edge Cases

- `getOrCreateHub` chamado ao mesmo tempo que o hub processa `sigRoomClose`: lê `closed` ou o status anterior, sem
  race; se ler o anterior, devolve o hub antigo (janela TOCTOU fora do escopo, mitigada pelo `404` do store).

## 10. Dados/Contratos impactados

- Nenhum contrato muda. `.github/workflows/build-all.yml` ganha um passo de teste.

## 11. Critérios de Sucesso

- Teste do pacote `signaling`: goroutines chamando `getOrCreateHub` enquanto o hub encerra; depois do encerramento,
  `getOrCreateHub` devolve um hub novo em `waiting`.
- `go vet ./...` e `go test ./...` verdes em `apps/backend`; `go test -race` dos dois pacotes verde no CI Linux.

## 12. Perguntas que bloqueiam a implementação

- [x] Nenhuma. Respondidas em `clarify.md` (C-3601 a C-3604).
