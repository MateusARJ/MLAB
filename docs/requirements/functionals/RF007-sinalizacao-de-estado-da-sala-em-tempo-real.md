#  RF007 — Sinalização de Estado da Sala em Tempo Real

> **Categoria:** Sinalização & Protocolo
> **Prioridade:** Alta
> **Status:**  Aprovado

---

##  Descrição

O sistema deve sinalizar o estado da sala e da transmissão (`waiting`, `publishing`, `reconnecting`, `closed`) via WebSocket para todos os participantes.

---

##  Justificativa e Impacto

Manter a interface dos alunos sincronizada em tempo real com as ações do professor e oscilações da transmissão.

---

##  Detalhes de Implementação Técnicos

- Mensagem broadcast `session-state` é enviada no momento em que o professor altera o estado ou quando ocorrem desconexões abruptas.
- O cliente Web renderiza estados correspondentes na UI sem recarregar a página.

---

##  Relação com Regras de Negócio e Outros Requisitos

- **Documento Principal:** [requirements.md](../../requirements.md)
