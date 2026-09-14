# 🛡️ RNF005 — Segurança de Comunicação e Proteção de Segredos

> **Categoria:** Segurança  
> **Meta / Alvo:** `HTTPS, WSS, TLS 1.3`  
> **Status:** 🟢 Aprovado  

---

## 📌 Descrição do Requisito

Todas as comunicações devem ser obrigatoriamente criptografadas (HTTPS e WSS em produção), sem expor credenciais no cliente.

---

## 🎯 Justificativa e Critério de Medição

Impedir ataques de interceptação (Man-in-the-Middle) e proteger o segredo JWT do servidor.

---

## 🔗 Relação com o Sistema

- **Documento Principal:** [requirements.md](../../requirements.md)
