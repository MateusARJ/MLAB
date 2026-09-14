#  RN017 — Sanitização e Descarte de Espaços em Branco

> **Categoria:** Chat
> **Status:**  Ativa

---

##  Regra de Negócio

Mensagens vazias ou contendo apenas espaços em branco são descartadas silenciosamente no servidor. Tags HTML são escapadas.

---

##  Impacto no Negócio / Operação

Evita a exibição de bolhas de chat vazias e protege a aplicação contra injeção de scripts.

---

##  Relação com Requisitos Funcionais

- **Documento Principal:** [requirements.md](../../requirements.md)
