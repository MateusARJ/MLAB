# ⚡ RF014 — Operações REST Exclusivas do Professor

> **Categoria:** Autorização & API  
> **Prioridade:** Alta  
> **Status:** 🟢 Aprovado  

---

## 📌 Descrição

A criação e o encerramento formal da sala são operações REST restritas ao professor detentor da sala.

---

## 🎯 Justificativa e Impacto

Impedir a manipulação indevida do ciclo de vida das salas por alunos ou terceiros.

---

## 🛠️ Detalhes de Implementação Técnicos

- Endpoints `POST /rooms` e `POST /rooms/{id}/close` exigem cabeçalho `Authorization: Bearer <JWT>` e checam `role: professor`.

---

## 🔗 Relação com Regras de Negócio e Outros Requisitos

- **Documento Principal:** [requirements.md](../../requirements.md)
