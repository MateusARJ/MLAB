# ⚖️ RN003 — Isolamento e Validação de JWT por Sala

> **Categoria:** Autorização  
> **Status:** 🟢 Ativa  

---

## 📌 Regra de Negócio

O JWT do aluno embute o `room_id`. O servidor recusa handshakes de WebSocket caso o token apresentado não pertença à sala da requisição.

---

## 💥 Impacto no Negócio / Operação

Impede que um aluno autenticado em uma sala acesse a mídia ou o chat de outra sala sem autorização.

---

## 🔗 Relação com Requisitos Funcionais

- **Documento Principal:** [requirements.md](../../requirements.md)
