#  RN008 — Rejeição de Acesso a Salas Encerradas

> **Categoria:** Ciclo de Vida da Sala
> **Status:**  Ativa

---

##  Regra de Negócio

Salas com status `closed` não aceitam novas conexões de alunos ou emissões de token, retornando HTTP `409 Room closed`.

---

##  Impacto no Negócio / Operação

Garante que salas finalizadas não continuem consumindo recursos do servidor.

---

##  Relação com Requisitos Funcionais

- **Documento Principal:** [requirements.md](../../requirements.md)
