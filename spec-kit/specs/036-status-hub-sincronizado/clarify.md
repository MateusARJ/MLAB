# Clarify: Leitura Sincronizada do Status do Hub

Feature: `036-status-hub-sincronizado`
Status: CLOSED

Decisões aprovadas pelo responsável em 2026-11-15, na análise da issue #102.

## C-3601 — Como sincronizar o status

- **Opções:** (A) `sync.RWMutex` próprio, como o `studentsMu`; (B) `sync/atomic`; (C) perguntar ao hub pelo canal.
- **Resposta aprovada:** **A**. Segue o padrão que o hub já usa e que a issue cita. A leitura externa só acontece na
  conexão de WebSocket, então o custo do lock não importa. (C) bloquearia o `serveWS` na goroutine do hub.
- **Impacto em spec:** RF-3601, RNF-3602.

## C-3602 — Janela entre `getOrCreateHub` e `hub.register`

- **Contexto:** o hub pode encerrar depois de `getOrCreateHub` devolver e antes do `hub.register <- client`.
- **Resposta aprovada:** fora do escopo. Fechar a janela muda comportamento (recusar o registro em hub encerrado) e
  exige spec própria; o `404` do store (033) já a mitiga. Registrada como desvio (AGENTS §14).
- **Impacto em spec:** seção 3 (Não incluído), seção 9.

## C-3603 — Onde verificar o `-race`

- **Resposta aprovada:** passo `go test -race ./internal/signaling/ ./cmd/server/` só na perna `ubuntu-latest` do
  `build-all.yml`, que tem gcc; Windows sem cgo e macOS ficam como estão. O workflow roda em PR para a `main`.
- **Impacto em spec:** RNF-3601.

## C-3604 — Entrega, faixa de IDs e versão

- **Entrega:** uma feature e um PR, com commits atômicos por tarefa.
- **Faixa de IDs:** `US-360x`, `RF-360x`, `RNF-360x`, `C-360x` e `T360x`.
- **Impacto de versão:** **PATCH**. Correção de concorrência sem mudança de capacidade nem de contrato
  (`docs/versionamento.md` §2).

## Resultado

CLOSED — C-3601 a C-3604 respondidas; nenhuma ambiguidade em aberto.
