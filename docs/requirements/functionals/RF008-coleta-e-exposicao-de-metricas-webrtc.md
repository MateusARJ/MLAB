# ⚡ RF008 — Coleta e Exposição de Métricas WebRTC

> **Categoria:** Observabilidade & Qualidade  
> **Prioridade:** Média  
> **Status:** 🟢 Aprovado  

---

## 📌 Descrição

O sistema deve coletar e expor estatísticas essenciais da sessão (bitrate, FPS, RTT, perda de pacotes, tempo até primeiro frame).

---

## 🎯 Justificativa e Impacto

Permitir diagnóstico rápido em caso de degradação de rede ou travamento na transmissão.

---

## 🛠️ Detalhes de Implementação Técnicos

- O cliente invoca `peerConnection.getStats()` periodicamente e exibe um painel/modal de diagnóstico.
- As métricas são resumidas e podem ser enviadas ao backend para monitoramento.

---

## 🔗 Relação com Regras de Negócio e Outros Requisitos

- **Documento Principal:** [requirements.md](../../requirements.md)
