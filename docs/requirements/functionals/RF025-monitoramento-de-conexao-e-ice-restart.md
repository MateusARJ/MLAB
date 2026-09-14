#  RF025 — Monitoramento de Conexão e ICE Restart

> **Categoria:** Resiliência & Mídia
> **Prioridade:** Alta
> **Status:**  Aprovado

---

##  Descrição

O cliente deve monitorar a `iceConnectionState` e acionar o procedimento de ICE Restart em caso de degradação da rota WebRTC.

---

##  Justificativa e Impacto

Recuperar sessões de mídia travadas quando ocorrem trocas de rede no cliente (ex: mudança de Wi-Fi para 4G).

---

##  Detalhes de Implementação Técnicos

- Quando a `iceConnectionState` muda para `failed` ou `disconnected`, o cliente solicita nova oferta SDP com a flag `iceRestart: true`.

---

##  Relação com Regras de Negócio e Outros Requisitos

- **Documento Principal:** [requirements.md](../../requirements.md)
