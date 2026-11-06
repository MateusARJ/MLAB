#  RN011 — Validade Máxima de Credenciais TURN

> **Categoria:** Segurança & Infraestrutura
> **Status:**  Ativa

---

##  Regra de Negócio

Quando o TURN estiver habilitado (opcional — ADR 0005), as credenciais temporárias têm validade máxima de 24 horas e são geradas via algoritmo HMAC-SHA1.

---

##  Impacto no Negócio / Operação

Evita a utilização indevida da infraestrutura de relay TURN por usuários externos.

---

##  Relação com Requisitos Funcionais

- **Documento Principal:** [requirements.md](../../requirements.md)
