#  RN004 — Restrição de Sessão Única por Aluno

> **Categoria:** Controle de Acesso
> **Status:**  Ativa

---

##  Regra de Negócio

Enquanto houver sessão WebSocket ativa de um aluno com a mesma matrícula na sala, uma nova entrada com essa matrícula é recusada (`409` na entrada; close `4002 Student ID In Use` se a corrida chegar ao WebSocket) e o aluno conectado permanece. A reconexão do mesmo participante (mesmo token) encerra a conexão anterior dele com `4001 Duplicate Session` (ADR 0010, feature `027-matricula-unica-na-transmissao`).

---

##  Impacto no Negócio / Operação

Evita a duplicação indevida de acessos pela mesma credencial de aluno.

---

##  Relação com Requisitos Funcionais

- **Documento Principal:** [requirements.md](../../requirements.md)
