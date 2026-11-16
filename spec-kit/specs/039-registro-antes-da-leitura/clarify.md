# Clarify: Registro do Cliente antes da Leitura

Feature: `039-registro-antes-da-leitura`
Status: CLOSED

Decisões registradas em 2026-11-15 na correção da issue #114, pedida pelo responsável. Nenhuma altera comportamento
visível, contrato ou arquitetura.

## C-3901 — Onde corrigir

- **Opções:**
  - (A) o hub guarda numa fila as mensagens de cliente ainda não registrado e as processa no registro;
  - (B) o handler inicia o `readPump` só depois do `hub.register <- client`.
- **Resposta:** **B**. O envio para `register` é síncrono e o hub roda `onRegister` inteiro antes de ler `inbound` de
  novo, então nenhuma mensagem do cliente chega antes do registro. A opção A cria estado novo no hub sem ganho.
- **Impacto em spec:** RF-3901 e RF-3902.

## C-3902 — Entrega, faixa de IDs e versão

- **Entrega:** uma feature e um PR, com commits atômicos por tarefa.
- **Faixa de IDs:** `US-390x`, `RF-390x`, `RNF-390x`, `C-390x` e `T390x`.
- **Impacto de versão:** **PATCH**. Correção de concorrência, sem capacidade nova nem mudança de contrato
  (`docs/versionamento.md` §2).

## Resultado

CLOSED: C-3901 e C-3902 respondidas, sem ambiguidade em aberto.
