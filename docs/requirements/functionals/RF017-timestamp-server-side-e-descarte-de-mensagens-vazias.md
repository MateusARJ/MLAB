# ⚡ RF017 — Timestamp Server-Side e Descarte de Mensagens Vazias

> **Categoria:** Comunicação & Segurança  
> **Prioridade:** Alta  
> **Status:** 🟢 Aprovado  

---

## 📌 Descrição

O timestamp das mensagens de chat é obrigatoriamente gerado pelo servidor (`sent_at`), e mensagens em branco são descartadas.

---

## 🎯 Justificativa e Impacto

Evitar alteração fraudulenta de horários pelo cliente e lixo na interface de mensagens.

---

## 🛠️ Detalhes de Implementação Técnicos

- O servidor ignora qualquer campo de tempo fornecido pelo cliente e utiliza `time.Now().UTC()`.
- Conteúdos vazios após `strings.TrimSpace()` são silenciosamente descartados.

---

## 🔗 Relação com Regras de Negócio e Outros Requisitos

- **Documento Principal:** [requirements.md](../../requirements.md)
