# ⚡ RF002 — Publicação Exclusiva pelo Professor

> **Categoria:** Transmissão de Mídia  
> **Prioridade:** Alta  
> **Status:** 🟢 Aprovado  

---

## 📌 Descrição

Somente o professor autenticado e proprietário da sala pode publicar a tela e o áudio.

---

## 🎯 Justificativa e Impacto

Evitar interrupções não autorizadas na aula e garantir controle editorial único.

---

## 🛠️ Detalhes de Implementação Técnicos

- A oferta WebRTC `publish-request` enviada via WebSocket é validada contra as claims do JWT (`role: professor`).
- Qualquer tentativa de publicação por outros participantes é sumariamente rejeitada com o código `403 Forbidden`.

---

## 🔗 Relação com Regras de Negócio e Outros Requisitos

- **Documento Principal:** [requirements.md](../../requirements.md)
