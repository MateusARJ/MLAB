#  RF018 — Gestão de Reconexão do Professor (Timeout 30s)

> **Categoria:** Resiliência
> **Prioridade:** Alta
> **Status:**  Aprovado

---

##  Descrição

A perda de conexão do professor coloca a sala em `reconnecting` e inicia um timer de 30 segundos antes do encerramento forçado.

---

##  Justificativa e Impacto

Tolerar oscilações momentâneas de internet do professor sem derrubar imediatamente a sala inteira.

---

##  Detalhes de Implementação Técnicos

- O Hub agenda uma goroutine com timer de 30s (`publisherReconnectTimeout`).
- Caso o professor reconecte e envie `publish-request` com a mesma credencial em até 30s, o timer é cancelado e a sala retorna a `publishing`.
- O status `publishing`/`reconnecting` do hub é registrado no store da sala, e aparece no `status` de `GET /rooms/{id}/info` e
  `GET /rooms/active` e no `room_status` do `join` (feature 035). Em `/rooms/active`, a ordem é `publishing` > `reconnecting` >
  `waiting`.

---

##  Relação com Regras de Negócio e Outros Requisitos

- **Documento Principal:** [requirements.md](../../requirements.md)
