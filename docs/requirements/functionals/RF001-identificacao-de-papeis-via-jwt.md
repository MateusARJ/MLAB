# ⚡ RF001 — Identificação de Papéis via JWT

> **Categoria:** Autenticação e Autorização  
> **Prioridade:** Alta  
> **Status:** 🟢 Aprovado  

---

## 📌 Descrição

O sistema deve validar e diferenciar os papéis (`professor` e `aluno`) obrigatoriamente através de JSON Web Tokens (JWT).

---

## 🎯 Justificativa e Impacto

Garantir a segurança e o isolamento de privilégios entre quem transmite (professor) e quem apenas assiste (aluno).

---

## 🛠️ Detalhes de Implementação Técnicos

- O token do professor contém `role: "professor"` e o ID do usuário.
- O token do aluno contém `role: "aluno"`, `name`, `student_id` e `room_id`.
- O backend valida a assinatura do token HMAC-SHA256 em cada requisição REST e handshake de WebSocket.

---

## 🔗 Relação com Regras de Negócio e Outros Requisitos

- **Documento Principal:** [requirements.md](../../requirements.md)
