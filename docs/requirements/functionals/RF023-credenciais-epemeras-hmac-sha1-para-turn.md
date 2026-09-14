#  RF023 — Credenciais Epêmeras HMAC-SHA1 para TURN

> **Categoria:** Segurança & Rede
> **Prioridade:** Alta
> **Status:**  Aprovado

---

##  Descrição

O servidor gera credenciais temporárias do TURN server baseadas em HMAC-SHA1 dinâmico para ultrapassar NATs restritivos.

---

##  Justificativa e Impacto

Evitar o vazamento de senhas permanentes de infraestrutura no código frontend dos clientes.

---

##  Detalhes de Implementação Técnicos

- O endpoint de sinalização/ICE gera `username = timestamp:userID` e `password = HMAC-SHA1(TURN_SECRET, username)` com validade limitada a 24 horas.

---

##  Relação com Regras de Negócio e Outros Requisitos

- **Documento Principal:** [requirements.md](../../requirements.md)
