# 🛡️ RNF013 — Keepalive e Heartbeat WebSocket

> **Categoria:** Confiabilidade  
> **Meta / Alvo:** `Ping 15s / Pong 30s`  
> **Status:** 🟢 Aprovado  

---

## 📌 Descrição do Requisito

O canal WebSocket deve implementar frames de Ping/Pong a cada 15 segundos, encerrando conexões inativas após 30 segundos sem resposta.

---

## 🎯 Justificativa e Critério de Medição

Detectar rapidamente desconnexões silenciosas de rede e liberar recursos de sockets zumbis.

---

## 🔗 Relação com o Sistema

- **Documento Principal:** [requirements.md](../../requirements.md)
