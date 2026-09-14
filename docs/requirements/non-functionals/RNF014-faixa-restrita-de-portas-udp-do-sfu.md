# 🛡️ RNF014 — Faixa Restrita de Portas UDP do SFU

> **Categoria:** Infraestrutura  
> **Meta / Alvo:** `Portas 50000–50100/UDP`  
> **Status:** 🟢 Aprovado  

---

## 📌 Descrição do Requisito

O SFU Pion deve alocar conexões WebRTC dentro de uma faixa de portas UDP explicitamente delimitada (ex: 50000–50100).

---

## 🎯 Justificativa e Critério de Medição

Facilitar a configuração de regras estritas de firewall, Security Groups e roteamento de rede em ambientes de nuvem.

---

## 🔗 Relação com o Sistema

- **Documento Principal:** [requirements.md](../../requirements.md)
