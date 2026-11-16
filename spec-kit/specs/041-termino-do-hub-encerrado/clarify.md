# Clarify: Término da Goroutine do Hub Encerrado

Feature: `041-termino-do-hub-encerrado`
Status: CLOSED

Decisões registradas em 2026-11-15 na correção da issue #109, pedida pelo responsável. Nenhuma altera comportamento
visível, contrato ou arquitetura.

## C-4101 — Como terminar sem bloquear os remetentes

- **Opções:**
  - (A) canais com buffer grande e `run()` drenando antes de sair;
  - (B) canal `done` fechado por `run()`, e todo envio ao hub escuta `done`.
- **Resposta:** **B**. Buffer não garante nada (o `readPump` e o REST podem enviar a qualquer momento depois). Com
  `done`, nenhum envio bloqueia depois do término. Os canais com buffer conferem `done` antes do envio, porque o
  `select` escolhe ao acaso entre casos prontos.
- **Onde conferir o término:** em `run()`, depois de cada evento, pois os três encerramentos chegam por ela (`route`
  para `end-session`, `sigRoomClose`, `sigPublisherTimeout`).
- **Impacto em spec:** RF-4101 e RF-4103.

## C-4102 — Marcador e encerramento repetido

- O hub terminado continua no mapa como marcador (037/RF-3702), sem estado de sala.
- Um `BroadcastRoomClosed` (REST) depois de um encerramento pelo WebSocket é descartado. Hoje ele reexecuta
  `onClosed` e `sfu.RoomClosed` sem efeito útil (a sala já saiu do store e da SFU); a mudança não é visível ao usuário.
- **Impacto em spec:** RF-4104 e seção 9.

## C-4103 — Entrega, faixa de IDs e versão

- **Entrega:** uma feature e um PR, a partir da `fix/registro-antes-da-leitura` (039), que mexe nos mesmos arquivos;
  rebase na `development` depois do merge da 039.
- **Faixa de IDs:** `US-410x`, `RF-410x`, `RNF-410x`, `C-410x` e `T410x`.
- **Impacto de versão:** **PATCH**. Correção de vazamento, sem capacidade nova nem mudança de contrato
  (`docs/versionamento.md` §2).

## Resultado

CLOSED: C-4101 a C-4103 respondidas, sem ambiguidade em aberto.
