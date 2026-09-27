#  RF009 — Chat de Texto em Tempo Real

> **Categoria:** Comunicação
> **Prioridade:** Média
> **Status:**  Aprovado

---

##  Descrição

O sistema deve suportar chat de texto em tempo real via WebSocket para todos os participantes conectados na sala.

---

##  Justificativa e Impacto

Facilitar a interação, perguntas e respostas durante a aula sem interromper a transmissão de voz do professor.

---

##  Detalhes de Implementação Técnicos

- Mensagem do tipo `chat-message` é validada pelo servidor e propagada para todos os clientes conectados ao Hub da sala.

---

##  Relação com Regras de Negócio e Outros Requisitos

- **Documento Principal:** [requirements.md](../../requirements.md)
