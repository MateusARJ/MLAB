# ⚖️ RN004 — Restrição de Sessão Única por Aluno

> **Categoria:** Controle de Acesso  
> **Status:** 🟢 Ativa  

---

## 📌 Regra de Negócio

Se uma mesma matrícula tentar conectar uma segunda sessão WebSocket na mesma sala, a conexão anterior é encerrada com o código `4001 Duplicate Session`.

---

## 💥 Impacto no Negócio / Operação

Evita a duplicação indevida de acessos pela mesma credencial de aluno.

---

## 🔗 Relação com Requisitos Funcionais

- **Documento Principal:** [requirements.md](../../requirements.md)
