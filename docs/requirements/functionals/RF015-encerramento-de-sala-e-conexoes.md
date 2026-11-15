#  RF015 — Encerramento de Sala e Conexões

> **Categoria:** Gestão de Sala
> **Prioridade:** Alta
> **Status:**  Aprovado

---

##  Descrição

O encerramento da sala fecha todas as conexões WebRTC e desconecta os participantes do WebSocket imediatamente.

---

##  Justificativa e Impacto

Liberar recursos do servidor (portas UDP, memória) e informar a todos que a aula terminou.

---

##  Detalhes de Implementação Técnicos

- O backend envia a mensagem WS `room-closed` em broadcast.
- O SFU destrói as sessões Pion ativas da sala e o Hub remove a referência da sala em memória.
- O encerramento vale pelos três caminhos — REST `POST /rooms/{id}/close`, `end-session` pelo WebSocket e timeout de
  30 s de reconexão do professor (RN-13): a sala é marcada `closed`, removida do store e seus arquivos são liberados,
  então o link passa a responder `404` no `join` e no `info` (feature 033).

---

##  Relação com Regras de Negócio e Outros Requisitos

- **Documento Principal:** [requirements.md](../../requirements.md)
